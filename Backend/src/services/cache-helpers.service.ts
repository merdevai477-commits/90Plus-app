/**
 * Cache Helper Functions
 * 
 * Provides convenient wrapper functions for common caching patterns
 * with automatic namespace management
 */

import { redisCacheService, CacheNamespace } from './redis-cache.service';
import { logger } from '../utils/logger';

/**
 * Profile Cache Helpers
 */
export class ProfileCacheHelper {
  private static namespace = CacheNamespace.PROFILE;
  private static TTL = 5 * 60 * 1000; // 5 minutes

  static async get<T>(userId: string): Promise<T | null> {
    const key = `profile:${userId}`;
    return await redisCacheService.get<T>(key);
  }

  static async set<T>(userId: string, data: T, ttl?: number): Promise<void> {
    const key = `profile:${userId}`;
    await redisCacheService.set(key, data, ttl || this.TTL, this.namespace);
  }

  static async del(userId: string): Promise<void> {
    const key = `profile:${userId}`;
    await redisCacheService.del(key, this.namespace);
  }

  static async clear(): Promise<number> {
    logger.info('Clearing all profile cache');
    return await redisCacheService.delNamespace(this.namespace);
  }

  static async getAll(): Promise<string[]> {
    return await redisCacheService.getNamespaceKeys(this.namespace);
  }

  static async count(): Promise<number> {
    return await redisCacheService.getNamespaceSize(this.namespace);
  }
}

/**
 * Search Cache Helpers
 */
export class SearchCacheHelper {
  private static namespace = CacheNamespace.SEARCH;
  private static TTL = 2 * 60 * 1000; // 2 minutes

  static async get<T>(cacheKey: string): Promise<T | null> {
    const key = `search:${cacheKey}`;
    return await redisCacheService.get<T>(key);
  }

  static async set<T>(cacheKey: string, data: T, limit?: number, ttl?: number): Promise<void> {
    const key = `search:${cacheKey}`;
    await redisCacheService.set(key, data, ttl || this.TTL, this.namespace);
  }

  static async del(cacheKey: string): Promise<void> {
    const key = `search:${cacheKey}`;
    await redisCacheService.del(key, this.namespace);
  }

  static async clear(): Promise<number> {
    logger.info('Clearing all search cache');
    return await redisCacheService.delNamespace(this.namespace);
  }

  static async getAll(): Promise<string[]> {
    return await redisCacheService.getNamespaceKeys(this.namespace);
  }

  static async count(): Promise<number> {
    return await redisCacheService.getNamespaceSize(this.namespace);
  }
}

/**
 * Stats Cache Helpers
 */
export class StatsCacheHelper {
  private static namespace = CacheNamespace.STATS;
  private static TTL = 5 * 60 * 1000; // 5 minutes

  static async get<T>(userId: string): Promise<T | null> {
    const key = `stats:${userId}`;
    return await redisCacheService.get<T>(key);
  }

  static async set<T>(userId: string, data: T, ttl?: number): Promise<void> {
    const key = `stats:${userId}`;
    await redisCacheService.set(key, data, ttl || this.TTL, this.namespace);
  }

  static async del(userId: string): Promise<void> {
    const key = `stats:${userId}`;
    await redisCacheService.del(key, this.namespace);
  }

  static async clear(): Promise<number> {
    logger.info('Clearing all stats cache');
    return await redisCacheService.delNamespace(this.namespace);
  }

  static async getAll(): Promise<string[]> {
    return await redisCacheService.getNamespaceKeys(this.namespace);
  }

  static async count(): Promise<number> {
    return await redisCacheService.getNamespaceSize(this.namespace);
  }
}

/**
 * Followers Cache Helpers
 */
export class FollowersCacheHelper {
  private static namespace = CacheNamespace.FOLLOWERS;
  private static TTL = 5 * 60 * 1000; // 5 minutes

  static async get<T>(userId: string, offset: number = 0): Promise<T | null> {
    const key = `followers:${userId}:${offset}`;
    return await redisCacheService.get<T>(key);
  }

  static async set<T>(userId: string, data: T, offset: number = 0, ttl?: number): Promise<void> {
    const key = `followers:${userId}:${offset}`;
    await redisCacheService.set(key, data, ttl || this.TTL, this.namespace);
  }

  static async del(userId: string, offset?: number): Promise<void> {
    if (offset !== undefined) {
      const key = `followers:${userId}:${offset}`;
      await redisCacheService.del(key, this.namespace);
    } else {
      // Delete all followers cache for this user
      await this.clearUser(userId);
    }
  }

  static async clearUser(userId: string): Promise<number> {
    logger.info(`Clearing followers cache for user: ${userId}`);
    const allKeys = await redisCacheService.getNamespaceKeys(this.namespace);
    const userKeys = allKeys.filter(key => key.startsWith(`followers:${userId}:`));
    
    let deletedCount = 0;
    for (const key of userKeys) {
      await redisCacheService.del(key, this.namespace);
      deletedCount++;
    }
    
    return deletedCount;
  }

  static async clear(): Promise<number> {
    logger.info('Clearing all followers cache');
    return await redisCacheService.delNamespace(this.namespace);
  }

  static async count(): Promise<number> {
    return await redisCacheService.getNamespaceSize(this.namespace);
  }
}

/**
 * Following Cache Helpers
 */
export class FollowingCacheHelper {
  private static namespace = CacheNamespace.FOLLOWING;
  private static TTL = 5 * 60 * 1000; // 5 minutes

