/**
 * Club Logo Service
 * 
 * Fetches real team logos from API-Football using team IDs
 * Caches logos locally for offline access
 */

import { cacheService } from './cacheService';
import { ApiFootballService } from './apiFootball';
import { logger } from '../utils/logger';
import { offlineDataService } from './offlineDataService';

const LOGO_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days - logos rarely change

/**
 * Get team logo from API-Football by team ID
 * ✅ Checks offline storage first (no token needed)
 * ✅ Falls back to API if not cached
 * ✅ Stores permanently for future use
 */
export async function getClubLogo(apiId: number): Promise<string | null> {
    if (!apiId) {
        return null;
    }

    // ✅ 1. Check offline storage first (permanent, no token needed)
    const offlineLogo = await offlineDataService.getClubLogo(apiId);
    if (offlineLogo) {
        logger.debug(`📦 Club logo ${apiId} from offline storage`);
        return offlineLogo;
    }

    // ✅ 2. Check cache service (temporary cache)
    const cacheKey = `club_logo_${apiId}`;
    const cached = await cacheService.get<string>(cacheKey);
    if (cached) {
        // Store in offline storage for permanent access
        await offlineDataService.storeClubLogo(apiId, cached);
        return cached;
    }

    // ✅ 3. Fetch from API (only if not cached)
    try {
        const teams = await ApiFootballService.getTeamById(apiId);
        
        if (teams && teams.length > 0) {
            const team = teams[0];
            const teamData = team.team || team;
            const logo = teamData?.logo;
            const teamName = teamData?.name;
            
            // ✅ Validate logo exists and is a valid URL (not placeholder)
            if (logo && typeof logo === 'string' && logo.length > 0 && 
                logo.startsWith('http') && 
                !logo.includes('placeholder') && // ✅ Reject placeholder URLs
                !logo.includes('via.placeholder')) {
                // ✅ Store in both cache and offline storage (permanent)
                await cacheService.set(cacheKey, logo, LOGO_CACHE_TTL);
                await offlineDataService.storeClubLogo(apiId, logo);
                logger.debug(`💾 Stored club logo ${apiId} (${teamName || 'unknown'}) permanently`);
                return logo;
            } else {
                logger.warn(`⚠️ Invalid or placeholder logo for team ${apiId} (${teamName || 'unknown'}): ${logo}`);
            }
        }
    } catch (error) {
        logger.error(`Failed to fetch logo for team ${apiId}:`, error);
    }

    return null;
}

/**
 * Batch fetch logos for multiple clubs
 */
export async function getClubLogos(apiIds: number[]): Promise<Map<number, string>> {
    const logoMap = new Map<number, string>();
    
    // Fetch all logos in parallel (with rate limiting consideration)
    const logoPromises = apiIds.map(async (apiId) => {
        const logo = await getClubLogo(apiId);
        if (logo) {
            logoMap.set(apiId, logo);
        }
    });

    await Promise.allSettled(logoPromises);
    
    return logoMap;
}

/**
 * Preload logos for all clubs (background task)
 */
export async function preloadClubLogos(clubs: Array<{ apiId?: number }>): Promise<void> {
    const apiIds = clubs
        .map(c => c.apiId)
        .filter((id): id is number => id !== undefined && id > 0);

    if (apiIds.length === 0) {
        return;
    }

    // Fetch in batches of 10 to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < apiIds.length; i += batchSize) {
        const batch = apiIds.slice(i, i + batchSize);
        await getClubLogos(batch).catch(err => {
            logger.warn(`Failed to preload logo batch:`, err);
        });
        
        // Small delay between batches
        if (i + batchSize < apiIds.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
}

/**
 * Clear cached logo for a specific team (force refresh)
 */
export async function clearClubLogoCache(apiId: number): Promise<void> {
    try {
        // Clear from cache service
        const cacheKey = `club_logo_${apiId}`;
        await cacheService.invalidate(cacheKey);
        
        // Clear from offline storage
        const { offlineDataService } = await import('./offlineDataService');
        const offlineKey = `@offline_club_logo_${apiId}`;
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.removeItem(offlineKey);
        
        logger.debug(`🗑️ Cleared logo cache for team ${apiId}`);
    } catch (error) {
        logger.error(`Failed to clear logo cache for team ${apiId}:`, error);
    }
}

/**
 * Clear all club logo caches (force refresh all)
 */
export async function clearAllClubLogoCache(): Promise<void> {
    try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const allKeys = await AsyncStorage.getAllKeys();
        const logoKeys = allKeys.filter(key => 
            key.startsWith('@offline_club_logo_') || 
            key.startsWith('club_logo_')
        );
        
        await AsyncStorage.multiRemove(logoKeys);
        logger.debug(`🗑️ Cleared ${logoKeys.length} club logo caches`);
    } catch (error) {
        logger.error('Failed to clear all club logo caches:', error);
    }
}

/**
 * Force refresh logo from API (ignore cache)
 */
export async function refreshClubLogo(apiId: number): Promise<string | null> {
    // Clear cache first
    await clearClubLogoCache(apiId);
    
    // Fetch fresh from API
    return await getClubLogo(apiId);
}


// Default export for convenience
export const clubLogoService = {
  getClubLogo,
  getClubLogos,
  preloadClubLogos,
  clearClubLogoCache,
  clearAllClubLogoCache,
  refreshClubLogo,
};

export default clubLogoService;
