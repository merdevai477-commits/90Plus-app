/**
 * Redis Client Setup
 * 
 * Provides a singleton Redis client for caching across the application.
 * Falls back gracefully if Redis is not available.
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;
let isConnected = false;

/**
 * Initialize Redis client
 */
export function initializeRedis(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    logger.warn('⚠️  REDIS_URL not set - Redis caching disabled. Using in-memory cache only.');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true; // Reconnect on READONLY error
        }
        return false;
      },
      enableReadyCheck: true,
      enableOfflineQueue: true, // Queue commands when offline (better for production)
      lazyConnect: false, // Connect immediately
      connectTimeout: 10000, // 10 seconds
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connecting...');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      logger.info('✅ Redis connected and ready');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      logger.warn('⚠️  Redis error:', err.message);
      // Don't throw - allow app to continue with in-memory cache
    });

    redisClient.on('close', () => {
      isConnected = false;
      logger.warn('⚠️  Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });

    return redisClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Redis:', error);
    return null;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): Redis | null {
  if (!redisClient) {
    return initializeRedis();
  }
  return redisClient;
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient?.status === 'ready';
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    logger.info('✅ Redis connection closed');
  }
}

// Initialize on module load
initializeRedis();

export default getRedisClient;

