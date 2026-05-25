import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../services/logger';

const FAVORITES_KEY = '@match_favorites';

/**
 * Storage utility for managing match favorites
 */
export const MatchFavoritesStorage = {
    /**
     * Add a match to favorites
     */
    async addFavorite(matchId: string): Promise<void> {
        try {
            const favorites = await this.getFavorites();
            if (!favorites.includes(matchId)) {
                favorites.push(matchId);
                await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
            }
        } catch (error) {
            logger.error('Error adding favorite:', error);
            throw error;
        }
    },

    /**
     * Remove a match from favorites
     */
    async removeFavorite(matchId: string): Promise<void> {
        try {
            const favorites = await this.getFavorites();
            const filtered = favorites.filter(id => id !== matchId);
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
        } catch (error) {
            logger.error('Error removing favorite:', error);
            throw error;
        }
    },

    /**
     * Get all favorited match IDs
     */
    async getFavorites(): Promise<string[]> {
        try {
            const data = await AsyncStorage.getItem(FAVORITES_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            logger.error('Error getting favorites:', error);
            return [];
        }
    },

    /**
     * Check if a match is favorited
     */
    async isFavorite(matchId: string): Promise<boolean> {
        try {
            const favorites = await this.getFavorites();
            return favorites.includes(matchId);
        } catch (error) {
            logger.error('Error checking favorite:', error);
            return false;
        }
    },

    /**
     * Replace local favorites with server list (sync on app start).
     */
    async setFavorites(matchIds: string[]): Promise<void> {
        try {
            const unique = [...new Set(matchIds.map(String))];
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(unique));
        } catch (error) {
            logger.error('Error setting favorites:', error);
            throw error;
        }
    },

    /**
     * Clear all favorites
     */
    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.removeItem(FAVORITES_KEY);
        } catch (error) {
            logger.error('Error clearing favorites:', error);
            throw error;
        }
    },
};
