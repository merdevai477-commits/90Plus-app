import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../services/logger';

const FAVORITES_KEY = '@match_favorites';
const FAVORITES_META_KEY = '@match_favorites_meta_v1';

export interface StoredFavoriteMatch {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    matchDate: string;
    leagueName?: string;
    leagueLogo?: string;
    status?: string;
    statusShort?: string;
}

const FINISHED_SHORT = new Set([
    'FT',
    'AET',
    'PEN',
    'AWD',
    'WO',
    'CANC',
    'ABD',
    'Aban',
    'PST',
    'SUSP',
]);

function normalizeMatch(raw: unknown): StoredFavoriteMatch | null {
    if (typeof raw === 'string' || typeof raw === 'number') {
        return {
            id: String(raw),
            homeTeam: 'Home',
            awayTeam: 'Away',
            matchDate: new Date().toISOString(),
        };
    }
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const id = String(row.id ?? row.apiMatchId ?? '');
    if (!id) return null;
    return {
        id,
        homeTeam: String(row.homeTeam ?? row.home ?? 'Home'),
        awayTeam: String(row.awayTeam ?? row.away ?? 'Away'),
        homeTeamLogo: (row.homeTeamLogo as string | undefined) ?? (row.homeLogo as string | undefined),
        awayTeamLogo: (row.awayTeamLogo as string | undefined) ?? (row.awayLogo as string | undefined),
        matchDate: String(row.matchDate ?? row.fixtureDate ?? new Date().toISOString()),
        leagueName: (row.leagueName as string | undefined) ?? undefined,
        leagueLogo: (row.leagueLogo as string | undefined) ?? undefined,
        status: (row.status as string | undefined) ?? undefined,
        statusShort: (row.statusShort as string | undefined) ?? undefined,
    };
}

export function isFavoriteMatchStillActive(match: StoredFavoriteMatch): boolean {
    const short = (match.statusShort || match.status || '').toUpperCase();
    if (FINISHED_SHORT.has(short) || short === 'FT' || match.status === 'FT') return false;
    // Drop rows whose kickoff was more than 6h ago and not marked live.
    const kickoff = Date.parse(match.matchDate);
    if (Number.isFinite(kickoff)) {
        const ageMs = Date.now() - kickoff;
        const looksLive = short === 'LIVE' || short === '1H' || short === '2H' || short === 'HT' || short === 'ET';
        if (!looksLive && ageMs > 6 * 60 * 60 * 1000) return false;
    }
    return true;
}

/**
 * Storage utility for managing match favorites (bell subscriptions).
 * Keeps a legacy ID list plus rich meta for the Favorites tab.
 */
export const MatchFavoritesStorage = {
    async addFavorite(matchId: string, meta?: Partial<StoredFavoriteMatch>): Promise<void> {
        try {
            const favorites = await this.getFavorites();
            if (!favorites.includes(matchId)) {
                favorites.push(matchId);
                await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
            }
            const existing = await this.getMatches();
            const next: StoredFavoriteMatch = {
                id: matchId,
                homeTeam: meta?.homeTeam ?? 'Home',
                awayTeam: meta?.awayTeam ?? 'Away',
                homeTeamLogo: meta?.homeTeamLogo,
                awayTeamLogo: meta?.awayTeamLogo,
                matchDate: meta?.matchDate ?? new Date().toISOString(),
                leagueName: meta?.leagueName,
                leagueLogo: meta?.leagueLogo,
                status: meta?.status,
                statusShort: meta?.statusShort,
            };
            const idx = existing.findIndex((m) => m.id === matchId);
            if (idx >= 0) existing[idx] = { ...existing[idx], ...next };
            else existing.push(next);
            await AsyncStorage.setItem(FAVORITES_META_KEY, JSON.stringify(existing));
        } catch (error) {
            logger.error('Error adding favorite:', error);
            throw error;
        }
    },

    async removeFavorite(matchId: string): Promise<void> {
        try {
            const favorites = await this.getFavorites();
            const filtered = favorites.filter((id) => id !== matchId);
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
            const matches = await this.getMatches();
            await AsyncStorage.setItem(
                FAVORITES_META_KEY,
                JSON.stringify(matches.filter((m) => m.id !== matchId)),
            );
        } catch (error) {
            logger.error('Error removing favorite:', error);
            throw error;
        }
    },

    async getFavorites(): Promise<string[]> {
        try {
            const data = await AsyncStorage.getItem(FAVORITES_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            logger.error('Error getting favorites:', error);
            return [];
        }
    },

    async getMatches(): Promise<StoredFavoriteMatch[]> {
        try {
            const raw = await AsyncStorage.getItem(FAVORITES_META_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed.map(normalizeMatch).filter(Boolean) as StoredFavoriteMatch[];
                }
            }
            const ids = await this.getFavorites();
            return ids.map((id) => normalizeMatch(id)).filter(Boolean) as StoredFavoriteMatch[];
        } catch (error) {
            logger.error('Error getting favorite match meta:', error);
            return [];
        }
    },

    async getActiveMatches(): Promise<StoredFavoriteMatch[]> {
        const matches = await this.getMatches();
        return matches.filter(isFavoriteMatchStillActive);
    },

    async isFavorite(matchId: string): Promise<boolean> {
        try {
            const favorites = await this.getFavorites();
            return favorites.includes(matchId);
        } catch (error) {
            logger.error('Error checking favorite:', error);
            return false;
        }
    },

    async setFavorites(matchIds: string[]): Promise<void> {
        try {
            const unique = [...new Set(matchIds.map(String))];
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(unique));
        } catch (error) {
            logger.error('Error setting favorites:', error);
            throw error;
        }
    },

    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.removeItem(FAVORITES_KEY);
            await AsyncStorage.removeItem(FAVORITES_META_KEY);
        } catch (error) {
            logger.error('Error clearing favorites:', error);
            throw error;
        }
    },
};
