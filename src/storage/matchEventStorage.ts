import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../services/logger';

const EVENTS_KEY = '@match_events_snapshot';

export interface EventSnapshot {
    fixtureId: string;
    lastChecked: number; // timestamp
    events: Array<{
        id: string; // Unique identifier for the event (fixtureId + time + type + player)
        time: number;
        type: string;
        detail: string;
        player: string;
        team: string;
    }>;
}

/**
 * Storage utility for tracking match events to detect new events
 */
export const MatchEventStorage = {
    /**
     * Save the current snapshot of events for a match
     */
    async saveSnapshot(fixtureId: string, events: EventSnapshot['events']): Promise<void> {
        try {
            const allSnapshots = await this.getAllSnapshots();
            allSnapshots[fixtureId] = {
                fixtureId,
                lastChecked: Date.now(),
                events,
            };
            await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(allSnapshots));
        } catch (error) {
            logger.error('Error saving event snapshot:', error);
        }
    },

    /**
     * Get the last known snapshot for a match
     */
    async getSnapshot(fixtureId: string): Promise<EventSnapshot | null> {
        try {
            const allSnapshots = await this.getAllSnapshots();
            return allSnapshots[fixtureId] || null;
        } catch (error) {
            logger.error('Error getting event snapshot:', error);
            return null;
        }
    },

    /**
     * Get all snapshots
     */
    async getAllSnapshots(): Promise<Record<string, EventSnapshot>> {
        try {
            const data = await AsyncStorage.getItem(EVENTS_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            logger.error('Error getting all snapshots:', error);
            return {};
        }
    },

    /**
     * Clear snapshot for a specific match (when it finishes or is unfavorited)
     */
    async clearSnapshot(fixtureId: string): Promise<void> {
        try {
            const allSnapshots = await this.getAllSnapshots();
            delete allSnapshots[fixtureId];
            await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(allSnapshots));
        } catch (error) {
            logger.error('Error clearing snapshot:', error);
        }
    },

    /**
     * Clear all snapshots (cleanup)
     */
    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.removeItem(EVENTS_KEY);
        } catch (error) {
            logger.error('Error clearing all snapshots:', error);
        }
    },

    /**
     * Clean up old snapshots (older than 24 hours)
     */
    async cleanupOld(): Promise<void> {
        try {
            const allSnapshots = await this.getAllSnapshots();
            const now = Date.now();
            const DAY_MS = 24 * 60 * 60 * 1000;

            const cleaned = Object.entries(allSnapshots).reduce((acc, [id, snapshot]) => {
                if (now - snapshot.lastChecked < DAY_MS) {
                    acc[id] = snapshot;
                }
                return acc;
            }, {} as Record<string, EventSnapshot>);

            await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(cleaned));
        } catch (error) {
            logger.error('Error cleaning up old snapshots:', error);
        }
    },
};
