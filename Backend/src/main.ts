import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';
import prisma, { startKeepAlive, stopKeepAlive } from './lib/prisma';
import { logger } from './utils/logger';
import { WebSocketService } from './services/websocket.service';
import { performanceMiddleware } from './middleware/performance.middleware';
import { backgroundPreloadService } from './services/background-preload.service';
// Dynamic import for transfersSyncService to avoid top-level await issues
let transfersSyncService: any;

// Load environment variables
dotenv.config();

// Check if running in production mode (must be defined before middleware)
const isProduction = process.env.NODE_ENV === 'production';

const app: Application = express();
const PORT = Number(process.env.PORT) || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api';

// Trust proxy - Required for Railway and other reverse proxies
// This allows Express to correctly identify the client's IP from X-Forwarded-For header
app.set('trust proxy', true);

// ============================================
// MIDDLEWARE
// ============================================
// Helmet security headers with production optimizations
app.use(
    helmet({
        contentSecurityPolicy: isProduction ? undefined : false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
);
// CORS configuration - stricter in production
const corsOrigins = isProduction
    ? [
          process.env.CORS_ORIGIN || 'https://api.90plus.app',
          'https://90plus.app',
          /^https:\/\/.*\.90plus\.app$/, // Production domains
      ]
    : [
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
      ];

app.use(
    cors({
        origin: corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-mobile-app', 'x-session-token', 'svix-id', 'svix-timestamp', 'svix-signature'],
        maxAge: isProduction ? 86400 : 3600, // 24 hours in production, 1 hour in dev
    })
);

// Keep-Alive headers for better connection reuse
app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=5, max=1000');
    next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware with production optimizations
app.use(
    compression({
        level: 6, // Optimal balance between compression and CPU
        threshold: 1024, // Only compress responses > 1KB
        filter: (req, res) => {
            // Don't compress if client explicitly requests no compression
            if (req.headers['x-no-compression']) {
                return false;
            }
            // Use default compression filter
            return compression.filter(req, res);
        },
    })
);

// Morgan logging - use 'combined' in production, 'dev' in development
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Performance monitoring
app.use(performanceMiddleware());

// Metrics tracking
import { metricsMiddleware, getMetricsHandler } from './middleware/metrics.middleware';
app.use(metricsMiddleware);

// App version check middleware (before routes)
import { checkAppVersion } from './middleware/app-version.middleware';
app.use(checkAppVersion);

// Route logging middleware (for debugging in development)
if (!isProduction) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
        logger.debug(`Route: ${req.method} ${req.path}`);
        next();
    });
}

// Route verification middleware - logs route matching attempts
app.use((req: Request, res: Response, next: NextFunction) => {
    // Only log for quiz routes to avoid too much logging
    if (req.path.includes('/quiz/')) {
        logger.debug('Route verification - Quiz route request', {
            method: req.method,
            path: req.path,
            originalUrl: req.originalUrl,
            baseUrl: req.baseUrl,
            url: req.url,
        });
    }
    next();
});

// Upload timeout middleware - 15 minutes for upload routes
const UPLOAD_TIMEOUT = 15 * 60 * 1000; // 15 minutes
app.use(`${API_PREFIX}/upload`, (req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(UPLOAD_TIMEOUT, () => {
        if (!res.headersSent) {
            res.status(408).json({
                status: 'ERROR',
                message: 'Upload timeout - request took too long',
            });
        }
    });
    next();
});

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
import profileRoutes from './routes/profile.routes';
import videoRoutes from './routes/video.routes';
import analyticsRoutes from './routes/analytics.routes';
import reelsRoutes from './routes/reels.routes';
import uploadRoutes from './routes/upload.routes';
import notificationRoutes from './routes/notification.routes';
import matchesRoutes from './routes/matches.routes';
import dailySpinRoutes from './routes/daily-spin.routes';
import footballRoutes from './routes/football.routes';
import predictionsRoutes from './routes/predictions.routes';
import coinsRoutes from './routes/coins.routes';
import quizRoutes from './routes/quiz.routes';
import adminRoutes from './routes/admin.routes';
import appVersionRoutes from './routes/app-version.routes';

