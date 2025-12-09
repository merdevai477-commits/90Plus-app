import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

const app: Application = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api';

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet());
app.use(
    cors({
        origin: [
            process.env.CORS_ORIGIN || 'http://localhost:8081',
            'http://192.168.1.7:8081',
            'http://localhost:3000',
            'exp://192.168.1.7:8081',
            /^https:\/\/.*\.ngrok-free\.app$/, // ngrok URLs
            /^https:\/\/.*\.ngrok\.io$/, // ngrok legacy URLs
            /^https:\/\/.*\.ngrok\.app$/, // ngrok app URLs
            /^https:\/\/.*\.railway\.app$/, // Railway URLs
            /^https:\/\/.*\.up\.railway\.app$/, // Railway URLs
            /^ninetyplusapp:\/\//, // App deep links
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-mobile-app', 'x-session-token', 'svix-id', 'svix-timestamp', 'svix-signature'],
    })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(morgan('dev'));

// ============================================
// ROUTES
// ============================================
app.get('/', (_req: Request, res: Response) => {
    res.json({
        name: '90Plus API',
        version: '1.0.0',
        description: 'Backend API for 90Plus App using Express, Prisma, and PostgreSQL',
        message: 'Welcome to 90Plus API! Visit /api for more information.',
        endpoints: {
            api: `${API_PREFIX}`,
            health: `${API_PREFIX}/health`,
            users: `${API_PREFIX}/users`,
            clerk: `${API_PREFIX}/clerk`,
            webhooks: `${API_PREFIX}/webhooks/clerk`,
        },
    });
});

// Import routes
import userRoutes from './routes/user.routes';
import clerkUserRoutes from './routes/clerk-user.routes';
import webhookRoutes from './routes/webhook.routes';

// Import rate limiters
import { generalLimiter, webhookLimiter } from './middleware/rateLimit.middleware';

// Apply general rate limiting to all API routes
app.use(`${API_PREFIX}`, generalLimiter);

// Register routes
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/clerk`, clerkUserRoutes);
app.use(`${API_PREFIX}/webhooks/clerk`, webhookLimiter, webhookRoutes);

app.get(`${API_PREFIX}/health`, async (_req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    const environment = process.env.NODE_ENV || 'development';

    try {
        await Promise.race([
            prisma.$queryRawUnsafe('SELECT 1'),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Database connection timeout')), 5000)
            )
        ]);

        res.status(200).json({
            status: 'OK',
            message: '90Plus API is running',
            timestamp,
            database: 'Connected',
            environment,
            server: 'Running',
        });
    } catch (error: any) {
        res.status(200).json({
            status: 'PARTIAL',
            message: '90Plus API is running, but database is not connected',
            timestamp,
            database: 'Disconnected',
            environment,
            server: 'Running',
            error: error?.message || 'Database connection failed',
            help: {
                message: 'To connect the database:',
                steps: [
                    '1. Make sure PostgreSQL is installed and running',
                    '2. Update DATABASE_URL in .env file',
                    '3. Run: npm run prisma:migrate',
                ],
            },
        });
    }
});

app.get(`${API_PREFIX}`, (_req: Request, res: Response) => {
    res.json({
        name: '90Plus API',
        version: '1.0.0',
        description: 'Backend API for 90Plus App using Express, Prisma, and PostgreSQL',
        endpoints: {
            health: `${API_PREFIX}/health`,
            users: `${API_PREFIX}/users`,
        },
    });
});

app.get(`${API_PREFIX}/users`, async (_req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                isVerified: true,
                isDeveloper: true,
                coins: true,
                level: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        res.json({
            status: 'SUCCESS',
            count: users.length,
            users: users,
            message: users.length > 0
                ? `Found ${users.length} user(s) in database`
                : 'No users found. Run "npm run prisma:seed" to create sample accounts.',
        });
    } catch (error: any) {
        const errorMessage = error?.message || 'Cannot connect to database';
        const isConnectionError = errorMessage.includes('Can\'t reach database server') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('timeout');

        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed',
            error: errorMessage,
            databaseStatus: 'Not Connected',
            accountsAvailable: false,
            help: {
                message: isConnectionError
                    ? 'PostgreSQL is not running or not installed. Choose one option:'
                    : 'To fix this:',
                options: [
                    {
                        title: 'Option 1: Install PostgreSQL Locally',
                        steps: [
                            '1. Run: .\\install-postgres.ps1 (in Backend folder)',
                            '2. Or download from: https://www.postgresql.org/download/windows/',
                            '3. After installation, run: npm run prisma:migrate',
                            '4. Then run: npm run prisma:seed',
                        ],
                    },
                    {
                        title: 'Option 2: Use Supabase (Free Cloud Database)',
                        steps: [
                            '1. Go to: https://supabase.com/dashboard',
                            '2. Create a new project',
                            '3. Copy the connection string',
                            '4. Update DATABASE_URL in .env file',
                            '5. Run: npm run prisma:migrate',
                            '6. Then run: npm run prisma:seed',
                        ],
                        note: 'See SUPABASE_SETUP.md for detailed instructions',
                    },
                ],
                quickCheck: [
                    'Check if PostgreSQL service is running:',
                    '  Get-Service -Name "*postgresql*"',
                    '',
                    'If installed, start it:',
                    '  Start-Service postgresql-x64-14',
                ],
            },
        });
    }
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((req: Request, res: Response) => {
    res.status(404).json({
        status: 'ERROR',
        message: 'Route not found',
        path: req.path,
    });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);

    res.status(500).json({
        status: 'ERROR',
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
    });
});

// ============================================
// SERVER START
// ============================================
async function startServer() {
    app.listen(PORT, async () => {
        console.log('🚀 90Plus Backend is running! ');
        console.log(`📍 Server: http://localhost:${PORT}`);
        console.log(`📍 API: http://localhost:${PORT}${API_PREFIX}`);
        console.log(`📍 Health: http://localhost:${PORT}${API_PREFIX}/health`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

        try {
            await prisma.$connect();
            console.log('✅ Database connected successfully');
        } catch (error) {
            console.warn('⚠️  Database connection failed. Please check your DATABASE_URL in .env');
            console.warn('   The server will still run, but database features will not work.');
            console.warn('   Make sure PostgreSQL is running and DATABASE_URL is correct.');
        }
    });
}

process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n👋 Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

startServer();

export default app;
