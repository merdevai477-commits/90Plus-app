/**
 * Live Fixture Sync Service
 * Polls API-Football live fixtures on a short interval, upserts full data to DB,
 * and broadcasts WebSocket score/status updates for sub-second UI refresh on clients.
 *
 * Only the distributed sync leader instance performs upstream API calls.
 */

import prisma from '../lib/prisma';
import { footballService } from './football.service';
import { matchCacheService, FixtureFromAPI, LIVE_STATUSES, FINISHED_STATUSES } from './match-cache.service';
import { WebSocketService } from './websocket.service';
import { PredictionResolverService } from './prediction-resolver.service';
import { logger } from '../utils/logger';
import { withSyncLeaderLease } from './football-sync-leader.service';
import { isFootballQuotaExhausted } from './football.service';
import {
    writeLiveFixturesSnapshot,
    writeTerminalFixtureSnapshot,
    readLiveFixturesList,
} from './live-fixture-cache.service';
import LiveMatchIngestorService from './live-match-ingestor.service';
import {
    filterWorldCupFixtures,
    isWorldCupOnlyMode,
    logWorldCupOnlyModeStartup,
} from '../config/world-cup-only-mode.config';

const LIVE_STATUSES_SET = new Set(LIVE_STATUSES);
const FINISHED_STATUSES_SET = new Set(FINISHED_STATUSES);

type LiveSnapshot = {
    homeScore: number;
    awayScore: number;
    status: string;
    elapsed: number | null;
};

class LiveFixtureSyncService {
    private intervalRef: NodeJS.Timeout | null = null;
    private running = false;
    private syncInFlight = false;
    private lastSnapshots = new Map<number, LiveSnapshot>();
    private previouslyLiveIds = new Set<number>();
    private finishingInFlight = new Set<number>();
    private droppedFromLiveIds = new Set<number>();

    start(): void {
        if (!process.env.FOOTBALL_API_KEY) {
            logger.warn('Live fixture sync disabled — FOOTBALL_API_KEY not set');
            return;
        }
        if (this.running) return;

        const intervalMs = Math.max(
            5_000,
            parseInt(process.env.FOOTBALL_LIVE_SYNC_MS || '5000', 10) || 5_000,
        );

        this.running = true;
        logWorldCupOnlyModeStartup();
        logger.info(`🔴 Live fixture sync started (every ${intervalMs / 1000}s, leader-elected)${isWorldCupOnlyMode() ? ' [World Cup only]' : ''}`);

        const tick = () => {
            this.syncOnce().catch((err) => logger.warn('Live fixture sync tick failed:', err));
        };

        setTimeout(tick, 2_000);
        this.intervalRef = setInterval(tick, intervalMs);
    }

    stop(): void {
        if (this.intervalRef) {
            clearInterval(this.intervalRef);
            this.intervalRef = null;
        }
        this.running = false;
        this.lastSnapshots.clear();
        this.previouslyLiveIds.clear();
        this.finishingInFlight.clear();
        logger.info('🔴 Live fixture sync stopped');
    }

    private broadcastMatchUpdate(
        fixtureId: number,
        homeScore: number,
        awayScore: number,
        status: string,
        elapsed: number | null,
    ): void {
        WebSocketService.sendMatchUpdate(fixtureId, {
            matchId: fixtureId,
            homeScore,
            awayScore,
            status,
            minute: elapsed ?? undefined,
        });
    }

    private async onMatchFinished(
        fixtureId: number,
        homeScore: number,
        awayScore: number,
        status: string,
        elapsed: number | null,
        fixture?: FixtureFromAPI,
    ): Promise<void> {
        if (this.finishingInFlight.has(fixtureId)) return;
        this.finishingInFlight.add(fixtureId);

        try {
            if (fixture) {
                await writeTerminalFixtureSnapshot(fixture);
            }

            this.broadcastMatchUpdate(fixtureId, homeScore, awayScore, status, elapsed);

            LiveMatchIngestorService.triggerFixtureIngest(fixtureId);

            await matchCacheService.handleMatchFinished(fixtureId);
            await PredictionResolverService.resolveMatchPredictions(fixtureId, homeScore, awayScore);
            logger.info(`✅ Match ${fixtureId} archived and predictions resolved (${homeScore}-${awayScore}, ${status})`);
        } catch (err) {
            logger.warn(`Failed to finalize match ${fixtureId}:`, err);
        } finally {
            this.finishingInFlight.delete(fixtureId);
            this.lastSnapshots.delete(fixtureId);
        }
    }

    private async verifyFinishedBatch(fixtureIds: number[]): Promise<void> {
        const unique = [...new Set(fixtureIds)].filter((id) => id > 0 && !this.finishingInFlight.has(id));
        if (unique.length === 0) return;

        for (let i = 0; i < unique.length; i += 20) {
            const chunk = unique.slice(i, i + 20);
            try {
                const fixtures = await footballService.getFixtures(
                    { ids: chunk.join('-') },
                    { source: 'job' },
                );
                if (!Array.isArray(fixtures)) continue;

                for (const fixture of fixtures) {
                    const fixtureId = fixture?.fixture?.id;
                    if (fixtureId == null) continue;

                    const status = fixture.fixture?.status?.short;
                    if (!FINISHED_STATUSES_SET.has(status)) continue;

                    await matchCacheService.upsertFixtures([fixture as FixtureFromAPI]);

                    const homeScore = fixture.goals?.home ?? 0;
                    const awayScore = fixture.goals?.away ?? 0;
                    const elapsed = fixture.fixture?.status?.elapsed ?? null;
                    await this.onMatchFinished(
                        fixtureId,
                        homeScore,
                        awayScore,
                        status,
                        elapsed,
                        fixture as FixtureFromAPI,
                    );
                }
            } catch (err) {
                logger.debug(`Could not verify finished batch (${chunk.length} ids):`, err);
            }
        }
    }

