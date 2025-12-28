import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Singleton pattern for Prisma Client with retry logic
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prismaClientSingleton = () => {
    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' 
            ? ['error', 'warn'] 
            : ['error'],
    });
};

// Create or reuse prisma instance
const createPrismaClient = () => {
    if (globalForPrisma.prisma) {
        return globalForPrisma.prisma;
    }
    
    const client = prismaClientSingleton();
    
    // Add middleware to handle connection errors
    client.$use(async (params, next) => {
        const maxRetries = 3;
        let retries = 0;
        
        while (retries < maxRetries) {
            try {
                return await next(params);
            } catch (error: any) {
                const isConnectionError = 
                    error.code === 'P1001' ||
                    error.code === 'P1002' ||
                    error.code === 'P1008' ||
                    error.code === 'P1017' ||
                    error.message?.includes('Closed') ||
                    error.message?.includes('Connection') ||
                    error.message?.includes('ECONNREFUSED') ||
                    error.message?.includes('timeout');
                
                if (!isConnectionError || retries >= maxRetries - 1) {
                    throw error;
                }
                
                retries++;
                logger.warn(`⚠️ DB connection error, retry ${retries}/${maxRetries}...`);
                
                // Wait before retry with exponential backoff
                await new Promise(r => setTimeout(r, 1000 * retries));
                
                // Try to reconnect
                try {
                    await client.$disconnect();
                    await client.$connect();
                } catch {
                    // Ignore reconnection errors, will retry the operation
                }
            }
        }
        
        throw new Error('Max retries reached');
    });
    
    globalForPrisma.prisma = client;
    return client;
};

export const prisma = createPrismaClient();

// Keep connection alive with periodic ping
let keepAliveInterval: NodeJS.Timeout | null = null;

export function startKeepAlive() {
    if (keepAliveInterval) return;
    
    // Ping database every 2 minutes to keep connection alive (Neon closes after 5 min idle)
    keepAliveInterval = setInterval(async () => {
        try {
            await prisma.$queryRaw`SELECT 1`;
            logger.debug('✅ Keep-alive ping successful');
        } catch (error: any) {
            logger.warn('⚠️ Keep-alive ping failed:', error.message);
            try {
                await prisma.$disconnect();
                await prisma.$connect();
                logger.info('✅ Reconnected successfully');
            } catch (reconnectError: any) {
                logger.error('❌ Reconnection failed:', reconnectError.message);
            }
        }
    }, 2 * 60 * 1000); // 2 minutes
    
    logger.info('✅ Keep-alive started (every 2 minutes)');
}

export function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        logger.info('✅ Keep-alive stopped');
    }
}

// Retry wrapper for database operations (for manual use)
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            const isConnectionError = 
                error.code === 'P1001' ||
                error.code === 'P1002' ||
                error.message?.includes("Can't reach database") ||
                error.message?.includes('ECONNREFUSED') ||
                error.message?.includes('timeout') ||
                error.message?.includes('Closed');
            
            if (!isConnectionError || attempt === maxRetries) {
                throw error;
            }
            
            logger.warn(`⚠️ Retry ${attempt}/${maxRetries} in ${delayMs}ms...`);
            
            try {
                await prisma.$disconnect();
                await prisma.$connect();
            } catch {
                // Ignore
            }
            
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= 2;
        }
    }
    
    throw lastError;
}

export default prisma;
