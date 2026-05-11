/**
 * Offline Pending Queue
 *
 * Simple durable queue backed by AsyncStorage. Predictions (and any future
 * offline-safe mutations) are enqueued here whenever the device is offline,
 * then drained by `useOfflineSync` when connectivity returns.
 *
 * Design notes:
 *  - Single key in AsyncStorage → atomic read/write of the full queue.
 *  - Writes are serialized through an in-memory promise chain so two
 *    concurrent enqueues never clobber each other.
 *  - Each item carries a stable `id` (nanoid) so `dequeue` can be idempotent
 *    and safe to call while a drain is in progress.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { nanoid } from 'nanoid/non-secure';

export const OFFLINE_QUEUE_STORAGE_KEY = 'offline_pending_queue_v1';

/**
 * Payload carried by a queued prediction. Keep it flat JSON-serializable —
 * it's persisted as-is to AsyncStorage.
 */
export interface QueuedPredictionPayload {
    userId: string;
    apiMatchId: string;
    predictionType: 'home' | 'draw' | 'away';
    homeTeam: string;
    awayTeam: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    matchDate: string;
    leagueName?: string;
}

export type QueuedItemType = 'PREDICTION';

export interface QueuedItem<TPayload = QueuedPredictionPayload> {
    id: string;
    type: QueuedItemType;
    payload: TPayload;
    createdAt: number;
    /** Incremented each time drain fails so we can cap retry attempts. */
    attempts?: number;
}

// Serialize all mutations through this promise so enqueue/dequeue/clear can't race.
let writeChain: Promise<void> = Promise.resolve();

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const next = writeChain.then(task, task);
    writeChain = next.then(() => undefined, () => undefined);
    return next;
}

async function readQueueRaw(): Promise<QueuedItem[]> {
    try {
        const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as QueuedItem[]) : [];
    } catch {
        return [];
    }
}

async function writeQueueRaw(items: QueuedItem[]): Promise<void> {
    await AsyncStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(items));
}

export const offlineQueue = {
    /**
     * Append an item to the end of the queue. Returns the generated id.
     */
    async enqueue(
        input: Omit<QueuedItem, 'id' | 'createdAt' | 'attempts'> & { id?: string },
    ): Promise<string> {
        return runExclusive(async () => {
            const id = input.id ?? nanoid();
            const items = await readQueueRaw();
            items.push({
                id,
                type: input.type,
                payload: input.payload,
                createdAt: Date.now(),
                attempts: 0,
            });
            await writeQueueRaw(items);
            return id;
        });
    },

    /**
     * Remove a single item by id (idempotent — no error if missing).
     */
    async dequeue(id: string): Promise<void> {
        return runExclusive(async () => {
            const items = await readQueueRaw();
            const next = items.filter(i => i.id !== id);
            if (next.length !== items.length) {
                await writeQueueRaw(next);
            }
        });
    },

    /**
     * Atomically update the attempts counter for an item after a failed drain.
     */
    async incrementAttempts(id: string): Promise<number> {
        return runExclusive(async () => {
            const items = await readQueueRaw();
            let attempts = 0;
            const next = items.map(i => {
                if (i.id !== id) return i;
                attempts = (i.attempts ?? 0) + 1;
                return { ...i, attempts };
            });
            await writeQueueRaw(next);
            return attempts;
        });
    },

    /**
     * Snapshot of the current queue (readonly).
     */
    async getAll(): Promise<ReadonlyArray<QueuedItem>> {
        // Reading doesn't need exclusive access, but we still go through the
        // chain to avoid returning a half-written state during enqueue.
        return runExclusive(async () => readQueueRaw());
    },

    /**
     * Drop every queued item.
     */
    async clearAll(): Promise<void> {
        return runExclusive(async () => {
            await AsyncStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
        });
    },

    /**
     * Remove every item belonging to a specific user (used on logout so the
     * next signed-in user doesn't inherit pending work).
     */
    async clearForUser(userId: string): Promise<void> {
        return runExclusive(async () => {
            const items = await readQueueRaw();
            const next = items.filter(i => {
                const payloadUser = (i.payload as QueuedPredictionPayload)?.userId;
                return payloadUser !== userId;
            });
            if (next.length !== items.length) {
                await writeQueueRaw(next);
            }
        });
    },
};

export default offlineQueue;
