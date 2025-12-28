import AsyncStorage from '@react-native-async-storage/async-storage';

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
            console.error('Error adding favorite:', error);
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
            console.error('Error removing favorite:', error);
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
            console.error('Error getting favorites:', error);
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
            console.error('Error checking favorite:', error);
            return false;
        }
    },

    /**
     * Clear all favorites
     */
    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.removeItem(FAVORITES_KEY);
        } catch (error) {
            console.error('Error clearing favorites:', error);
            throw error;
        }
    },
};
