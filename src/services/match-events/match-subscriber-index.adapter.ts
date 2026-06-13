/**
 * Hot subscriber index — optional Redis SET of FavoriteMatch ids per fixture.
 * Falls back to DB queries when Redis is unavailable or index is disabled.
 */

import prisma from '../../lib/prisma';
import { getRedisClient } from '../../lib/redis';
import { logger } from '../../utils/logger';

const INDEX_PREFIX = 'match';

function indexKey(fixtureId: number): string {
    return `${INDEX_PREFIX}:${fixtureId}:subscribers`;
}

export function isSubscriberIndexEnabled(): boolean {
    return process.env.MATCH_EVENT_USE_SUBSCRIBER_INDEX !== 'false';
}

export async function addSubscriberToIndex(fixtureId: number, subscriptionId: string): Promise<void> {
    if (!isSubscriberIndexEnabled()) return;
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await redis.sadd(indexKey(fixtureId), subscriptionId);
    } catch (err: any) {
        logger.debug('[SubscriberIndex] add failed:', err?.message);
    }
}

export async function removeSubscriberFromIndex(fixtureId: number, subscriptionId: string): Promise<void> {
    if (!isSubscriberIndexEnabled()) return;
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await redis.srem(indexKey(fixtureId), subscriptionId);
    } catch (err: any) {
        logger.debug('[SubscriberIndex] remove failed:', err?.message);
    }
}

export async function listActiveSubscriptionIds(fixtureId: number): Promise<string[] | null> {
    if (!isSubscriberIndexEnabled()) return null;
    const redis = getRedisClient();
    if (!redis) return null;
    try {
        const ids = await redis.smembers(indexKey(fixtureId));
        return ids.length > 0 ? ids : null;
    } catch (err: any) {
        logger.debug('[SubscriberIndex] list failed:', err?.message);
        return null;
    }
}

/** Load active subscriptions for a fixture (index-first, DB fallback). */
export async function loadActiveSubscriptions(fixtureId: number) {
    const indexedIds = await listActiveSubscriptionIds(fixtureId);

    if (indexedIds && indexedIds.length > 0) {
        const rows = await prisma.favoriteMatch.findMany({
            where: { id: { in: indexedIds }, apiMatchId: fixtureId, notifiedEnd: false },
            include: {
                user: { select: { expoPushToken: true, pushNotificationsConsent: true } },
            },
        });
        if (rows.length > 0) return rows;
    }

    return prisma.favoriteMatch.findMany({
        where: { apiMatchId: fixtureId, notifiedEnd: false },
        include: {
            user: { select: { expoPushToken: true, pushNotificationsConsent: true } },
        },
    });
}
