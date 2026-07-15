/**
 * Redis Cache Service
 * 
 * Provides a unified interface for caching with Redis.
 * Falls back to in-memory cache if Redis is unavailable.
 */

import { getRedisClient, isRedisConnected } from '../lib/redis';
import { logger } from '../utils/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class RedisCacheService {
  // Fallback in-memory cache — hard-capped so Redis outages cannot OOM the process
  private memoryCache = new Map<string, CacheEntry<any>>();
  private readonly MAX_MEMORY_ENTRIES = 500;

  private putMemoryFallback(key: string, entry: CacheEntry<any>): void {
    if (!this.memoryCache.has(key) && this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
      const oldest = this.memoryCache.keys().next().value;
      if (oldest !== undefined) this.memoryCache.delete(oldest);
    }
    this.memoryCache.set(key, entry);
  }

  memoryFallbackSize(): number {
    return this.memoryCache.size;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first if available
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const value = await redis.get(key);
          if (value) {
            const entry: CacheEntry<T> = JSON.parse(value);
            // Check if expired
            if (Date.now() - entry.timestamp < entry.ttl) {
              logger.debug(`📦 Redis cache HIT: ${key}`);
              return entry.data;
            } else {
              // Expired, delete it
              await redis.del(key);
            }
          }
        }
      } catch (error) {
        logger.warn(`Redis get error for key ${key}:`, error);
        // Fall through to memory cache
      }
    }

    // Fallback to memory cache
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && Date.now() - memoryEntry.timestamp < memoryEntry.ttl) {
      logger.debug(`📦 Memory cache HIT: ${key}`);
      return memoryEntry.data;
    }

    // Not found or expired
    if (memoryEntry) {
      this.memoryCache.delete(key);
    }

    return null;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttlMs,
    };

    // Try Redis first if available
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const ttlSeconds = Math.ceil(ttlMs / 1000);
          await redis.setex(key, ttlSeconds, JSON.stringify(entry));
          logger.debug(`📦 Redis cache SET: ${key} (TTL: ${ttlSeconds}s)`);
          return;
        }
      } catch (error) {
        logger.warn(`Redis set error for key ${key}:`, error);
        // Fall through to memory cache
      }
    }

    // Fallback to memory cache (capped)
    this.putMemoryFallback(key, entry);
    logger.debug(`📦 Memory cache SET: ${key} (TTL: ${ttlMs}ms)`);
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    // Delete from Redis if available
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          await redis.del(key);
        }
      } catch (error) {
        logger.warn(`Redis del error for key ${key}:`, error);
      }
    }

    // Delete from memory cache
    this.memoryCache.delete(key);
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    // Delete from Redis if available
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const keys = await redis.keys(pattern);
          if (keys.length > 0) {
            await redis.del(...keys);
            logger.debug(`📦 Redis cache DEL pattern: ${pattern} (${keys.length} keys)`);
          }
        }
      } catch (error) {
        logger.warn(`Redis delPattern error for pattern ${pattern}:`, error);
      }
    }

    // Delete from memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern.replace('*', ''))) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    // Check Redis first
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const exists = await redis.exists(key);
          return exists === 1;
        }
      } catch (error) {
        logger.warn(`Redis exists error for key ${key}:`, error);
      }
    }

    // Check memory cache
    return this.memoryCache.has(key);
  }

  /**
   * Get TTL for a key (in milliseconds)
   */
  async getTTL(key: string): Promise<number> {
    // Check Redis first
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const ttlSeconds = await redis.ttl(key);
          return ttlSeconds > 0 ? ttlSeconds * 1000 : -1;
        }
      } catch (error) {
        logger.warn(`Redis TTL error for key ${key}:`, error);
      }
    }

    // Check memory cache
    const entry = this.memoryCache.get(key);
    if (entry) {
      const age = Date.now() - entry.timestamp;
      const remaining = entry.ttl - age;
      return remaining > 0 ? remaining : -1;
    }

    return -1;
  }

  /**
   * Clear all cache (use with caution)
   */
  async clear(): Promise<void> {
    // Clear Redis if available
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          await redis.flushdb();
          logger.warn('⚠️  Redis cache cleared');
        }
      } catch (error) {
        logger.warn('Redis clear error:', error);
      }
    }

    // Clear memory cache
    this.memoryCache.clear();
  }
}

// Singleton instance
export const redisCacheService = new RedisCacheService();

export default redisCacheService;

