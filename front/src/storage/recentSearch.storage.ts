import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../services/logger';

const RECENT_SEARCH_KEY = '@football_recent_searches';
const MAX_RECENT = 12;

/**
 * Local store for recent football search queries (clubs / national teams / players).
 * Newest first, case-insensitive de-dupe, capped at MAX_RECENT.
 */
export const RecentSearchStorage = {
    async getRecent(): Promise<string[]> {
        try {
            const data = await AsyncStorage.getItem(RECENT_SEARCH_KEY);
            if (!data) return [];
            const parsed = JSON.parse(data);
            return Array.isArray(parsed)
                ? parsed.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
                : [];
        } catch (error) {
            logger.error('Error reading recent searches:', error);
            return [];
        }
    },

    async addRecent(query: string): Promise<string[]> {
        const trimmed = query.trim();
        if (trimmed.length < 2) return this.getRecent();
        try {
            const existing = await this.getRecent();
            const lower = trimmed.toLowerCase();
            const next = [trimmed, ...existing.filter((q) => q.toLowerCase() !== lower)].slice(
                0,
                MAX_RECENT,
            );
            await AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
            return next;
        } catch (error) {
            logger.error('Error saving recent search:', error);
            return [];
        }
    },

    async removeRecent(query: string): Promise<string[]> {
        try {
            const existing = await this.getRecent();
            const lower = query.trim().toLowerCase();
            const next = existing.filter((q) => q.toLowerCase() !== lower);
            await AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
            return next;
        } catch (error) {
            logger.error('Error removing recent search:', error);
            return [];
        }
    },

    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.removeItem(RECENT_SEARCH_KEY);
        } catch (error) {
            logger.error('Error clearing recent searches:', error);
        }
    },
};
