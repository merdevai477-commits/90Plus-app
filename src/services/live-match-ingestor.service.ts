/**
 * Live Match Ingestor — polls favorited fixtures and drives the event pipeline:
 *   ingest → persist MatchEvent → subscription-aware fan-out → Bull push queue
 *
 * Cache-first: reuses Redis live/events data written by liveFixtureSync before
 * calling API-Football. Runs only on the distributed sync leader instance.
 *
 * Score/status changes from LiveFixtureSync trigger immediate per-fixture ingest.
 */

import prisma from '../lib/prisma';
import { WebSocketService } from './websocket.service';
import { logger } from '../utils/logger';
import { MatchEventIngestor } from './match-events/match-event-ingestor.service';
import { fanOutMatchEvent } from './match-events/match-event-fanout.service';
import { tryAcquireSyncLeader } from './football-sync-leader.service';
import { isFootballQuotaExhausted } from './football.service';
import {
    isWorldCupFixtureIdAllowed,
    isWorldCupOnlyMode,
    logSkippingNonWorldCup,
} from '../config/world-cup-only-mode.config';

function pollIntervalMs(): number {
    const fromEnv = parseInt(
        process.env.MATCH_EVENT_POLL_MS ?? process.env.MATCH_WATCHER_INTERVAL_MS ?? '15000',
        10,
    );
    return Math.max(10_000, Number.isFinite(fromEnv) ? fromEnv : 15_000);
}

const FIXTURE_INGEST_CONCURRENCY = Math.max(
    1,
    Math.min(8, parseInt(process.env.MATCH_EVENT_INGEST_CONCURRENCY || '4', 10) || 4),
);

export class LiveMatchIngestorService {
    private static intervalId: NodeJS.Timeout | null = null;
    /** Coalesce rapid sync triggers for the same fixture. */
    private static pendingSyncIngest = new Map<number, NodeJS.Timeout>();
    private static inFlightFixtures = new Set<number>();
    private static pendingRetries = new Set<number>();

    static start(): void {
        if (this.intervalId) {
            logger.info('⚠️ Live match ingestor already running');
            return;
        }

        const intervalMs = pollIntervalMs();
        logger.info(`🔄 Starting live match ingestor (poll every ${intervalMs / 1000}s, cache-first)...`);

        setTimeout(() => {
            this.tick().catch((err) => logger.error('Live match ingestor first tick failed:', err));
        }, 5_000);

        this.intervalId = setInterval(() => {
            this.tick().catch((err) => logger.error('Live match ingestor tick failed:', err));
        }, intervalMs);

        logger.info(`✅ Live match ingestor started (first tick in 5s)`);
    }

