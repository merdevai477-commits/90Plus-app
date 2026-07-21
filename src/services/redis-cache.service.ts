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
   * Get several cache entries with one Redis round trip.
   * Falls back to the bounded in-memory cache when Redis is unavailable.
   */
  async getMany<T>(keys: string[]): Promise<Array<T | null>> {
    if (!keys.length) return [];

    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const values = await redis.mget(...keys);
          const now = Date.now();
          return values.map((value, index) => {
            if (!value) return null;
            try {
              const entry = JSON.parse(value) as CacheEntry<T>;
              if (now - entry.timestamp < entry.ttl) return entry.data;
              void redis.del(keys[index]);
            } catch {
              // Treat malformed cache entries as misses.
            }
            return null;
          });
        }
      } catch (error) {
        logger.warn('Redis mget error:', error);
      }
    }

    const now = Date.now();
    return keys.map((key) => {
      const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
      if (entry && now - entry.timestamp < entry.ttl) return entry.data;
      if (entry) this.memoryCache.delete(key);
      return null;
    });
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
   * Set several entries through one Redis pipeline.
   */
  async setMany<T>(entries: Array<{ key: string; value: T; ttlMs: number }>): Promise<void> {
    if (!entries.length) return;

    const timestamp = Date.now();
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const pipeline = redis.pipeline();
          for (const { key, value, ttlMs } of entries) {
            const entry: CacheEntry<T> = { data: value, timestamp, ttl: ttlMs };
            pipeline.setex(key, Math.ceil(ttlMs / 1000), JSON.stringify(entry));
          }
          await pipeline.exec();
          return;
        }
      } catch (error) {
        logger.warn('Redis pipeline set error:', error);
      }
    }

    for (const { key, value, ttlMs } of entries) {
      this.putMemoryFallback(key, { data: value, timestamp, ttl: ttlMs });
    }
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
          let cursor = '0';
          let deleted = 0;
          do {
            const [nextCursor, keys] = await redis.scan(
              cursor,
              'MATCH',
              pattern,
              'COUNT',
              200,
            );
            cursor = nextCursor;
            if (keys.length > 0) {
              const pipeline = redis.pipeline();
              for (const key of keys) pipeline.del(key);
              await pipeline.exec();
              deleted += keys.length;
            }
          } while (cursor !== '0');
          if (deleted > 0) {
            logger.debug(`📦 Redis cache DEL pattern: ${pattern} (${deleted} keys)`);
          }
        }
      } catch (error) {
        logger.warn(`Redis delPattern error for pattern ${pattern}:`, error);
      }
    }

    // Delete from memory cache
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const matcher = new RegExp(`^${escaped}$`);
    for (const key of this.memoryCache.keys()) {
      if (matcher.test(key)) {
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

