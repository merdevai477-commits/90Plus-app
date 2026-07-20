import prisma from '../../lib/prisma';
import { footballService, isFootballQuotaExhausted } from '../football.service';
import { footballDataCacheService } from '../football-data-cache.service';
import { logger } from '../../utils/logger';
import { acquireIngestorLock } from './match-ingestor-lock.adapter';
import { appendMatchEventsToStream } from './match-event-stream.adapter';
import {
    normalizeApiEvents,
    diffScoreGoals,
    diffStatusEvents,
    getCachedFixtureState,
    setCachedFixtureState,
    parseFixtureSnapshot,
    LIVE_STATUSES,
} from './match-event-normalizer';
import type { MatchEventIngestResult, NormalizedMatchEvent, FixtureSnapshot } from './match-event.types';
import { readLiveFixtureById, readTerminalFixtureById } from '../live-fixture-cache.service';
import { matchCacheService } from '../match-cache.service';

export type IngestFixtureOptions = {
    forceRefreshEvents?: boolean;
    /** Bypass stale Redis/DB snapshot and hit API-Football for this fixture. */
    forceApiRefresh?: boolean;
};

async function readFixtureSnapshotFromCache(
    fixtureId: number,
    options?: { preferFresh?: boolean },
): Promise<any | null> {
    const readDb = (): Promise<any | null> =>
        prisma.cachedFixture
            .findUnique({ where: { fixtureId } })
            .then((dbRow) => (dbRow ? matchCacheService.convertDbMatchToApiFormat(dbRow) : null));

    // Sync-triggered ingest runs right after DB upsert — prefer DB over Redis TTL lag.
    if (options?.preferFresh) {
        const fromDb = await readDb();
        if (fromDb) return fromDb;
    }

    const live = await readLiveFixtureById(fixtureId);
    if (live) return live;

    const terminal = await readTerminalFixtureById(fixtureId);
    if (terminal) return terminal;

    return readDb();
}

async function persistEvent(event: NormalizedMatchEvent): Promise<boolean> {
    try {
        await prisma.matchEvent.create({
            data: {
                fixtureId: event.fixtureId,
                eventKey: event.eventKey,
                eventType: event.eventType,
                minute: event.minute,
                extraMinute: event.extraMinute,
                teamId: event.teamId,
                playerId: event.playerId,
                payload: event.payload as object,
                detectedAt: event.detectedAt,
            },
        });
        return true;
    } catch (err: any) {
        if (err?.code === 'P2002') return false;
        throw err;
    }
}

export class MatchEventIngestor {
    /**
     * Ingest one fixture: prefer Redis/cache, normalize events, persist new ones.
     * Returns only events that were newly inserted in this tick.
     */
    static async ingestFixture(
        fixtureId: number,
        meta: { homeTeam: string; awayTeam: string },
        options?: IngestFixtureOptions,
    ): Promise<MatchEventIngestResult | null> {
        const lock = await acquireIngestorLock(fixtureId);
        if (!lock) return null;

        try {
            const preferFresh = options?.forceRefreshEvents === true || options?.forceApiRefresh === true;
            let snapshot: FixtureSnapshot | null = null;

            if (options?.forceApiRefresh && !isFootballQuotaExhausted()) {
                const fixtureRow = await footballService.getFixtureById(fixtureId, { source: 'job' });
                if (fixtureRow) {
                    snapshot = parseFixtureSnapshot(fixtureId, fixtureRow);
                }
            }

            if (!snapshot) {
                const cachedLive = await readFixtureSnapshotFromCache(fixtureId, { preferFresh });
                if (cachedLive) {
                    snapshot = parseFixtureSnapshot(fixtureId, cachedLive);
                } else if (!isFootballQuotaExhausted()) {
                    const fixtureRow = await footballService.getFixtureById(fixtureId, { source: 'job' });
                    if (fixtureRow) {
                        snapshot = parseFixtureSnapshot(fixtureId, fixtureRow);
                    }
                }
            }

            if (!snapshot) return null;

            const prev = getCachedFixtureState(fixtureId);

            const normalized: NormalizedMatchEvent[] = [
                ...diffScoreGoals(fixtureId, prev, snapshot, meta),
                ...diffStatusEvents(fixtureId, prev?.status, snapshot.status, snapshot, meta),
            ];

            if (snapshot.isLive) {
                const apiEvents = await footballDataCacheService.getMatchEvents(fixtureId, {
                    forceRefresh: options?.forceRefreshEvents === true || options?.forceApiRefresh === true,
                });
                if (Array.isArray(apiEvents)) {
                    normalized.push(...normalizeApiEvents(fixtureId, apiEvents, meta));
                }
            }

            const freshEvents: NormalizedMatchEvent[] = [];
            for (const event of normalized) {
                const inserted = await persistEvent(event);
                if (inserted) freshEvents.push(event);
            }

            if (freshEvents.length > 0) {
                await appendMatchEventsToStream(
                    fixtureId,
                    freshEvents.map((e) => e.eventKey),
                );
            }

            snapshot.latestEventKey =
                freshEvents.length > 0
                    ? freshEvents[freshEvents.length - 1].eventKey
                    : prev?.latestEventKey ?? null;

            setCachedFixtureState(snapshot);

            return { fixtureId, snapshot, freshEvents };
        } catch (err: any) {
            if (!isFootballQuotaExhausted()) {
                logger.error(`[MatchEventIngestor] ingest ${fixtureId} failed:`, err?.message);
            }
            return null;
        } finally {
            await lock.release();
        }
    }

    static getSnapshot(fixtureId: number): FixtureSnapshot | null {
        return getCachedFixtureState(fixtureId);
    }

    static isLive(status: string): boolean {
        return LIVE_STATUSES.has(status);
    }
}

export default MatchEventIngestor;
