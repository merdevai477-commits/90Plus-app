/**
 * Server-driven football cache bust — no manual "clear cache" for users.
 * Bump FOOTBALL_CACHE_EPOCH on Railway to invalidate WC/match disk cache app-wide.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheService } from './cacheService';
import { logger } from '../utils/logger';

const EPOCH_STORAGE_KEY = 'football_cache_epoch_v1';

let memoryClearHook: (() => void) | null = null;

/** Registered by useWorldCupMatches to clear in-process WC list cache. */
export function registerWorldCupMemoryCacheClear(fn: () => void): void {
  memoryClearHook = fn;
}

export async function applyFootballCacheEpoch(serverEpoch: string | undefined): Promise<boolean> {
  const epoch = (serverEpoch?.trim() || '1');
  try {
    const stored = await AsyncStorage.getItem(EPOCH_STORAGE_KEY);
    if (stored === epoch) return false;

    const wc = await cacheService.invalidateByPrefix('wc_matches_');
    const matches = await cacheService.invalidateByPrefix('matches_');
    const legacy = await cacheService.invalidateByPrefix('matches_by_date_');
    memoryClearHook?.();

    await AsyncStorage.setItem(EPOCH_STORAGE_KEY, epoch);
    logger.info(
      `[FootballCache] Epoch ${stored ?? 'none'} → ${epoch}; cleared ${wc + matches + legacy} disk key(s)`,
    );
    return true;
  } catch (err) {
    logger.warn('[FootballCache] Epoch sync failed:', err);
    return false;
  }
}
