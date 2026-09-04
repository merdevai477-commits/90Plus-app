import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../services/logger';

const FAVORITES_KEY = '@team_favorites';
const FAVORITES_META_KEY = '@team_favorites_meta_v1';

/** Offline-first followed club / national team row. */
export interface StoredFollowedTeam {
    apiTeamId: number;
    teamName: string;
    teamLogo?: string | null;
    country?: string | null;
}

function normalizeTeam(raw: unknown): StoredFollowedTeam | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const id = Number(row.apiTeamId ?? row.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    return {
        apiTeamId: id,
        teamName: String(row.teamName ?? row.name ?? `Team ${id}`),
        teamLogo: (row.teamLogo as string | null | undefined) ?? null,
        country: (row.country as string | null | undefined) ?? null,
    };
}

/**
 * Local (offline-first) store for followed teams. IDs stay in `@team_favorites`
 * for backward compatibility; display metadata lives in `@team_favorites_meta_v1`
 * so the Favorites tab can paint instantly without waiting on the network.
 */
export const TeamFavoritesStorage = {
    async addFavorite(teamId: string, meta?: Partial<StoredFollowedTeam>): Promise<void> {
        try {
            const favorites = await this.getFavorites();
            if (!favorites.includes(teamId)) {
                favorites.push(teamId);
                await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
            }
            const id = Number(teamId);
            if (Number.isFinite(id) && id > 0) {
                await this.upsertTeam({
                    apiTeamId: id,
                    teamName: meta?.teamName ?? `Team ${id}`,
                    teamLogo: meta?.teamLogo ?? null,
                    country: meta?.country ?? null,
                });
            }
        } catch (error) {
            logger.error('Error adding followed team:', error);
            throw error;
        }
    },

    async removeFavorite(teamId: string): Promise<void> {
        try {
            const favorites = await this.getFavorites();
            const filtered = favorites.filter((id) => id !== teamId);
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
            const teams = await this.getTeams();
            const next = teams.filter((t) => String(t.apiTeamId) !== String(teamId));
            await AsyncStorage.setItem(FAVORITES_META_KEY, JSON.stringify(next));
        } catch (error) {
            logger.error('Error removing followed team:', error);
            throw error;
        }
    },

    async getFavorites(): Promise<string[]> {
        try {
            const data = await AsyncStorage.getItem(FAVORITES_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            logger.error('Error getting followed teams:', error);
            return [];
        }
    },

    async getTeams(): Promise<StoredFollowedTeam[]> {
        try {
            const raw = await AsyncStorage.getItem(FAVORITES_META_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed.map(normalizeTeam).filter(Boolean) as StoredFollowedTeam[];
                }
            }
            // Migrate bare ID list → placeholder meta so the UI still has rows.
            const ids = await this.getFavorites();
            const migrated = ids
                .map((id) => {
                    const n = Number(id);
                    if (!Number.isFinite(n) || n <= 0) return null;
                    return {
                        apiTeamId: n,
                        teamName: `Team ${n}`,
                        teamLogo: null,
                        country: null,
                    } satisfies StoredFollowedTeam;
                })
                .filter(Boolean) as StoredFollowedTeam[];
            if (migrated.length) {
                await AsyncStorage.setItem(FAVORITES_META_KEY, JSON.stringify(migrated));
            }
            return migrated;
        } catch (error) {
            logger.error('Error getting followed team meta:', error);
            return [];
        }
    },

    async upsertTeam(team: StoredFollowedTeam): Promise<void> {
        const teams = await this.getTeams();
        const idx = teams.findIndex((t) => t.apiTeamId === team.apiTeamId);
        if (idx >= 0) {
            teams[idx] = {
                ...teams[idx],
                teamName: team.teamName || teams[idx].teamName,
                teamLogo: team.teamLogo ?? teams[idx].teamLogo,
                country: team.country ?? teams[idx].country,
            };
        } else {
            teams.push(team);
        }
        await AsyncStorage.setItem(FAVORITES_META_KEY, JSON.stringify(teams));
    },

    async isFavorite(teamId: string): Promise<boolean> {
        try {
            const favorites = await this.getFavorites();
            return favorites.includes(teamId);
        } catch (error) {
            logger.error('Error checking followed team:', error);
            return false;
        }
    },

    /** Replace local list with the server list (sync on load). */
    async setFavorites(teamIds: string[]): Promise<void> {
        try {
            const unique = [...new Set(teamIds.map(String))];
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(unique));
        } catch (error) {
            logger.error('Error setting followed teams:', error);
            throw error;
        }
    },

    /** Replace ID list + metadata from server FollowedTeam rows. */
    async setTeams(teams: StoredFollowedTeam[]): Promise<void> {
        try {
            const cleaned = teams
                .map(normalizeTeam)
                .filter(Boolean) as StoredFollowedTeam[];
            const byId = new Map<number, StoredFollowedTeam>();
            for (const t of cleaned) byId.set(t.apiTeamId, t);
            const unique = [...byId.values()];
            await AsyncStorage.setItem(FAVORITES_META_KEY, JSON.stringify(unique));
            await AsyncStorage.setItem(
                FAVORITES_KEY,
                JSON.stringify(unique.map((t) => String(t.apiTeamId))),
            );
        } catch (error) {
            logger.error('Error setting followed team meta:', error);
            throw error;
        }
    },

    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.removeItem(FAVORITES_KEY);
            await AsyncStorage.removeItem(FAVORITES_META_KEY);
        } catch (error) {
            logger.error('Error clearing followed teams:', error);
            throw error;
        }
    },
};