  static async get<T>(userId: string, offset: number = 0): Promise<T | null> {
    const key = `following:${userId}:${offset}`;
    return await redisCacheService.get<T>(key);
  }

  static async set<T>(userId: string, data: T, offset: number = 0, ttl?: number): Promise<void> {
    const key = `following:${userId}:${offset}`;
    await redisCacheService.set(key, data, ttl || this.TTL, this.namespace);
  }

  static async del(userId: string, offset?: number): Promise<void> {
    if (offset !== undefined) {
      const key = `following:${userId}:${offset}`;
      await redisCacheService.del(key, this.namespace);
    } else {
      // Delete all following cache for this user
      await this.clearUser(userId);
    }
  }

  static async clearUser(userId: string): Promise<number> {
    logger.info(`Clearing following cache for user: ${userId}`);
    const allKeys = await redisCacheService.getNamespaceKeys(this.namespace);
    const userKeys = allKeys.filter(key => key.startsWith(`following:${userId}:`));
    
    let deletedCount = 0;
    for (const key of userKeys) {
      await redisCacheService.del(key, this.namespace);
      deletedCount++;
    }
    
    return deletedCount;
  }

  static async clear(): Promise<number> {
    logger.info('Clearing all following cache');
    return await redisCacheService.delNamespace(this.namespace);
  }

  static async count(): Promise<number> {
    return await redisCacheService.getNamespaceSize(this.namespace);
  }
}

/**
 * Reels Cache Helpers
 */
export class ReelsCacheHelper {
  private static namespace = CacheNamespace.REELS;
  private static TTL = 3 * 60 * 1000; // 3 minutes

  static async get<T>(key: string): Promise<T | null> {
    return await redisCacheService.get<T>(`reels:${key}`);
  }

  static async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    await redisCacheService.set(`reels:${key}`, data, ttl || this.TTL, this.namespace);
  }

  static async del(key: string): Promise<void> {
    await redisCacheService.del(`reels:${key}`, this.namespace);
  }

  static async clear(): Promise<number> {
    logger.info('Clearing all reels cache');
    return await redisCacheService.delNamespace(this.namespace);
  }

  static async count(): Promise<number> {
    return await redisCacheService.getNamespaceSize(this.namespace);
  }
}

/**
 * Profile Completion Cache Helpers
 */
export class ProfileCompletionCacheHelper {
  private static namespace = CacheNamespace.PROFILE_COMPLETION;
  private static TTL = 30 * 60 * 1000; // 30 minutes

  static async get<T>(userId: string): Promise<T | null> {
    const key = `completion:${userId}`;
    return await redisCacheService.get<T>(key);
  }

  static async set<T>(userId: string, data: T, ttl?: number): Promise<void> {
    const key = `completion:${userId}`;
    await redisCacheService.set(key, data, ttl || this.TTL, this.namespace);
  }

  static async del(userId: string): Promise<void> {
    const key = `completion:${userId}`;
    await redisCacheService.del(key, this.namespace);
  }

  static async clear(): Promise<number> {
    logger.info('Clearing all profile completion cache');
    return await redisCacheService.delNamespace(this.namespace);
  }

  static async getAll(): Promise<string[]> {
    return await redisCacheService.getNamespaceKeys(this.namespace);
  }

  static async count(): Promise<number> {
    return await redisCacheService.getNamespaceSize(this.namespace);
  }
}

/**
 * Generic Cache Helper for custom namespaces
 */
export class GenericCacheHelper {
  static async get<T>(namespace: string, key: string): Promise<T | null> {
    return await redisCacheService.get<T>(`${namespace}:${key}`);
  }

  static async set<T>(
    namespace: string,
    key: string,
    data: T,
    ttl: number
  ): Promise<void> {
    await redisCacheService.set(`${namespace}:${key}`, data, ttl, namespace);
  }

  static async del(namespace: string, key: string): Promise<void> {
    await redisCacheService.del(`${namespace}:${key}`, namespace);
  }

  static async clearNamespace(namespace: string): Promise<number> {
    logger.info(`Clearing cache namespace: ${namespace}`);
    return await redisCacheService.delNamespace(namespace);
  }

  static async getNamespaceKeys(namespace: string): Promise<string[]> {
    return await redisCacheService.getNamespaceKeys(namespace);
  }

  static async getNamespaceSize(namespace: string): Promise<number> {
    return await redisCacheService.getNamespaceSize(namespace);
  }
}

/**
 * Cache Statistics
 */
export class CacheStats {
  static async getAllStats(): Promise<{
    namespace: string;
    keyCount: number;
  }[]> {
    const namespaces = Object.values(CacheNamespace);
    const stats = [];

    for (const namespace of namespaces) {
      const count = await redisCacheService.getNamespaceSize(namespace);
      stats.push({
        namespace,
        keyCount: count,
      });
    }

    return stats;
  }

  static async getTotalKeys(): Promise<number> {
    const stats = await this.getAllStats();
    return stats.reduce((total, stat) => total + stat.keyCount, 0);
  }

  static async clearAll(): Promise<{
    namespace: string;
    deletedCount: number;
  }[]> {
    const namespaces = Object.values(CacheNamespace);
    const results = [];

    for (const namespace of namespaces) {
      const deletedCount = await redisCacheService.delNamespace(namespace);
      results.push({
        namespace,
        deletedCount,
      });
    }

    return results;
  }
}