    private async handlePotentiallyFinished(fixtureId: number): Promise<void> {
        this.droppedFromLiveIds.add(fixtureId);
    }

    private async processLiveFixtures(liveFixtures: FixtureFromAPI[]): Promise<void> {
        const currentLiveIds = new Set<number>();
        for (const fixture of liveFixtures) {
            const id = fixture.fixture.id;
            const status = fixture.fixture.status.short;
            if (LIVE_STATUSES_SET.has(status)) {
                currentLiveIds.add(id);
            }
            if (FINISHED_STATUSES_SET.has(status)) {
                const homeScore = fixture.goals.home ?? 0;
                const awayScore = fixture.goals.away ?? 0;
                const elapsed = fixture.fixture.status.elapsed ?? null;
                await this.onMatchFinished(id, homeScore, awayScore, status, elapsed, fixture);
            }
        }

        for (const prevId of this.previouslyLiveIds) {
            if (!currentLiveIds.has(prevId)) {
                await this.handlePotentiallyFinished(prevId);
            }
        }
        this.previouslyLiveIds = currentLiveIds;

        if (this.droppedFromLiveIds.size > 0) {
            const batch = [...this.droppedFromLiveIds];
            this.droppedFromLiveIds.clear();
            await this.verifyFinishedBatch(batch);
        }

        const liveIds = [...currentLiveIds];
        const favoritedLiveIds = liveIds.length > 0
            ? new Set(
                (
                    await prisma.favoriteMatch.findMany({
                        where: {
                            apiMatchId: { in: liveIds },
                            notifiedEnd: false,
                        },
                        select: { apiMatchId: true },
                        distinct: ['apiMatchId'],
                    })
                ).map((row) => row.apiMatchId),
            )
            : new Set<number>();

        for (const fixture of liveFixtures) {
            const id = fixture.fixture.id;
            const status = fixture.fixture.status.short;
            if (!LIVE_STATUSES_SET.has(status)) continue;

            const homeScore = fixture.goals.home ?? 0;
            const awayScore = fixture.goals.away ?? 0;
            const elapsed = fixture.fixture.status.elapsed ?? null;

            const prev = this.lastSnapshots.get(id);
            const scoreChanged =
                !prev || prev.homeScore !== homeScore || prev.awayScore !== awayScore;
            const statusChanged = !prev || prev.status !== status;
            const changed =
                !prev ||
                scoreChanged ||
                statusChanged ||
                prev.elapsed !== elapsed;

            if (changed) {
                this.lastSnapshots.set(id, { homeScore, awayScore, status, elapsed });
                this.broadcastMatchUpdate(id, homeScore, awayScore, status, elapsed);
            }

            // Re-ingest favorited live fixtures every tick so cards/VAR are
            // detected without waiting for a score or status change.
            if (favoritedLiveIds.has(id)) {
                LiveMatchIngestorService.triggerFixtureIngest(id);
            }
        }
    }

    /** Keep push pipeline alive from Redis when upstream API is rate-limited. */
    private async syncFromCachedSnapshots(): Promise<void> {
        const cached = await readLiveFixturesList();
        if (!cached?.length) {
            logger.debug('[LiveFixtureSync] Quota pause — no cached live list to process');
            return;
        }

        logger.debug(`[LiveFixtureSync] Quota pause — processing ${cached.length} cached live fixture(s)`);
        await this.processLiveFixtures(cached);
    }

    private async syncOnce(): Promise<void> {
        if (!footballService.isConfigured()) return;
        if (this.syncInFlight) {
            logger.debug('[LiveFixtureSync] Skipping tick — previous local tick still running');
            return;
        }
        this.syncInFlight = true;
        try {
            const lease = await withSyncLeaderLease(
                'live-fixture-sync',
                ({ signal }) => this.syncOnceAsLeader(signal),
                { ttlSec: 30 },
            );
            if (!lease.acquired) {
                logger.debug('[LiveFixtureSync] Skipping tick — distributed lease busy');
            }
        } finally {
            this.syncInFlight = false;
        }
    }

    private async syncOnceAsLeader(signal: AbortSignal): Promise<void> {
        signal.throwIfAborted();
        if (isFootballQuotaExhausted()) {
            logger.debug('[LiveFixtureSync] API quota pause — continuing from cached snapshots');
            await this.syncFromCachedSnapshots();
            return;
        }

        const liveFixturesRaw: FixtureFromAPI[] = await footballService.getLiveFixtures({ source: 'job' });
        const liveFixtures: FixtureFromAPI[] = isWorldCupOnlyMode()
            ? (filterWorldCupFixtures(liveFixturesRaw) as FixtureFromAPI[])
            : liveFixturesRaw;

        signal.throwIfAborted();
        await writeLiveFixturesSnapshot(liveFixtures);

        if (liveFixtures.length === 0) {
            return;
        }

        signal.throwIfAborted();
        await matchCacheService.upsertFixtures(liveFixtures);
        signal.throwIfAborted();
        await this.processLiveFixtures(liveFixtures);
    }
}

export const liveFixtureSyncService = new LiveFixtureSyncService();
