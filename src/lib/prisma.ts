import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// ✅ OPTIMIZED: Connection pool configuration for Railway PostgreSQL
const CONNECTION_POOL_SIZE = process.env.DATABASE_CONNECTION_POOL_SIZE 
  ? parseInt(process.env.DATABASE_CONNECTION_POOL_SIZE, 10) 
  : 10; // Increased to 10 for Railway PostgreSQL

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // ✅ PERFORMANCE: Query optimization
    errorFormat: 'minimal',
  });
};

// Create or reuse prisma instance
const createPrismaClient = () => {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  
  const client = prismaClientSingleton();
  
  // ✅ PERFORMANCE: Add query performance monitoring
  client.$use(async (params: any, next: any) => {
    const before = Date.now();
    
    try {
      const result = await next(params);
      const after = Date.now();
      const duration = after - before;
      
      // Log slow queries (> 100ms)
      if (duration > 100) {
        logger.warn(`⚠️ Slow query detected: ${params.model}.${params.action} took ${duration}ms`);
      }
      
      return result;
    } catch (error: any) {
      const after = Date.now();
      const duration = after - before;
      
      logger.error(`❌ Query failed: ${params.model}.${params.action} after ${duration}ms`, {
        error: error.message,
        code: error.code,
      });
      
      throw error;
    }
  });
  
  // ✅ Add middleware to handle connection errors with retry
  client.$use(async (params: any, next: any) => {
    const maxRetries = 2; // Reduced retries for faster failure
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
          error.code === 'P2037' ||
          error.message?.includes('Closed') ||
          error.message?.includes('Connection') ||
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('timeout') ||
          error.message?.includes('too many clients');
        
        if (!isConnectionError || retries >= maxRetries - 1) {
          if (error.code === 'P2037' || error.message?.includes('too many clients')) {
            logger.error('❌ DATABASE CONNECTION POOL EXHAUSTED');
            logger.error(`   Current pool size: ${CONNECTION_POOL_SIZE}`);
          }
          throw error;
        }
        
        retries++;
        logger.warn(`⚠️ DB connection error, retry ${retries}/${maxRetries}...`);
        
        // ✅ Shorter backoff for faster recovery
        await new Promise(r => setTimeout(r, 200 * retries));
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

  process.on('beforeExit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  globalForPrisma.prisma = client;
  return client;
};

export const prisma = createPrismaClient();

// ✅ OPTIMIZED: Shorter keep-alive interval for Railway
let keepAliveInterval: NodeJS.Timeout | null = null;
let isKeepAliveRunning = false;

export function startKeepAlive() {
  if (process.env.NODE_ENV === 'production' && process.env.DISABLE_KEEPALIVE === 'true') {
    logger.info('⏭️  Keep-alive disabled in production');
    return;
  }

  if (keepAliveInterval) {
    return;
  }
  
  // ✅ Ping every 2 minutes (Railway PostgreSQL doesn't close connections)
  keepAliveInterval = setInterval(async () => {
    if (isKeepAliveRunning) return;

    isKeepAliveRunning = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.debug('✅ Keep-alive ping successful');
    } catch (error: any) {
      logger.warn('⚠️ Keep-alive ping failed:', error.message);
    } finally {
      isKeepAliveRunning = false;
    }
  }, 2 * 60 * 1000); // 2 minutes
  
  logger.info('✅ Keep-alive started (every 2 minutes)');
}

export function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    isKeepAliveRunning = false;
    logger.info('✅ Keep-alive stopped');
  }
}

// ✅ PERFORMANCE: Optimized retry wrapper
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 200
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
        error.code === 'P2037' ||
        error.message?.includes("Can't reach database") ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('timeout') ||
        error.message?.includes('Closed') ||
        error.message?.includes('too many clients');
      
      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }
      
      logger.warn(`⚠️ Retry ${attempt}/${maxRetries} in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 1.5; // Gentler exponential backoff
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

// ✅ Helper to get connection pool status
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
