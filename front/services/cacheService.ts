/**
 * Centralized Cache Service
 * Provides consistent caching behavior across all screens using AsyncStorage
 * with timestamp support and TTL validation.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { calendarStorageKey } from '../utils/calendarTimezone';

// Cache key prefix to identify cache entries
const CACHE_PREFIX = '@cache_';

/** Other AsyncStorage namespaces that bloat the shared SQLite DB. */
const OFFLINE_PREFIX = '@offline_';
const ARCHIVE_PREFIX = '@match_archive_';

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

// Maximum number of cache entries (for LRU eviction)
// ✅ Reduced to prevent SQLITE_FULL errors on low-storage devices
const MAX_CACHE_ENTRIES = 40;

/** Cap how many match-day calendars stay on disk (each can be hundreds of KB). */
const MAX_PINNED_MATCH_DAYS = 3;

/**
 * Skip AsyncStorage when a single entry is this large.
 * A full day calendar (~800 fixtures) routinely exceeds this; memory + network refetch is safer.
 */
const MAX_DISK_PAYLOAD_BYTES = 180_000;

function isStorageFullError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? '');
  return msg.includes('SQLITE_FULL') || msg.includes('database or disk is full');
}

/** Keep the matches calendar on disk across app kills — scores overlay separately. */
export const MATCHES_CALENDAR_DISK_TTL_MS = 6 * 60 * 60 * 1000;

/** Past-date calendar disk TTL — capped so stale schedules do not live forever (C3). */
export const MATCHES_PAST_DISK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function logicalKeyFromStorageKey(storageKey: string): string {
  return storageKey.startsWith(CACHE_PREFIX) ? storageKey.slice(CACHE_PREFIX.length) : storageKey;
}

/** Fixture lists must survive TTL cleanup / LRU or the scores tab cold-starts empty. */
function isPinnedLogicalKey(logicalKey: string): boolean {
  return (
    logicalKey.startsWith('matches_') ||
    logicalKey.startsWith('matches_by_date_') ||
    logicalKey.startsWith('wc_matches_') ||
    logicalKey.startsWith('wc_phase_')
  );
}

/**
 * Module-level in-memory store for large object caches (e.g. reels feed).
 * AsyncStorage only stores IDs + metadata for these keys; full objects live here.
 * This avoids large JSON serialization on Android which blocks the JS thread.
 *
 * Key: cache key string  →  Value: { data: T; timestamp: number; ttl: number }
 */
const memoryStore = new Map<string, { data: any; timestamp: number; ttl: number }>();

/**
 * Keys that should use the memory-first strategy (IDs in AsyncStorage, data in memory).
 * Add any key here whose payload is a large array of objects.
 */
const MEMORY_FIRST_KEYS = new Set<string>(['reels_feed']);

/**
 * Storage key → write timestamp. Lets LRU eviction sort without re-reading and
 * JSON.parse-ing every entry (day calendars are ~200KB each) on the JS thread.
 */
const writeTimestampIndex = new Map<string, number>();
const EVICTION_MIN_INTERVAL_MS = 60_000;
let lastEvictionAt = 0;

/**
 * Cache entry structure with timestamp and TTL support
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  lastUpdated?: number; // Track when data was last successfully updated
}

/**
 * Slim AsyncStorage entry for memory-first keys.
 * Stores only IDs + metadata so the serialized payload stays small.
 */
interface SlimCacheEntry {
  ids: string[];
  timestamp: number;
  ttl: number;
  meta?: Record<string, any>; // nextCursor, hasMore, cachedAt, etc.
}
/**
 * Cache TTL configuration for different data types
 */
