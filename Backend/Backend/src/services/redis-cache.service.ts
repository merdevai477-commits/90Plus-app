/**
 * Redis Cache Service
 * 
 * Provides a unified interface for caching with Redis.
 * Falls back to in-memory cache if Redis is unavailable.
 * 
 * Uses Redis Sets for efficient key tracking and deletion.
 */

import { getRedisClient, isRedisConnected } from '../lib/redis';
import { logger } from '../utils/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Cache namespaces for organizing keys
 */
export enum CacheNamespace {
  PROFILE = 'profile',
  SEARCH = 'search',
  STATS = 'stats',
  FOLLOWERS = 'followers',
  FOLLOWING = 'following',
  REELS = 'reels',
  MATCHES = 'matches',
  PLAYERS = 'players',
  LEAGUES = 'leagues',
  TEAMS = 'teams',
}

class RedisCacheService {
  // Fallback in-memory cache
  private memoryCache = new Map<string, CacheEntry<any>>();
  private memoryKeySets = new Map<string, Set<string>>();

  /**
   * Get the Redis Set key for a namespace
   */
  private getSetKey(namespace: CacheNamespace | string): string {
    return `cache:keys:${namespace}`;
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
   * Set value in cache with namespace tracking
   */
  async set<T>(
    key: string,
    value: T,
    ttlMs: number,
    namespace?: CacheNamespace | string
  ): Promise<void> {
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
          
          // Use pipeline for atomic operations
          const pipeline = redis.pipeline();
          
          // Set the cache value
          pipeline.setex(key, ttlSeconds, JSON.stringify(entry));
          
          // Add key to namespace set if provided
          if (namespace) {
            const setKey = this.getSetKey(namespace);
            pipeline.sadd(setKey, key);
            // Set TTL on the set itself (slightly longer than cache TTL)
            pipeline.expire(setKey, ttlSeconds + 60);
          }
          
          await pipeline.exec();
          
          logger.debug(`📦 Redis cache SET: ${key} (TTL: ${ttlSeconds}s)${namespace ? ` [${namespace}]` : ''}`);
          return;
        }
      } catch (error) {
        logger.warn(`Redis set error for key ${key}:`, error);
        // Fall through to memory cache
      }
    }

    // Fallback to memory cache
    this.memoryCache.set(key, entry);
    
    // Track in memory set if namespace provided
    if (namespace) {
      const setKey = this.getSetKey(namespace);
      if (!this.memoryKeySets.has(setKey)) {
        this.memoryKeySets.set(setKey, new Set());
      }
      this.memoryKeySets.get(setKey)!.add(key);
    }
    
    logger.debug(`📦 Memory cache SET: ${key} (TTL: ${ttlMs}ms)${namespace ? ` [${namespace}]` : ''}`);
  }

  /**
   * Delete value from cache and remove from namespace set
   */
  async del(key: string, namespace?: CacheNamespace | string): Promise<void> {
    // Delete from Redis if available
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const pipeline = redis.pipeline();
          
          // Delete the key
          pipeline.del(key);
          
          // Remove from namespace set if provided
          if (namespace) {
            const setKey = this.getSetKey(namespace);
            pipeline.srem(setKey, key);
          }
          
          await pipeline.exec();
        }
      } catch (error) {
        logger.warn(`Redis del error for key ${key}:`, error);
      }
    }

    // Delete from memory cache
    this.memoryCache.delete(key);
    
    // Remove from memory set if namespace provided
    if (namespace) {
      const setKey = this.getSetKey(namespace);
      this.memoryKeySets.get(setKey)?.delete(key);
    }
  }

  /**
   * Delete all keys in a namespace (efficient using Sets)
   * @param namespace - The cache namespace to clear
   * @returns Number of keys deleted
   */
  async delNamespace(namespace: CacheNamespace | string): Promise<number> {
    let deletedCount = 0;

    // Delete from Redis if available
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const setKey = this.getSetKey(namespace);
          
          // Get all keys in the set
          const keys = await redis.smembers(setKey);
          
          if (keys.length > 0) {
            // Delete all keys in batches (for large sets)
            const batchSize = 100;
            for (let i = 0; i < keys.length; i += batchSize) {
              const batch = keys.slice(i, i + batchSize);
              const pipeline = redis.pipeline();
              
              // Delete each key
              batch.forEach(key => pipeline.del(key));
              
              await pipeline.exec();
              deletedCount += batch.length;
            }
            
            // Delete the set itself
            await redis.del(setKey);
            
            logger.info(`📦 Redis cache cleared namespace: ${namespace} (${deletedCount} keys)`);
          }
        }
      } catch (error) {
        logger.warn(`Redis delNamespace error for ${namespace}:`, error);
      }
    }

    // Delete from memory cache
    const setKey = this.getSetKey(namespace);
    const memoryKeys = this.memoryKeySets.get(setKey);
    if (memoryKeys) {
      memoryKeys.forEach(key => {
        this.memoryCache.delete(key);
        deletedCount++;
      });
      this.memoryKeySets.delete(setKey);
      logger.debug(`📦 Memory cache cleared namespace: ${namespace} (${memoryKeys.size} keys)`);
    }

    return deletedCount;
  }

  /**
   * Delete multiple keys matching a pattern (DEPRECATED - use delNamespace instead)
   * @deprecated Use delNamespace() with proper namespace tracking for better performance
   */
  async delPattern(pattern: string): Promise<void> {
    logger.warn(`⚠️  delPattern() is deprecated. Use delNamespace() instead for better performance.`);
    
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
   * Get all keys in a namespace
   */
  async getNamespaceKeys(namespace: CacheNamespace | string): Promise<string[]> {
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const setKey = this.getSetKey(namespace);
          return await redis.smembers(setKey);
        }
      } catch (error) {
        logger.warn(`Redis getNamespaceKeys error for ${namespace}:`, error);
      }
    }

    // Fallback to memory cache
    const setKey = this.getSetKey(namespace);
    const memoryKeys = this.memoryKeySets.get(setKey);
    return memoryKeys ? Array.from(memoryKeys) : [];
  }

  /**
   * Get count of keys in a namespace
   */
  async getNamespaceSize(namespace: CacheNamespace | string): Promise<number> {
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const setKey = this.getSetKey(namespace);
          return await redis.scard(setKey);
        }
      } catch (error) {
        logger.warn(`Redis getNamespaceSize error for ${namespace}:`, error);
      }
    }

    // Fallback to memory cache
    const setKey = this.getSetKey(namespace);
    return this.memoryKeySets.get(setKey)?.size || 0;
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

