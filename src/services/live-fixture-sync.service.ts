/**
 * Live Fixture Sync Service
 * Polls API-Football live fixtures on a short interval, upserts full data to DB,
 * and broadcasts WebSocket score/status updates for sub-second UI refresh on clients.
 *
 * Only the distributed sync leader instance performs upstream API calls.
 */

import { footballService } from './football.service';
import { matchCacheService, FixtureFromAPI, LIVE_STATUSES, FINISHED_STATUSES } from './match-cache.service';
import { WebSocketService } from './websocket.service';
import { PredictionResolverService } from './prediction-resolver.service';
import { logger } from '../utils/logger';
import { tryAcquireSyncLeader } from './football-sync-leader.service';
import {
    writeLiveFixturesSnapshot,
    writeTerminalFixtureSnapshot,
} from './live-fixture-cache.service';

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
    private lastSnapshots = new Map<number, LiveSnapshot>();
    private previouslyLiveIds = new Set<number>();
    private finishingInFlight = new Set<number>();

    start(): void {
        if (!process.env.FOOTBALL_API_KEY) {
            logger.warn('Live fixture sync disabled — FOOTBALL_API_KEY not set');
            return;
        }
        if (this.running) return;

        const intervalMs = Math.max(
            10_000,
            parseInt(process.env.FOOTBALL_LIVE_SYNC_MS || '10000', 10) || 10_000,
        );

        this.running = true;
        logger.info(`🔴 Live fixture sync started (every ${intervalMs / 1000}s, leader-elected)`);

        const tick = () => {
            this.syncOnce().catch((err) => logger.warn('Live fixture sync tick failed:', err));
        };

        setTimeout(tick, 5_000);
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

    private async handlePotentiallyFinished(fixtureId: number): Promise<void> {
        if (this.finishingInFlight.has(fixtureId)) return;

        try {
            const fixtures = await footballService.getFixtures({ id: fixtureId }, { source: 'job' });
            const fixture = fixtures?.[0];
            if (!fixture) return;

            const status = fixture.fixture?.status?.short;
            if (!FINISHED_STATUSES_SET.has(status)) return;

            await matchCacheService.upsertFixtures([fixture as FixtureFromAPI]);

            const homeScore = fixture.goals?.home ?? 0;
            const awayScore = fixture.goals?.away ?? 0;
            const elapsed = fixture.fixture?.status?.elapsed ?? null;
            await this.onMatchFinished(fixtureId, homeScore, awayScore, status, elapsed, fixture as FixtureFromAPI);
        } catch (err) {
            logger.debug(`Could not verify finished status for match ${fixtureId}:`, err);
        }
    }

    private async syncOnce(): Promise<void> {
        if (!footballService.isConfigured()) return;

        const isLeader = await tryAcquireSyncLeader('live-fixture-sync');
        if (!isLeader) {
            logger.debug('[LiveFixtureSync] Skipping tick — another instance is sync leader');
            return;
        }

        const liveFixtures: FixtureFromAPI[] = await footballService.getLiveFixtures({ source: 'job' });

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

        await writeLiveFixturesSnapshot(liveFixtures);

        if (liveFixtures.length === 0) {
            return;
        }

        await matchCacheService.upsertFixtures(liveFixtures);

        for (const fixture of liveFixtures) {
            const id = fixture.fixture.id;
            const status = fixture.fixture.status.short;
            if (!LIVE_STATUSES_SET.has(status)) continue;

            const homeScore = fixture.goals.home ?? 0;
            const awayScore = fixture.goals.away ?? 0;
            const elapsed = fixture.fixture.status.elapsed ?? null;

            const prev = this.lastSnapshots.get(id);
            const changed =
                !prev ||
                prev.homeScore !== homeScore ||
                prev.awayScore !== awayScore ||
                prev.status !== status ||
                prev.elapsed !== elapsed;

            if (!changed) continue;

            this.lastSnapshots.set(id, { homeScore, awayScore, status, elapsed });

            this.broadcastMatchUpdate(id, homeScore, awayScore, status, elapsed);
        }
    }
}

export const liveFixtureSyncService = new LiveFixtureSyncService();
