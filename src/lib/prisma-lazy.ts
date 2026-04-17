/**
 * Lazy Prisma Client - Thin wrapper around the centralized singleton
 * 
 * ✅ FIXED: No longer creates a separate PrismaClient.
 *    Instead, re-exports from the main singleton in prisma.ts
 *    to prevent connection pool exhaustion (P2037).
 * 
 * All connection pooling, retry logic, and keep-alive
 * are handled by the main prisma.ts module.
 */

import prisma, {
  startKeepAlive,
  stopKeepAlive,
  checkDatabaseConnection,
  getConnectionPoolStatus,
  withRetry,
} from './prisma';
import { logger } from '../utils/logger';

// Re-export the singleton
export function getPrisma() {
  return prisma;
}

// Connection state tracking (delegates to main singleton)
let isConnected = false;

export async function connectPrisma(timeout = 10000): Promise<boolean> {
  if (isConnected) return true;

  try {
    logger.info('🔌 Connecting to database...');
    // ✅ FIX P2037: Never call $connect() explicitly — it bypasses the pool.
    // Use a ping query with a timeout instead. Prisma manages the pool automatically.
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), timeout)
      ),
    ]);
    isConnected = true;
    logger.info('✅ Database connected successfully');
    startKeepAlive();
    return true;
  } catch (error: any) {
    isConnected = false;
    logger.warn('⚠️ Database connection failed:', error.message);
    return false;
  }
}

export async function ensureConnection(): Promise<void> {
  if (!isConnected) {
    await connectPrisma();
  }
}

export async function disconnectPrisma(): Promise<void> {
  logger.info('🔌 Disconnecting Prisma client...');
  stopKeepAlive();
  await prisma.$disconnect();
  isConnected = false;
  logger.info('✅ Prisma client disconnected');
}

// Re-export utilities
export {
  checkDatabaseConnection,
  getConnectionPoolStatus,
  withRetry,
  startKeepAlive,
  stopKeepAlive,
};

// Default export = the singleton
export default prisma;

// Named export for explicit usage
export { prisma };