export const CACHE_TTL = {
  PROFILE: 5 * 60 * 1000,           // 5 minutes
  REELS: 2 * 60 * 1000,             // 2 minutes
  NOTIFICATIONS: 1 * 60 * 1000,     // 1 minute
  MATCHES: 30 * 60 * 1000,          // 30 minutes
  // Long-term cache for static data (shared across all users)
  TEAMS: 7 * 24 * 60 * 60 * 1000,   // 7 days - team info rarely changes
  PLAYERS: 24 * 60 * 60 * 1000,     // 24 hours - player info
  LEAGUES: 7 * 24 * 60 * 60 * 1000, // 7 days - league info
  LOGOS: 30 * 24 * 60 * 60 * 1000,  // 30 days - logos never change
  SEARCH: 24 * 60 * 60 * 1000,      // 24 hours - search results
  STANDINGS: 60 * 60 * 1000,        // 1 hour - standings update frequently
  H2H: 7 * 24 * 60 * 60 * 1000,     // 7 days - historical h2h
} as const;

/**
 * Predefined cache keys for consistency
 * NOTE: For user-specific data, append user ID to the key
 */
export const CACHE_KEYS = {
  PROFILE_DATA: 'profile_data', // Append user ID: profile_data_<userId>
  PROFILE_STATS: 'profile_stats', // Append user ID: profile_stats_<userId>
  PROFILE_VIDEOS: 'profile_videos', // Append user ID: profile_videos_<userId>
  PROFILE_COMPLETION: 'profile_completion', // Append user ID: profile_completion_<userId>
  REELS_FEED: 'reels_feed',
  NOTIFICATIONS: 'notifications', // Append user ID: notifications_<userId>
  MATCHES: 'matches',
  MATCHES_BY_DATE: 'matches_by_date', // New: cache matches by date
  // Football data keys
  TEAMS: 'teams',
  PLAYERS: 'players',
  LEAGUES: 'leagues',
  SEARCH: 'search',
  STANDINGS: 'standings',
  H2H: 'h2h',
  /** FIFA World Cup league logo URL — long-lived for campaign UI */
  WORLD_CUP_LOGO: 'world_cup_league_logo',
} as const;

/**
 * Helper function to create user-specific cache key
 * @param baseKey - Base cache key from CACHE_KEYS
 * @param userId - User ID to append
 * @returns User-specific cache key
 */
export function getUserCacheKey(baseKey: string, userId: string): string {
  return `${baseKey}_${userId}`;
}

