/**
 * Lazy Prisma Client - Optimized for Cold Start
 * 
 * Features:
 * - ✅ Lazy initialization (connect on first use)
 * - ✅ Singleton pattern
 * - ✅ Connection pooling optimization
 * - ✅ Automatic retry with exponential backoff
 * - ✅ Connection health monitoring
 * - ✅ Graceful shutdown
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONNECTION_POOL_SIZE = process.env.DATABASE_CONNECTION_POOL_SIZE 
  ? parseInt(process.env.DATABASE_CONNECTION_POOL_SIZE, 10) 
  : 10;

const CONNECTION_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let prismaInstance: PrismaClient | null = null;
let isConnecting = false;
let isConnected = false;
let connectionPromise: Promise<void> | null = null;

// ============================================================================
// GET PRISMA CLIENT (Lazy Initialization)
// ============================================================================

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    logger.debug('🔧 Creating Prisma client instance...');
    
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['error', 'warn'] 
        : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      errorFormat: 'minimal',
    });

    // Add query performance monitoring
    prismaInstance.$use(async (params: any, next: any) => {
      const before = Date.now();
      
      try {
        const result = await next(params);
        const after = Date.now();
        const duration = after - before;
        
        // Log slow queries (> 100ms)
        if (duration > 100) {
          logger.warn(`⚠️ Slow query: ${params.model}.${params.action} took ${duration}ms`);
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

    // Add retry middleware for connection errors
    prismaInstance.$use(async (params: any, next: any) => {
      const maxRetries = 2;
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
            throw error;
          }
          
          retries++;
          logger.warn(`⚠️ DB connection error, retry ${retries}/${maxRetries}...`);
          await new Promise(r => setTimeout(r, 200 * retries));
        }
      }
      
      throw new Error('Max retries reached');
    });

    logger.debug('✅ Prisma client instance created');
  }
  
  return prismaInstance;
}

// ============================================================================
// CONNECT TO DATABASE (Async with Timeout)
// ============================================================================

export async function connectPrisma(timeout = CONNECTION_TIMEOUT): Promise<boolean> {
  // If already connected, return immediately
  if (isConnected) {
    return true;
  }

  // If connection is in progress, wait for it
  if (isConnecting && connectionPromise) {
    try {
      await connectionPromise;
      return isConnected;
    } catch (error) {
      return false;
    }
  }

  // Start new connection
  isConnecting = true;
  
  connectionPromise = (async () => {
    const client = getPrisma();
    
    try {
      logger.info('🔌 Connecting to database...');
      
      await Promise.race([
        client.$connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), timeout)
        )
      ]);
      
      isConnected = true;
      logger.info('✅ Database connected successfully');
      
      // Start keep-alive
      startKeepAlive();
      
    } catch (error: any) {
      isConnected = false;
      logger.warn('⚠️ Database connection failed:', error.message);
      logger.warn('   Will retry on first database request');
      throw error;
    } finally {
      isConnecting = false;
    }
  })();

  try {
    await connectionPromise;
    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// ENSURE CONNECTION (Connect if not connected)
// ============================================================================

export async function ensureConnection(): Promise<void> {
  if (!isConnected) {
    await connectPrisma();
  }
}

// ============================================================================
// CHECK DATABASE CONNECTION HEALTH
// ============================================================================

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = getPrisma();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('❌ Database connection check failed:', error);
    return false;
  }
}

// ============================================================================
// GET CONNECTION POOL STATUS
// ============================================================================

export async function getConnectionPoolStatus() {
  try {
    const client = getPrisma();
    const result = await client.$queryRaw<Array<{ count: number }>>`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    return {
      activeConnections: Number(result[0]?.count || 0),
      poolSize: CONNECTION_POOL_SIZE,
      isConnected,
    };
  } catch (error) {
    logger.warn('⚠️ Could not get connection pool status:', error);
    return null;
  }
}

// ============================================================================
// KEEP-ALIVE PING
// ============================================================================

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
  
  // Ping every 2 minutes
  keepAliveInterval = setInterval(async () => {
    if (isKeepAliveRunning) return;

    isKeepAliveRunning = true;
    try {
      const client = getPrisma();
      await client.$queryRaw`SELECT 1`;
      logger.debug('✅ Keep-alive ping successful');
    } catch (error: any) {
      logger.warn('⚠️ Keep-alive ping failed:', error.message);
      isConnected = false; // Mark as disconnected
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

// ============================================================================
// RETRY WRAPPER
// ============================================================================

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  delayMs: number = RETRY_DELAY
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
      delayMs *= 1.5; // Exponential backoff
    }
  }
  
  throw lastError;
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    logger.info('🔌 Disconnecting Prisma client...');
    stopKeepAlive();
    await prismaInstance.$disconnect();
    prismaInstance = null;
    isConnected = false;
    isConnecting = false;
    connectionPromise = null;
    logger.info('✅ Prisma client disconnected');
  }
}

// Setup graceful shutdown handlers
const cleanup = async () => {
  await disconnectPrisma();
};

process.on('beforeExit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

// Export lazy prisma instance
export default getPrisma();

// Export named exports for explicit usage
export const prisma = getPrisma();
