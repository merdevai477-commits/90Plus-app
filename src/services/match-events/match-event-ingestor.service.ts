import prisma from '../../lib/prisma';
import { footballService } from '../football.service';
import { logger } from '../../utils/logger';
import { acquireIngestorLock } from './match-ingestor-lock.adapter';
import { appendMatchEventsToStream } from './match-event-stream.adapter';
import {
    normalizeApiEvents,
    diffScoreGoals,
    diffStatusEvents,
    buildLineupEvent,
    getCachedFixtureState,
    setCachedFixtureState,
    parseFixtureSnapshot,
    LIVE_STATUSES,
} from './match-event-normalizer';
import type { MatchEventIngestResult, NormalizedMatchEvent, FixtureSnapshot } from './match-event.types';

const lineupAnnouncedFixtures = new Set<number>();

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
     * Ingest one fixture: fetch API data, normalize events, persist new ones.
     * Returns only events that were newly inserted in this tick.
     */
    static async ingestFixture(
        fixtureId: number,
        meta: { homeTeam: string; awayTeam: string },
    ): Promise<MatchEventIngestResult | null> {
        const lock = await acquireIngestorLock(fixtureId);
        if (!lock) return null;

        try {
            const rawFixture = await footballService.fetchFromApi<any[]>('/fixtures', { id: fixtureId });
            if (!rawFixture?.length) return null;

            const snapshot = parseFixtureSnapshot(fixtureId, rawFixture[0]);
            const prev = getCachedFixtureState(fixtureId);

            const normalized: NormalizedMatchEvent[] = [
                ...diffScoreGoals(fixtureId, prev, snapshot, meta),
                ...diffStatusEvents(fixtureId, prev?.status, snapshot.status, snapshot, meta),
            ];

            if (snapshot.isLive) {
                const apiEvents = await footballService.fetchFromApi<any[]>('/fixtures/events', {
                    fixture: fixtureId,
                });
                if (Array.isArray(apiEvents)) {
                    normalized.push(...normalizeApiEvents(fixtureId, apiEvents, meta));
                }
            }

            if (!snapshot.isLive && (snapshot.status === 'NS' || snapshot.status === 'TBD')) {
                const lineupEvent = await this.tryLineupEvent(fixtureId, meta);
                if (lineupEvent) normalized.push(lineupEvent);
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
            logger.error(`[MatchEventIngestor] ingest ${fixtureId} failed:`, err?.message);
            return null;
        } finally {
            await lock.release();
        }
    }

    private static async tryLineupEvent(
        fixtureId: number,
        meta: { homeTeam: string; awayTeam: string },
    ): Promise<NormalizedMatchEvent | null> {
        if (lineupAnnouncedFixtures.has(fixtureId)) return null;

        try {
            const data = await footballService.fetchFromApi<any[]>('/fixtures/lineups', {
                fixture: fixtureId,
            });
            if (!Array.isArray(data) || data.length === 0) return null;
            const hasStartXI = data.some(
                (team) => Array.isArray(team?.startXI) && team.startXI.length > 0,
            );
            if (!hasStartXI) return null;

            lineupAnnouncedFixtures.add(fixtureId);
            return buildLineupEvent(fixtureId, meta);
        } catch {
            return null;
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