class CacheService {
  /**
   * Get cached data by key.
   * Returns null if data doesn't exist or has expired.
   * 
   * Requirement 4.2: Return data if it exists and is not expired
   * Requirement 4.3: Return null if data has expired
   * 
   * @param allowStale - If true, return stale data even if expired
   */
  async get<T>(key: string, allowStale: boolean = false): Promise<T | null> {
    // Session memory (oversized disk-skipped entries + memory-first keys)
    const memHit = memoryStore.get(key);
    if (memHit) {
      const age = Date.now() - memHit.timestamp;
      if (age <= memHit.ttl || allowStale) {
        return memHit.data as T;
      }
      memoryStore.delete(key);
    }

    // ── Memory-first path for large object caches ──────────────────────────
    if (MEMORY_FIRST_KEYS.has(key)) {
      // Try to rehydrate from AsyncStorage slim entry
      try {
        const cacheKey = this.getCacheKey(key);
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) {
          const slim: SlimCacheEntry = JSON.parse(raw);
          const age = Date.now() - slim.timestamp;
          if (age <= slim.ttl || allowStale) {
            // We only have IDs — reconstruct a minimal object so callers
            // can at least check hasMore / nextCursor while fresh data loads.
            const rehydrated = { ...(slim.meta || {}), ids: slim.ids } as unknown as T;
            memoryStore.set(key, { data: rehydrated, timestamp: slim.timestamp, ttl: slim.ttl });
            return rehydrated;
          }
        }
      } catch {
        // Silent fail — fresh fetch will follow
      }
      return null;
    }
    // ── Standard AsyncStorage path ─────────────────────────────────────────
    try {
      const cacheKey = this.getCacheKey(key);
      const raw = await AsyncStorage.getItem(cacheKey);
      
      if (!raw) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(raw);
      const now = Date.now();
      const age = now - entry.timestamp;

      // Check if cache has expired
      if (age > entry.ttl) {
        // If allowStale is true, return stale data
        if (allowStale) {
          return entry.data;
        }
        // Cache expired, return null (don't delete here to allow background refresh)
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`[CacheService] Error getting cache for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Store data in cache with timestamp and TTL.
   * Implements LRU eviction when cache exceeds limits.
   * 
   * Requirement 4.1: Store data with timestamp
   * Requirement 4.4: Remove oldest entries when cache exceeds limits
   */
  async set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
    // ── Memory-first path for large object caches ──────────────────────────
    if (MEMORY_FIRST_KEYS.has(key)) {
      const now = Date.now();
      // Always store full data in memory
      memoryStore.set(key, { data, timestamp: now, ttl });

      // Persist only IDs + metadata to AsyncStorage to keep the payload tiny
      try {
        const cacheKey = this.getCacheKey(key);
        const dataAsAny = data as any;

        // Extract IDs — works for reels feed ({ reels: [...] }) and plain arrays
        let ids: string[] = [];
        if (Array.isArray(dataAsAny)) {
          ids = dataAsAny.map((item: any) => item?.id).filter(Boolean);
        } else if (Array.isArray(dataAsAny?.reels)) {
          ids = dataAsAny.reels.map((item: any) => item?.id).filter(Boolean);
        }

        // Capture non-array metadata fields (nextCursor, hasMore, cachedAt, …)
        const meta: Record<string, any> = {};
        if (dataAsAny && typeof dataAsAny === 'object' && !Array.isArray(dataAsAny)) {
          for (const k of Object.keys(dataAsAny)) {
            if (k !== 'reels') meta[k] = dataAsAny[k];
          }
        }

        const slim: SlimCacheEntry = { ids, timestamp: now, ttl, meta };
        const slimJson = JSON.stringify(slim);
        await this.writeToDisk(cacheKey, slimJson, now);
        await this.evictIfNeeded();
      } catch (error: any) {
        // Storage errors are non-critical — data is already in memory
        if (isStorageFullError(error)) {
          await this.recoverFromStorageFull();
        } else {
          console.warn(`[CacheService] AsyncStorage slim-write failed for "${key}":`, error?.message);
        }
      }
      return;
    }
    // ── Standard AsyncStorage path ─────────────────────────────────────────
    const cacheKey = this.getCacheKey(key);
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      lastUpdated: now,
    };
    const serialized = JSON.stringify(entry);

    // Oversized calendars (e.g. 800+ fixtures) fill SQLite; keep session memory only.
    if (serialized.length > MAX_DISK_PAYLOAD_BYTES) {
      memoryStore.set(key, { data, timestamp: now, ttl });
      console.warn(
        `[CacheService] Skipping disk for "${key}" (${serialized.length} bytes > ${MAX_DISK_PAYLOAD_BYTES})`,
      );
      return;
    }

    try {
      await this.writeToDisk(cacheKey, serialized, now);
      await this.evictIfNeeded();
    } catch (error: any) {
      if (isStorageFullError(error)) {
        console.warn(`[CacheService] ⚠️ Storage full! Emergency purge...`);
        await this.recoverFromStorageFull();
        try {
          await this.writeToDisk(cacheKey, serialized, now);
          console.log(`[CacheService] ✅ Retry successful after emergency purge`);
        } catch (retryError) {
          // Keep in memory so the current session still works
          memoryStore.set(key, { data, timestamp: now, ttl });
          console.warn(
            `[CacheService] Disk write skipped after purge for "${key}":`,
            (retryError as any)?.message ?? retryError,
          );
        }
      } else {
        console.error(`[CacheService] Error setting cache for key "${key}":`, error);
      }
    }
  }

  /**
   * Wipe cache / offline / archive namespaces that share AsyncStorage's SQLite DB.
   * Safe to call on SQLITE_FULL — data can be refetched.
   */
  async recoverFromStorageFull(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const toRemove = allKeys.filter(
        (k) =>
          k.startsWith(CACHE_PREFIX) ||
          k.startsWith(OFFLINE_PREFIX) ||
          k.startsWith(ARCHIVE_PREFIX),
      );
      if (toRemove.length > 0) {
        // Chunk removals — multiRemove of huge lists can itself stress SQLite
        const chunkSize = 50;
        for (let i = 0; i < toRemove.length; i += chunkSize) {
          await AsyncStorage.multiRemove(toRemove.slice(i, i + chunkSize));
        }
        console.log(`[CacheService] Emergency purged ${toRemove.length} storage keys`);
      }
      writeTimestampIndex.clear();
      lastEvictionAt = 0;
    } catch (error) {
      console.error('[CacheService] Emergency purge failed:', error);
    }
  }

  /** Write one key; on SQLITE_FULL rethrow so callers can purge + retry. */
  private async writeToDisk(cacheKey: string, serialized: string, timestamp: number): Promise<void> {
    await AsyncStorage.setItem(cacheKey, serialized);
    writeTimestampIndex.set(cacheKey, timestamp);
  }

  /**
   * Invalidate (remove) a specific cache entry.
   */
  async invalidate(key: string): Promise<void> {
    // Clear from memory store if present
    memoryStore.delete(key);
    try {
      const cacheKey = this.getCacheKey(key);
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error(`[CacheService] Error invalidating cache for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Remove all cache entries whose logical key starts with prefix (e.g. wc_matches_).
   */
  async invalidateByPrefix(prefix: string): Promise<number> {
    let removed = 0;
    for (const key of [...memoryStore.keys()]) {
      if (key.startsWith(prefix)) {
        memoryStore.delete(key);
        removed += 1;
      }
    }
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const toRemove = allKeys.filter((fullKey) => {
        if (!fullKey.startsWith(CACHE_PREFIX)) return false;
        const logical = fullKey.slice(CACHE_PREFIX.length);
        return logical.startsWith(prefix);
      });
      if (toRemove.length > 0) {
        await AsyncStorage.multiRemove(toRemove);
        removed += toRemove.length;
      }
    } catch (error) {
      console.error(`[CacheService] Error invalidating prefix "${prefix}":`, error);
    }
    return removed;
  }

  /**
   * Clean up all expired / oversized cache entries.
   * Should be called on app start.
   */
  async cleanup(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));
      
