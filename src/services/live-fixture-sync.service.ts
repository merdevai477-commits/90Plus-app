/**
 * Live Fixture Sync Service
 * Polls API-Football live fixtures on a short interval, upserts full data to DB,
 * and broadcasts WebSocket score/status updates for sub-second UI refresh on clients.
 */

import { footballService } from './football.service';
import { matchCacheService, FixtureFromAPI, LIVE_STATUSES } from './match-cache.service';
import { WebSocketService } from './websocket.service';
import { logger } from '../utils/logger';
import { getRedisClient } from '../lib/redis';

const LIVE_STATUSES_SET = new Set(LIVE_STATUSES);

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

    start(): void {
        if (!process.env.FOOTBALL_API_KEY) {
            logger.warn('Live fixture sync disabled — FOOTBALL_API_KEY not set');
            return;
        }
        if (this.running) return;

        const intervalMs = Math.max(
            8_000,
            parseInt(process.env.FOOTBALL_LIVE_SYNC_MS || '12000', 10) || 12_000,
        );

        this.running = true;
        logger.info(`🔴 Live fixture sync started (every ${intervalMs / 1000}s)`);

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
        logger.info('🔴 Live fixture sync stopped');
    }

    private async syncOnce(): Promise<void> {
        if (!footballService.isConfigured()) return;

        const liveFixtures: FixtureFromAPI[] = await footballService.getLiveFixtures();
        if (liveFixtures.length === 0) {
            return;
        }

        await matchCacheService.upsertFixtures(liveFixtures);

        const redis = getRedisClient();
        if (redis) {
            await redis.setex('football:live_matches', 12, JSON.stringify(liveFixtures));
        }

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

            WebSocketService.sendMatchUpdate(id, {
                matchId: id,
                homeScore,
                awayScore,
                status,
                minute: elapsed ?? undefined,
            });
        }

        // Per-match updates above are enough; avoid noisy global match_update broadcasts.
    }
}

export const liveFixtureSyncService = new LiveFixtureSyncService();
