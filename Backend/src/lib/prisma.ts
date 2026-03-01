import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// ✅ Connection pool configuration
const CONNECTION_POOL_SIZE = process.env.DATABASE_CONNECTION_POOL_SIZE 
  ? parseInt(process.env.DATABASE_CONNECTION_POOL_SIZE, 10) 
  : 5; // Default to 5 connections (Railway/Neon free tier limit)

const CONNECTION_TIMEOUT = 20000; // 20 seconds
const POOL_TIMEOUT = 10000; // 10 seconds

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
    // ✅ Connection pool configuration
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // ✅ Add connection limits
    __internal: {
      engine: {
        connection_limit: CONNECTION_POOL_SIZE,
      },
    },
  });
};

// Create or reuse prisma instance
const createPrismaClient = () => {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  
  const client = prismaClientSingleton();
  
  // ✅ Add middleware to handle connection errors with retry
  client.$use(async (params: any, next: any) => {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        return await next(params);
      } catch (error: any) {
        // ✅ Check for connection pool exhaustion
        const isConnectionError = 
          error.code === 'P1001' ||
          error.code === 'P1002' ||
          error.code === 'P1008' ||
          error.code === 'P1017' ||
          error.code === 'P2037' || // ✅ Too many connections
          error.message?.includes('Closed') ||
          error.message?.includes('Connection') ||
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('timeout') ||
          error.message?.includes('too many clients');
        
        if (!isConnectionError || retries >= maxRetries - 1) {
          // Log detailed error for debugging
          if (error.code === 'P2037' || error.message?.includes('too many clients')) {
            logger.error('❌ DATABASE CONNECTION POOL EXHAUSTED - Too many connections');
            logger.error(`   Current pool size: ${CONNECTION_POOL_SIZE}`);
            logger.error(`   Consider increasing DATABASE_CONNECTION_POOL_SIZE env var`);
          }
          throw error;
        }
        
        retries++;
        logger.warn(`⚠️ DB connection error, retry ${retries}/${maxRetries}...`);
        
        // ✅ Exponential backoff
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, retries)));
      }
    }
    
    throw new Error('Max retries reached');
  });
  
  // ✅ Graceful shutdown handler
  const cleanup = async () => {
    logger.info('🔌 Disconnecting Prisma client...');
    await client.$disconnect();
    logger.info('✅ Prisma client disconnected');
  };

  // Register cleanup handlers
  process.on('beforeExit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  globalForPrisma.prisma = client;
  return client;
};

export const prisma = createPrismaClient();

// ✅ IMPROVED: Keep-alive with connection pool awareness
let keepAliveInterval: NodeJS.Timeout | null = null;
let isKeepAliveRunning = false;

export function startKeepAlive() {
  // ✅ Don't run keep-alive in production (Railway/Neon handles this)
  if (process.env.NODE_ENV === 'production' && process.env.DISABLE_KEEPALIVE === 'true') {
    logger.info('⏭️  Keep-alive disabled in production (managed by platform)');
    return;
  }

  if (keepAliveInterval) {
    logger.info('⏭️  Keep-alive already running');
    return;
  }
  
  // ✅ Ping database every 4 minutes (Neon closes after 5 min idle)
  // Using longer interval to reduce connection churn
  keepAliveInterval = setInterval(async () => {
    // Skip if already running
    if (isKeepAliveRunning) {
      logger.debug('⏭️  Keep-alive ping skipped (already running)');
      return;
    }

    isKeepAliveRunning = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.debug('✅ Keep-alive ping successful');
    } catch (error: any) {
      logger.warn('⚠️ Keep-alive ping failed:', error.message);
      // ✅ Don't try to reconnect here - let middleware handle it
    } finally {
      isKeepAliveRunning = false;
    }
  }, 4 * 60 * 1000); // 4 minutes (increased from 2)
  
  logger.info('✅ Keep-alive started (every 4 minutes)');
}

export function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    isKeepAliveRunning = false;
    logger.info('✅ Keep-alive stopped');
  }
}

// ✅ Retry wrapper for database operations (for manual use)
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 500
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
        error.code === 'P2037' || // Too many connections
        error.message?.includes("Can't reach database") ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('timeout') ||
        error.message?.includes('Closed') ||
        error.message?.includes('too many clients');
      
      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }
      
      logger.warn(`⚠️ Retry ${attempt}/${maxRetries} in ${delayMs}ms...`);
      
      // ✅ Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
  
  throw lastError;
}

// ✅ Helper to check database connection health
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('❌ Database connection check failed:', error);
    return false;
  }
}

// ✅ Helper to get connection pool status (for monitoring)
export async function getConnectionPoolStatus() {
  try {
    const result = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    return {
      activeConnections: Number(result[0]?.count || 0),
      poolSize: CONNECTION_POOL_SIZE,
    };
  } catch (error) {
    logger.warn('⚠️ Could not get connection pool status:', error);
    return null;
  }
}

export default prisma;
