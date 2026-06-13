/**
 * Retention cleanup for match_events and match_event_deliveries.
 *
 * Deliveries cascade-delete when their parent match_event row is removed.
 * Orphan deliveries are removed when a FavoriteMatch is deleted (onDelete Cascade).
 */

import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

const DEFAULT_RETENTION_DAYS = 14;
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];
const BATCH_SIZE = 2_000;

export function getMatchEventRetentionDays(): number {
    const parsed = parseInt(process.env.MATCH_EVENT_RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS), 10);
    return Math.max(1, Number.isFinite(parsed) ? parsed : DEFAULT_RETENTION_DAYS);
}

export interface MatchEventCleanupResult {
    finishedFixtureIds: number;
    eventsDeleted: number;
    staleEventsDeleted: number;
}

/**
 * Remove canonical events (and cascading deliveries) for finished fixtures
 * older than the retention window, plus stale events with no active subscribers.
 */
export async function cleanupMatchEventData(): Promise<MatchEventCleanupResult> {
    const retentionDays = getMatchEventRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    let eventsDeleted = 0;
    let staleEventsDeleted = 0;

    const finishedFixtures = await prisma.cachedFixture.findMany({
        where: {
            status: { in: FINISHED_STATUSES },
            updatedAt: { lt: cutoff },
        },
        select: { fixtureId: true },
        take: BATCH_SIZE,
    });

    const finishedFixtureIds = finishedFixtures.map((f) => f.fixtureId);

    if (finishedFixtureIds.length > 0) {
        const result = await prisma.matchEvent.deleteMany({
            where: { fixtureId: { in: finishedFixtureIds } },
        });
        eventsDeleted = result.count;
    }

    const activeFavorites = await prisma.favoriteMatch.findMany({
        where: { notifiedEnd: false },
        select: { apiMatchId: true },
        distinct: ['apiMatchId'],
    });
    const activeFixtureIds = activeFavorites.map((f) => f.apiMatchId);

    const staleResult = await prisma.matchEvent.deleteMany({
        where: {
            detectedAt: { lt: cutoff },
            ...(activeFixtureIds.length > 0
                ? { fixtureId: { notIn: activeFixtureIds } }
                : {}),
        },
    });
    staleEventsDeleted = staleResult.count;

    const total = eventsDeleted + staleEventsDeleted;
    if (total > 0) {
        logger.info(
            `[MatchEventCleanup] removed ${total} event(s) ` +
                `(finished=${eventsDeleted}, stale=${staleEventsDeleted}, retention=${retentionDays}d)`,
        );
    } else {
        logger.debug(`[MatchEventCleanup] nothing to remove (retention=${retentionDays}d)`);
    }

    return {
        finishedFixtureIds: finishedFixtureIds.length,
        eventsDeleted,
        staleEventsDeleted,
    };
}