      const now = Date.now();
      const keysToRemove: string[] = [];
      const pinnedKept: Array<{ key: string; timestamp: number }> = [];

      for (const cacheKey of cacheKeys) {
        try {
          const raw = await AsyncStorage.getItem(cacheKey);
          if (!raw) continue;

          // Drop blobs that already blow the SQLite budget
          if (raw.length > MAX_DISK_PAYLOAD_BYTES) {
            keysToRemove.push(cacheKey);
            continue;
          }

          const entry: CacheEntry<unknown> = JSON.parse(raw);
          const age = now - entry.timestamp;
          const logical = logicalKeyFromStorageKey(cacheKey);
          const pinned = isPinnedLogicalKey(logical);

          if (age > entry.ttl && !pinned) {
            keysToRemove.push(cacheKey);
          } else if (pinned) {
            pinnedKept.push({
              key: cacheKey,
              timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : 0,
            });
          }
        } catch {
          // If we can't parse the entry, remove it
          keysToRemove.push(cacheKey);
        }
      }

      // Keep only the newest match calendars on disk
      if (pinnedKept.length > MAX_PINNED_MATCH_DAYS) {
        pinnedKept.sort((a, b) => a.timestamp - b.timestamp);
        for (const e of pinnedKept.slice(0, pinnedKept.length - MAX_PINNED_MATCH_DAYS)) {
          keysToRemove.push(e.key);
        }
      }

