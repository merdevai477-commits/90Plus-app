/**
 * Live Match Ingestor — polls favorited fixtures and drives the event pipeline:
 *   ingest → persist MatchEvent → subscription-aware fan-out → Bull push queue
 */

import prisma from '../lib/prisma';
import { WebSocketService } from './websocket.service';
import { logger } from '../utils/logger';
import { MatchEventIngestor } from './match-events/match-event-ingestor.service';
import { fanOutMatchEvents } from './match-events/match-event-fanout.service';

function pollIntervalMs(): number {
    const fromEnv = parseInt(
        process.env.MATCH_EVENT_POLL_MS ?? process.env.MATCH_WATCHER_INTERVAL_MS ?? '15000',
        10,
    );
    return Math.max(5_000, Number.isFinite(fromEnv) ? fromEnv : 15_000);
}

export class LiveMatchIngestorService {
    private static isRunning = false;
    private static intervalId: NodeJS.Timeout | null = null;

    static start(): void {
        if (this.intervalId) {
            logger.info('⚠️ Live match ingestor already running');
            return;
        }

        const intervalMs = pollIntervalMs();
        logger.info(`🔄 Starting live match ingestor (poll every ${intervalMs / 1000}s)...`);

        setTimeout(() => {
            this.tick().catch((err) => logger.error('Live match ingestor first tick failed:', err));
        }, 30_000);

        this.intervalId = setInterval(() => {
            this.tick().catch((err) => logger.error('Live match ingestor tick failed:', err));
        }, intervalMs);

        logger.info(`✅ Live match ingestor started (first tick in 30s)`);
    }

    static stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logger.info('✅ Live match ingestor stopped');
    }

    static async tick(): Promise<void> {
        if (this.isRunning) {
            logger.debug('⏳ Live match ingestor tick skipped — previous still running');
            return;
        }

        this.isRunning = true;
        try {
            await this.checkFavoritedFixtures();
        } finally {
            this.isRunning = false;
        }
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

        logger.info(`📊 Ingesting ${byFixture.size} favorited fixture(s)...`);

        for (const [fixtureId, meta] of byFixture) {
            try {
                const result = await MatchEventIngestor.ingestFixture(fixtureId, meta);
                if (!result) continue;

                if (result.freshEvents.length > 0) {
                    const enqueued = await fanOutMatchEvents(result.freshEvents);
                    logger.info(
                        `[LiveMatchIngestor] fixture ${fixtureId}: ${result.freshEvents.length} new event(s), ${enqueued} push(es) enqueued`,
                    );
                }

                WebSocketService.sendMatchUpdate(fixtureId, {
                    matchId: fixtureId,
                    homeScore: result.snapshot.homeScore,
                    awayScore: result.snapshot.awayScore,
                    status: result.snapshot.status,
                });
            } catch (err: any) {
                logger.error(`[LiveMatchIngestor] fixture ${fixtureId} error:`, err?.message);
            }
        }
    }
}

export default LiveMatchIngestorService;
