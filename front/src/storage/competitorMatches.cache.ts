import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Competitor365Matches } from '../../services/apiFootball';
import { logger } from '../../services/logger';

const KEY_PREFIX = '@fav_competitor_matches_v1:';
/** Keep disk snapshots warm across sessions; React Query still revalidates. */
const DISK_TTL_MS = 30 * 60 * 1000;

type CacheEnvelope = {
    savedAt: number;
    data: Competitor365Matches;
};

function cacheKey(competitorId: number): string {
    return `${KEY_PREFIX}${competitorId}`;
}

function isValidPayload(raw: unknown): raw is Competitor365Matches {
    if (!raw || typeof raw !== 'object') return false;
    const row = raw as Record<string, unknown>;
    return (
        Array.isArray(row.live) &&
        Array.isArray(row.upcoming) &&
        Array.isArray(row.finished)
    );
}

/**
 * Disk cache for favorite-team match bundles so accordion expand paints
 * instantly from the previous visit while React Query refreshes in background.
 */
export const CompetitorMatchesCache = {
    async read(competitorId: number): Promise<Competitor365Matches | null> {
        if (!competitorId || competitorId <= 0) return null;
        try {
            const raw = await AsyncStorage.getItem(cacheKey(competitorId));
            if (!raw) return null;
            const parsed = JSON.parse(raw) as CacheEnvelope;
            if (!parsed?.savedAt || !isValidPayload(parsed.data)) return null;
            if (Date.now() - parsed.savedAt > DISK_TTL_MS) return null;
            return parsed.data;
        } catch (error) {
            logger.warn('CompetitorMatchesCache.read failed:', error);
            return null;
        }
    },

    async write(competitorId: number, data: Competitor365Matches): Promise<void> {
        if (!competitorId || competitorId <= 0) return;
        try {
            const envelope: CacheEnvelope = { savedAt: Date.now(), data };
            await AsyncStorage.setItem(cacheKey(competitorId), JSON.stringify(envelope));
        } catch (error) {
            logger.warn('CompetitorMatchesCache.write failed:', error);
        }
    },
};
