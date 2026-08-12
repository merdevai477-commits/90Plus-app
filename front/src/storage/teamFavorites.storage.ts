import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../services/logger';

const FAVORITES_KEY = '@team_favorites';

/**
 * Local (offline-first) store for followed team IDs. Mirrors
 * MatchFavoritesStorage so the follow UI stays instant while the backend
 * (dedicated FavoriteTeam table) is the source of truth once signed in.
 */
export const TeamFavoritesStorage = {
    async addFavorite(teamId: string): Promise<void> {
        try {
            const favorites = await this.getFavorites();
            if (!favorites.includes(teamId)) {
                favorites.push(teamId);
                await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
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

    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.removeItem(FAVORITES_KEY);
        } catch (error) {
            logger.error('Error clearing followed teams:', error);
            throw error;
        }
    },
};