// Import services
import { MatchWatcherService } from './services/match-watcher.service';
import { LeagueMatchWatcherService } from './services/league-match-watcher.service';
import { PredictionWatcherService } from './services/prediction-watcher.service';

// Import rate limiters
import { generalLimiter, lenientLimiter, webhookLimiter } from './middleware/rateLimit.middleware';

// Apply general rate limiting to all API routes
app.use(`${API_PREFIX}`, generalLimiter);

// Apply lenient rate limiting to high-frequency endpoints (before route registration)
app.use(`${API_PREFIX}/football/fixtures/live`, lenientLimiter);
app.use(`${API_PREFIX}/notifications`, lenientLimiter);
app.use(`${API_PREFIX}/reels/rankings`, lenientLimiter);

// Register routes
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/clerk`, clerkUserRoutes);
app.use(`${API_PREFIX}/webhooks/clerk`, webhookLimiter, webhookRoutes);
app.use(`${API_PREFIX}/profile`, profileRoutes);
app.use(`${API_PREFIX}/videos`, videoRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/reels`, reelsRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/matches`, matchesRoutes);
app.use(`${API_PREFIX}/daily-spin`, dailySpinRoutes);
app.use(`${API_PREFIX}/football`, footballRoutes);
app.use(`${API_PREFIX}/predictions`, predictionsRoutes);
app.use(`${API_PREFIX}/coins`, coinsRoutes);
app.use(`${API_PREFIX}/app`, appVersionRoutes);
// Register quiz routes with error handling
try {
    // Log before registration
    logger.info(`📝 Attempting to register quiz routes at ${API_PREFIX}/quiz`, {
        apiPrefix: API_PREFIX,
        routePath: `${API_PREFIX}/quiz`,
        environment: process.env.NODE_ENV || 'development',
    });
    
    app.use(`${API_PREFIX}/quiz`, quizRoutes);
    
    // Log successful registration with all available endpoints
    const quizEndpoints = [
        `${API_PREFIX}/quiz/health`,
        `${API_PREFIX}/quiz/test-daily-status`,
        `${API_PREFIX}/quiz/routes`,
        `${API_PREFIX}/quiz/categories`,
        `${API_PREFIX}/quiz/daily-status`,
        `${API_PREFIX}/quiz/answers`,
        `${API_PREFIX}/quiz/stats`,
        `${API_PREFIX}/quiz/history`,
        `${API_PREFIX}/quiz/:categoryId/start`,
        `${API_PREFIX}/quiz/:categoryId/submit`,
        `${API_PREFIX}/quiz/:categoryId/cooldown`,
    ];
    
    logger.info(`✅ Quiz routes registered successfully`, {
        routePath: `${API_PREFIX}/quiz`,
        totalEndpoints: quizEndpoints.length,
        endpoints: quizEndpoints,
    });
    
    // Verify daily-status route is registered
    setTimeout(() => {
        const routeStack = app._router?.stack || [];
        const quizRoutesInStack = routeStack.filter((layer: any) => 
            layer.regexp && layer.regexp.toString().includes('quiz')
        );
        
        // Check if daily-status route exists in router
        const quizRouter = quizRoutesInStack.find((layer: any) => 
            layer.name === 'router' || layer.handle === quizRoutes
        );
        
        if (quizRouter && quizRouter.handle) {
            const routerStack = quizRouter.handle.stack || [];
            const dailyStatusRoute = routerStack.find((layer: any) => 
                layer.route && layer.route.path === '/daily-status'
            );
            
            if (dailyStatusRoute) {
                logger.info('✅ /daily-status route verified in router stack');
            } else {
                logger.error('❌ /daily-status route NOT found in router stack!');
                logger.error('Router stack routes:', routerStack
                    .filter((l: any) => l.route)
                    .map((l: any) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`)
                );
            }
        }
        
        logger.debug('Quiz routes in Express stack', {
            count: quizRoutesInStack.length,
            layers: quizRoutesInStack.map((layer: any) => ({
                path: layer.regexp?.toString(),
                name: layer.name,
            })),
        });
    }, 200);
    
} catch (error: any) {
    logger.error(`❌ Failed to register quiz routes`, {
        error: error.message,
        stack: error.stack,
        apiPrefix: API_PREFIX,
        routePath: `${API_PREFIX}/quiz`,
    });
    // Continue even if quiz routes fail to register
}