    static stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        for (const timer of this.pendingSyncIngest.values()) {
            clearTimeout(timer);
        }
        this.pendingSyncIngest.clear();
        logger.info('✅ Live match ingestor stopped');
    }

    /**
     * Called by LiveFixtureSync when score or status changes — near-real-time goal/status pushes.
     */
    static triggerFixtureIngest(fixtureId: number): void {
        if (!fixtureId || fixtureId <= 0) return;

        const existing = this.pendingSyncIngest.get(fixtureId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            this.pendingSyncIngest.delete(fixtureId);
            void this.ingestFixtureById(fixtureId, { forceRefreshEvents: true }).catch((err) =>
                logger.warn(`[LiveMatchIngestor] sync-trigger ingest ${fixtureId} failed:`, err?.message),
            );
        }, 0);

        this.pendingSyncIngest.set(fixtureId, timer);
    }

    static async tick(): Promise<void> {
        if (isFootballQuotaExhausted()) {
            logger.debug('[LiveMatchIngestor] Skipping tick — API-Football daily quota exhausted');
            return;
        }

        const isLeader = await tryAcquireSyncLeader('match-ingestor');
        if (!isLeader) {
            logger.debug('[LiveMatchIngestor] Skipping tick — another instance is sync leader');
            return;
        }

        void this.checkFavoritedFixtures().catch((err) =>
            logger.error('Live match ingestor tick failed:', err),
        );
    }

    private static async ingestFixtureById(
        fixtureId: number,
        options?: { forceRefreshEvents?: boolean },
    ): Promise<void> {
        if (this.inFlightFixtures.has(fixtureId)) {
            this.pendingRetries.add(fixtureId);
            return;
        }
        this.inFlightFixtures.add(fixtureId);
        try {
            const favorite = await prisma.favoriteMatch.findFirst({
                where: {
                    apiMatchId: fixtureId,
                    notifiedEnd: false,
                },
                select: { homeTeam: true, awayTeam: true },
            });
            if (!favorite) return;

            await this.processFixture(
                fixtureId,
                {
                    homeTeam: favorite.homeTeam,
                    awayTeam: favorite.awayTeam,
                },
                { forceRefreshEvents: true, ...options },
            );
        } finally {
            this.inFlightFixtures.delete(fixtureId);
            if (this.pendingRetries.delete(fixtureId)) {
                void this.ingestFixtureById(fixtureId, options);
            }
        }
    }

    private static async processFixture(
        fixtureId: number,
        meta: { homeTeam: string; awayTeam: string },
        options?: { forceRefreshEvents?: boolean },
    ): Promise<void> {
        if (isWorldCupOnlyMode()) {
            const allowed = await isWorldCupFixtureIdAllowed(fixtureId);
            if (!allowed) {
                logSkippingNonWorldCup(`live ingestor fixture ${fixtureId}`);
                return;
            }
        }

        const result = await MatchEventIngestor.ingestFixture(fixtureId, meta, options);
        if (!result) return;

        if (result.freshEvents.length > 0) {
            for (const event of result.freshEvents) {
                const delivered = await fanOutMatchEvent(event);
                logger.info(
                    `[LiveMatchIngestor] fixture ${fixtureId}: event ${event.eventType} → ${delivered} push(es)`,
                );
            }
        }

        WebSocketService.sendMatchUpdate(fixtureId, {
            matchId: fixtureId,
            homeScore: result.snapshot.homeScore,
            awayScore: result.snapshot.awayScore,
            status: result.snapshot.status,
            minute: result.snapshot.elapsed ?? undefined,
        });
    }

    private static async checkFavoritedFixtures(): Promise<void> {
        const now = new Date();
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const favoriteMatches = await prisma.favoriteMatch.findMany({
            where: {
                matchDate: { gte: threeHoursAgo, lte: tomorrow },
                notifiedEnd: false,
            },
            select: {
                apiMatchId: true,
                homeTeam: true,
                awayTeam: true,
            },
        });

        if (favoriteMatches.length === 0) {
            logger.debug('📭 No active favorite matches to ingest');
            return;
        }

        const byFixture = new Map<number, { homeTeam: string; awayTeam: string }>();
        for (const f of favoriteMatches) {
            if (!byFixture.has(f.apiMatchId)) {
                byFixture.set(f.apiMatchId, { homeTeam: f.homeTeam, awayTeam: f.awayTeam });
            }
        }

        logger.info(`📊 Ingesting ${byFixture.size} favorited fixture(s) (cache-first)...`);

        const entries = [...byFixture.entries()];
        for (let i = 0; i < entries.length; i += FIXTURE_INGEST_CONCURRENCY) {
            const batch = entries.slice(i, i + FIXTURE_INGEST_CONCURRENCY);
            await Promise.all(
                batch.map(([fixtureId, meta]) =>
                    this.processFixture(fixtureId, meta, { forceRefreshEvents: true }).catch((err: any) => {
                        logger.error(`[LiveMatchIngestor] fixture ${fixtureId} error:`, err?.message);
                    }),
                ),
            );
        }
    }
}

export default LiveMatchIngestorService;