      if (keysToRemove.length > 0) {
        const unique = [...new Set(keysToRemove)];
        await AsyncStorage.multiRemove(unique);
        for (const k of unique) writeTimestampIndex.delete(k);
        console.log(`[CacheService] Cleaned up ${unique.length} cache entries`);
      }
    } catch (error) {
      console.error('[CacheService] Error during cleanup:', error);
    }
  }

  /**
   * Get all cache keys matching a pattern.
   */
  async getKeys(pattern?: string): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys
        .filter(key => key.startsWith(CACHE_PREFIX))
        .map(key => key.replace(CACHE_PREFIX, ''));

      if (pattern) {
        return cacheKeys.filter(key => key.includes(pattern));
      }

      return cacheKeys;
    } catch (error) {
      console.error('[CacheService] Error getting keys:', error);
      return [];
    }
  }

  /**
   * Check if a cache entry exists and is valid (not expired).
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Get cache entry metadata (timestamp, ttl, lastUpdated) without the data.
   * Useful for showing "last updated" indicators in UI.
   */
  async getMetadata(key: string): Promise<{ timestamp: number; ttl: number; lastUpdated?: number; isStale: boolean } | null> {
    try {
      const cacheKey = this.getCacheKey(key);
      const raw = await AsyncStorage.getItem(cacheKey);
      
      if (!raw) {
        return null;
      }

      const entry: CacheEntry<unknown> = JSON.parse(raw);
      const now = Date.now();
      const age = now - entry.timestamp;
      const isStale = age > entry.ttl;
      
      return {
        timestamp: entry.timestamp,
        ttl: entry.ttl,
        lastUpdated: entry.lastUpdated,
        isStale,
      };
    } catch (error) {
      console.error(`[CacheService] Error getting metadata for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Clear all cache entries.
   */
  async clearAll(): Promise<void> {
    // Clear memory store
    memoryStore.clear();
    writeTimestampIndex.clear();
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`[CacheService] Cleared ${cacheKeys.length} cache entries`);
      }
    } catch (error) {
      console.error('[CacheService] Error clearing all cache:', error);
      throw error;
    }
  }

  /**
   * Clear all search cache entries.
   * Useful when search format changes.
   */
  async clearSearchCache(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const searchKeys = allKeys.filter(key => key.includes(CACHE_KEYS.SEARCH));
      
      if (searchKeys.length > 0) {
        await AsyncStorage.multiRemove(searchKeys);
        console.log(`[CacheService] Cleared ${searchKeys.length} search cache entries`);
      }
    } catch (error) {
      console.error('[CacheService] Error clearing search cache:', error);
    }
  }

  /**
   * Generate the full cache key with prefix.
   */
  private getCacheKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  /**
   * Evict oldest cache entries when cache exceeds maximum size.
   * Implements LRU (Least Recently Used) eviction strategy based on timestamp.
   * 
   * Requirement 4.4: Remove oldest entries first when cache exceeds limits
   */
  private async evictIfNeeded(maxEntries: number = MAX_CACHE_ENTRIES): Promise<void> {
    // Routine writes evict at most once a minute; emergency paths pass a
    // smaller cap and must run immediately.
    const routine = maxEntries === MAX_CACHE_ENTRIES;
    const now = Date.now();
    if (routine && now - lastEvictionAt < EVICTION_MIN_INTERVAL_MS) return;
    if (routine) lastEvictionAt = now;
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));

      const entriesWithTimestamp: Array<{ key: string; timestamp: number }> = [];
      const unindexed: string[] = [];
      for (const cacheKey of cacheKeys) {
        const ts = writeTimestampIndex.get(cacheKey);
        if (ts != null) entriesWithTimestamp.push({ key: cacheKey, timestamp: ts });
        else unindexed.push(cacheKey);
      }

      // Entries written in a previous session: read once, then remember.
      if (unindexed.length > 0) {
        const pairs = await AsyncStorage.multiGet(unindexed);
        for (const [cacheKey, raw] of pairs) {
          let timestamp = 0;
          try {
            if (raw) {
              const parsed = JSON.parse(raw) as { timestamp?: number };
              timestamp = typeof parsed.timestamp === 'number' ? parsed.timestamp : 0;
            }
          } catch {
            timestamp = 0;
          }
          writeTimestampIndex.set(cacheKey, timestamp);
          entriesWithTimestamp.push({ key: cacheKey, timestamp });
        }
      }

      const keysToRemove = new Set<string>();

      // Always trim excess match calendars — they dominate disk usage.
      const pinned = entriesWithTimestamp
        .filter((e) => isPinnedLogicalKey(logicalKeyFromStorageKey(e.key)))
        .sort((a, b) => a.timestamp - b.timestamp);
      if (pinned.length > MAX_PINNED_MATCH_DAYS) {
        for (const e of pinned.slice(0, pinned.length - MAX_PINNED_MATCH_DAYS)) {
          keysToRemove.add(e.key);
        }
      }

      const remaining = entriesWithTimestamp.filter((e) => !keysToRemove.has(e.key));
      if (remaining.length > maxEntries) {
        // Prefer evicting non-pinned first; then oldest pinned if still over cap.
        remaining.sort((a, b) => {
          const aPinned = isPinnedLogicalKey(logicalKeyFromStorageKey(a.key));
          const bPinned = isPinnedLogicalKey(logicalKeyFromStorageKey(b.key));
          if (aPinned !== bPinned) return aPinned ? 1 : -1;
          return a.timestamp - b.timestamp;
        });
        const over = remaining.length - maxEntries;
        for (const e of remaining.slice(0, over)) {
          keysToRemove.add(e.key);
        }
      }

      if (keysToRemove.size > 0) {
        const list = [...keysToRemove];
        await AsyncStorage.multiRemove(list);
        for (const k of list) writeTimestampIndex.delete(k);
        console.log(`[CacheService] Evicted ${list.length} oldest cache entries`);
      }
    } catch (error) {
      console.error('[CacheService] Error during eviction:', error);
    }
  }

  /**
   * Get the maximum number of cache entries allowed.
   * Exposed for testing purposes.
   */
  getMaxCacheEntries(): number {
    return MAX_CACHE_ENTRIES;
  }

  // ============================================
  // FOOTBALL DATA CACHING METHODS
  // ============================================

  /**
   * Cache a team's data for long-term storage.
   * Teams data rarely changes, so we cache for 7 days.
   */
  async cacheTeam(teamId: number, teamData: any): Promise<void> {
    const key = `${CACHE_KEYS.TEAMS}_${teamId}`;
    await this.set(key, teamData, CACHE_TTL.TEAMS);
  }

  /**
   * Get cached team data.
   */
  async getTeam(teamId: number): Promise<any | null> {
    const key = `${CACHE_KEYS.TEAMS}_${teamId}`;
    return this.get(key);
  }

  /**
   * Cache a player's data.
   */
  async cachePlayer(playerId: number, playerData: any): Promise<void> {
    const key = `${CACHE_KEYS.PLAYERS}_${playerId}`;
    await this.set(key, playerData, CACHE_TTL.PLAYERS);
  }

  /**
   * Get cached player data.
   */
  async getPlayer(playerId: number): Promise<any | null> {
    const key = `${CACHE_KEYS.PLAYERS}_${playerId}`;
    return this.get(key);
  }

  /**
   * Cache league data.
   */
  async cacheLeague(leagueId: number, leagueData: any): Promise<void> {
    const key = `${CACHE_KEYS.LEAGUES}_${leagueId}`;
    await this.set(key, leagueData, CACHE_TTL.LEAGUES);
  }

  /**
   * Get cached league data.
   */
  async getLeague(leagueId: number): Promise<any | null> {
    const key = `${CACHE_KEYS.LEAGUES}_${leagueId}`;
    return this.get(key);
  }

  /**
   * Cache search results for a query.
   * This allows users to find previously searched items instantly.
   */
  async cacheSearchResults(query: string, results: any): Promise<void> {
    const normalizedQuery = query.toLowerCase().trim();
    const key = `${CACHE_KEYS.SEARCH}_${normalizedQuery}`;
    await this.set(key, results, CACHE_TTL.SEARCH);
  }

  /**
   * Get cached search results.
   * Validates format and clears old cache if format is incorrect.
   */
  async getSearchResults(query: string): Promise<any | null> {
    const normalizedQuery = query.toLowerCase().trim();
    const key = `${CACHE_KEYS.SEARCH}_${normalizedQuery}`;
    const cached = await this.get(key);
    
    if (!cached) return null;
    
    // Validate the cache format - matches should be an object with live/upcoming/finished
    // If it's an array (old format), clear the cache and return null
    if (typeof cached === 'object' && cached !== null && 'matches' in cached && Array.isArray(cached.matches)) {
      console.log(`🗑️ Clearing old search cache format for "${query}"`);
      await this.invalidate(key);
      return null;
    }
    
    return cached;
  }

  /**
   * Cache standings for a league.
   */
  async cacheStandings(leagueId: number, season: number, standings: any): Promise<void> {
    const key = `${CACHE_KEYS.STANDINGS}_${leagueId}_${season}`;
    await this.set(key, standings, CACHE_TTL.STANDINGS);
  }

  /**
   * Get cached standings.
   */
  async getStandings(leagueId: number, season: number): Promise<any | null> {
    const key = `${CACHE_KEYS.STANDINGS}_${leagueId}_${season}`;
    return this.get(key);
  }

  /**
   * Cache head-to-head data between two teams.
   */
  async cacheH2H(team1Id: number, team2Id: number, h2hData: any): Promise<void> {
    // Always use smaller ID first for consistent key
    const [id1, id2] = team1Id < team2Id ? [team1Id, team2Id] : [team2Id, team1Id];
    const key = `${CACHE_KEYS.H2H}_${id1}_${id2}`;
    await this.set(key, h2hData, CACHE_TTL.H2H);
  }

  /**
   * Get cached head-to-head data.
   */
  async getH2H(team1Id: number, team2Id: number): Promise<any | null> {
    const [id1, id2] = team1Id < team2Id ? [team1Id, team2Id] : [team2Id, team1Id];
    const key = `${CACHE_KEYS.H2H}_${id1}_${id2}`;
    return this.get(key);
  }

  /**
   * Cache match/fixture data.
   */
  async cacheMatch(fixtureId: number, matchData: any): Promise<void> {
    const key = `${CACHE_KEYS.MATCHES}_${fixtureId}`;
    // Use longer TTL for finished matches
    const ttl = matchData?.fixture?.status?.short === 'FT' 
      ? CACHE_TTL.H2H  // 7 days for finished matches
      : CACHE_TTL.MATCHES; // 30 minutes for live/upcoming
    await this.set(key, matchData, ttl);
  }

  /**
   * Get cached match data.
   */
  async getMatch(fixtureId: number): Promise<any | null> {
    const key = `${CACHE_KEYS.MATCHES}_${fixtureId}`;
    return this.get(key);
  }

  /**
   * Cache matches for a specific date.
   * Past dates are cached for 7 days (C3).
   * Today's matches use MATCHES_CALENDAR_DISK_TTL_MS.
   * Future dates are cached for 3 days.
   */
  async cacheMatchesByDate(dateString: string, matches: any[], ttl?: number): Promise<void> {
    const key = `${CACHE_KEYS.MATCHES}_${calendarStorageKey(dateString)}`;
    
    // Use provided TTL, or determine TTL based on date
    let cacheTTL: number;
    
    if (ttl !== undefined) {
      cacheTTL = ttl;
    } else {
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      if (dateString < todayKey) {
        cacheTTL = MATCHES_PAST_DISK_TTL_MS;
      } else if (dateString === todayKey) {
        // Calendar snapshot — live scores come from the live feed / WS overlay.
        cacheTTL = MATCHES_CALENDAR_DISK_TTL_MS;
      } else {
        // Future dates - cache for 3 days (schedule rarely changes)
        cacheTTL = 3 * 24 * 60 * 60 * 1000; // 3 days
      }
    }
    
    await this.set(key, matches, cacheTTL);
  }

  /**
   * Get cached matches for a specific date.
   * Defaults to allowing stale snapshots so a killed app can paint instantly.
   */
  async getMatchesByDate(dateString: string, allowStale: boolean = true): Promise<any[] | null> {
    const storageDay = calendarStorageKey(dateString);
    const unifiedKey = `${CACHE_KEYS.MATCHES}_${storageDay}`;
    const legacyKey = `${CACHE_KEYS.MATCHES_BY_DATE}_${storageDay}`;
    const unified = await this.get<any[]>(unifiedKey, allowStale);
    if (unified && unified.length > 0) return unified;
    return this.get<any[]>(legacyKey, allowStale);
  }

  /**
   * Batch cache multiple items at once.
   * More efficient than caching one by one.
   */
  async batchCache(items: Array<{ key: string; data: any; ttl?: number }>): Promise<void> {
    // Evict BEFORE inserting to prevent SQLITE_FULL
    await this.evictIfNeeded();

    const entries: [string, string][] = [];
    for (const item of items) {
      const cacheKey = this.getCacheKey(item.key);
      const now = Date.now();
      const entry: CacheEntry<any> = {
        data: item.data,
        timestamp: now,
        ttl: item.ttl || DEFAULT_TTL,
      };
      const serialized = JSON.stringify(entry);
      if (serialized.length > MAX_DISK_PAYLOAD_BYTES) {
        memoryStore.set(item.key, { data: item.data, timestamp: now, ttl: entry.ttl });
        continue;
      }
      entries.push([cacheKey, serialized]);
    }

    if (entries.length === 0) return;

    try {
      // Limit batch size to avoid overwhelming storage
      const maxBatchSize = 10;
      for (let i = 0; i < entries.length; i += maxBatchSize) {
        const chunk = entries.slice(i, i + maxBatchSize);
        await AsyncStorage.multiSet(chunk);
        for (const [cacheKey] of chunk) {
          writeTimestampIndex.set(cacheKey, Date.now());
        }
      }
    } catch (error: any) {
      if (isStorageFullError(error)) {
        console.warn(`[CacheService] ⚠️ Storage full in batch! Emergency purge...`);
        await this.recoverFromStorageFull();
      } else {
        console.warn('[CacheService] Error in batch cache:', error?.message);
      }
    }
  }

  /**
   * Get cache statistics for debugging.
   */
  async getStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    categories: Record<string, number>;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));
      
      const now = Date.now();
      let expiredCount = 0;
      const categories: Record<string, number> = {};

      for (const cacheKey of cacheKeys) {
        try {
          const raw = await AsyncStorage.getItem(cacheKey);
          if (raw) {
            const entry: CacheEntry<unknown> = JSON.parse(raw);
            const age = now - entry.timestamp;
            
            if (age > entry.ttl) {
              expiredCount++;
            }

            // Count by category
            const keyWithoutPrefix = cacheKey.replace(CACHE_PREFIX, '');
            const category = keyWithoutPrefix.split('_')[0];
            categories[category] = (categories[category] || 0) + 1;
          }
        } catch {
          expiredCount++;
        }
      }

      return {
        totalEntries: cacheKeys.length,
        expiredEntries: expiredCount,
        categories,
      };
    } catch (error) {
      console.error('[CacheService] Error getting stats:', error);
      return { totalEntries: 0, expiredEntries: 0, categories: {} };
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export class for testing purposes
export { CacheService };