// Metrics endpoint (for monitoring)
app.get(`${API_PREFIX}/metrics`, getMetricsHandler);

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
// 404 Handler - يجب أن يكون بعد جميع الـ routes
app.use((req: Request, res: Response) => {
    logger.warn(`404 - Route not found`, {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        url: req.url,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });
    
    // Log available routes for debugging
    const availableQuizRoutes = [
        `${API_PREFIX}/quiz/health`,
        `${API_PREFIX}/quiz/test-daily-status`,
        `${API_PREFIX}/quiz/routes`,
        `${API_PREFIX}/quiz/categories`,
        `${API_PREFIX}/quiz/daily-status`,
        `${API_PREFIX}/quiz/answers`,
        `${API_PREFIX}/quiz/stats`,
        `${API_PREFIX}/quiz/history`,
        `${API_PREFIX}/quiz/:categoryId/start`,
        `${API_PREFIX}/quiz/:categoryId/submit`,
        `${API_PREFIX}/quiz/:categoryId/cooldown`,
    ];
    
    res.status(404).json({
        status: 'ERROR',
        message: 'Route not found',
        path: req.path,
        method: req.method,
        originalUrl: req.originalUrl,
        availableRoutes: {
            quiz: availableQuizRoutes,
        },
        suggestion: req.path.includes('/quiz/') 
            ? `Did you mean one of these quiz routes? ${availableQuizRoutes.join(', ')}`
            : `Check available routes for ${req.path.split('/')[1] || 'root'}`,
    });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Error:', err);

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

// Create HTTP server for both Express and WebSocket
const httpServer = createServer(app);

// Increase server timeout for uploads (15 minutes)
httpServer.timeout = 15 * 60 * 1000; // 15 minutes
httpServer.keepAliveTimeout = 10 * 60 * 1000; // 10 minutes
httpServer.headersTimeout = 11 * 60 * 1000; // 11 minutes (must be > keepAliveTimeout)

async function startServer() {
    try {
        // Initialize WebSocket server (Requirements: 21.1)
        WebSocketService.initialize(httpServer);

        httpServer.listen(PORT, '0.0.0.0', async () => {
            logger.info('🚀 90Plus Backend is running! ');
            logger.info(`📍 Server: http://0.0.0.0:${PORT}`);
            logger.info(`📍 API: http://0.0.0.0:${PORT}${API_PREFIX}`);
            logger.info(`📍 Health: http://0.0.0.0:${PORT}${API_PREFIX}/health`);
            logger.info(`📍 WebSocket: ws://0.0.0.0:${PORT}`);
            logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            
            // Verify quiz routes are registered
            try {
                const quizRoutesPath = require.resolve('./routes/quiz.routes');
                logger.info(`✅ Quiz routes file found at: ${quizRoutesPath}`);
                
                // Log all quiz routes for verification
                const quizRoutesList = [
                    `${API_PREFIX}/quiz/health`,
                    `${API_PREFIX}/quiz/test-daily-status`,
                    `${API_PREFIX}/quiz/routes`,
                    `${API_PREFIX}/quiz/categories`,
                    `${API_PREFIX}/quiz/daily-status`,
                    `${API_PREFIX}/quiz/answers`,
                    `${API_PREFIX}/quiz/stats`,
                    `${API_PREFIX}/quiz/history`,
                    `${API_PREFIX}/quiz/:categoryId/start`,
                    `${API_PREFIX}/quiz/:categoryId/submit`,
                    `${API_PREFIX}/quiz/:categoryId/cooldown`,
                ];
                
                logger.info(`✅ Quiz routes available:`, {
                    totalRoutes: quizRoutesList.length,
                    routes: quizRoutesList,
                });
                
                // Verify route stack
                const routeStack = app._router?.stack || [];
                const quizRoutesInStack = routeStack.filter((layer: any) => 
                    layer.regexp && layer.regexp.toString().includes('quiz')
                );
                
                logger.info(`✅ Quiz routes in Express stack: ${quizRoutesInStack.length} layers found`);
            } catch (error: any) {
                logger.error(`❌ Quiz routes file not found: ${error.message}`);
            }

            try {
                await prisma.$connect();
                logger.info('✅ Database connected successfully');
                // Start keep-alive ping to prevent Neon connection timeout
                startKeepAlive();
                logger.info('✅ Database keep-alive started');

                // Start match watcher for push notifications
                if (process.env.FOOTBALL_API_KEY) {
                    MatchWatcherService.start();
                    PredictionWatcherService.start(); // ✅ Start prediction watcher
                    LeagueMatchWatcherService.start(); // ✅ Start league match watcher
                    
                    // ✅ Setup Cron Job for Prediction Watcher (every 5 minutes)
                    cron.schedule('*/5 * * * *', () => {
                        logger.info('⏰ Cron: Running prediction check...');
                        PredictionWatcherService.checkPredictions();
                    });
                    logger.info('✅ Prediction Watcher Cron Job scheduled (every 5 minutes)');
                    
                    // ✅ OPTIMIZATION 4: Start background preload service
                    backgroundPreloadService.start();
                    logger.info('✅ Background preload service started');
                    
                    // ✅ Start transfers sync service (will work with or without Redis)
                    try {
                        // Dynamic import to avoid top-level await issues
                        if (!transfersSyncService) {
                            const transfersSyncModule = await import('./services/transfers-sync.service');
                            transfersSyncService = transfersSyncModule.transfersSyncService;
                        }
                        transfersSyncService.start();
                        logger.info('✅ Transfers Sync Service started');
                    } catch (error) {
                        logger.warn('⚠️ Failed to start Transfers Sync Service:', error);
                        logger.warn('   App will continue without transfers sync service');
                        // Continue without transfers sync - app will still work
                    }
                } else {
                    logger.info('⚠️ FOOTBALL_API_KEY not set - Match watcher disabled');
                }
            } catch (error) {
                logger.warn('⚠️  Database connection failed. Please check your DATABASE_URL in .env');
                logger.warn('   The server will still run, but database features will not work.');
                logger.warn('   Make sure PostgreSQL is running and DATABASE_URL is correct.');
                logger.error('Database error:', error);
            }
        });

        // Handle server errors
        httpServer.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`❌ Port ${PORT} is already in use`);
            } else {
                logger.error('❌ Server error:', error);
            }
            process.exit(1);
        });
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    logger.info('\n👋 Shutting down gracefully...');
    WebSocketService.shutdown();
    MatchWatcherService.stop();
    PredictionWatcherService.stop(); // ✅ Stop prediction watcher
    LeagueMatchWatcherService.stop(); // ✅ Stop league match watcher
    backgroundPreloadService.stop(); // ✅ OPTIMIZATION 4: Stop background preload
    if (transfersSyncService) {
        transfersSyncService.stop(); // ✅ Stop transfers sync service
    }
    stopKeepAlive();
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('\n👋 Shutting down gracefully...');
    WebSocketService.shutdown();
    MatchWatcherService.stop();
    PredictionWatcherService.stop(); // ✅ Stop prediction watcher
    backgroundPreloadService.stop(); // ✅ OPTIMIZATION 4: Stop background preload
    if (transfersSyncService) {
        transfersSyncService.stop(); // ✅ Stop transfers sync service
    }
    stopKeepAlive();
    await prisma.$disconnect();
    process.exit(0);
});

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error: Error) => {
    logger.error('❌ Uncaught Exception:', error);
    // Don't exit immediately - let the server try to handle it
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately - let the server try to handle it
});

startServer();

export default app;
