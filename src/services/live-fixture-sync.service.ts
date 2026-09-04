/**
 * Live Fixture Sync Service
 * Polls API-Football live fixtures on a short interval, upserts full data to DB,
 * and broadcasts WebSocket score/status updates for sub-second UI refresh on clients.
 *
 * Only the distributed sync leader instance performs upstream API calls.
 */

import prisma from '../lib/prisma';
import { footballService } from './football.service';
import { matchCacheService, FixtureFromAPI, LIVE_STATUSES, FINISHED_STATUSES, TERMINAL_LATCH_STATUSES } from './match-cache.service';
import { WebSocketService } from './websocket.service';
import { PredictionResolverService } from './prediction-resolver.service';
import { logger } from '../utils/logger';
import { withSyncLeaderLease } from './football-sync-leader.service';
import { isFootballQuotaExhausted } from './football.service';
import { isPurposeAllowed } from './api-football-quota.service';
import {
    writeLiveFixturesSnapshot,
    writeTerminalFixtureSnapshot,
    readLiveFixturesList,
    isNsNearKickoff,
} from './live-fixture-cache.service';
import LiveMatchIngestorService from './live-match-ingestor.service';
import {
    filterWorldCupFixtures,
    isWorldCupOnlyMode,
    logWorldCupOnlyModeStartup,
} from '../config/world-cup-only-mode.config';

const LIVE_STATUSES_SET = new Set(LIVE_STATUSES);
const FINISHED_STATUSES_SET = new Set(FINISHED_STATUSES);
const TERMINAL_LATCH_STATUSES_SET = new Set(TERMINAL_LATCH_STATUSES);
const NS_KICKOFF_PROBE_LIMIT = Math.max(
    5,
    Math.min(parseInt(process.env.LIVE_NS_KICKOFF_PROBE_MAX || '15', 10) || 15, 30),
);

type LiveSnapshot = {
    homeScore: number;
    awayScore: number;
    status: string;
    elapsed: number | null;
    extra: number | null;
};

class LiveFixtureSyncService {
    private intervalRef: NodeJS.Timeout | null = null;
    private running = false;
    private syncInFlight = false;
    private lastSnapshots = new Map<number, LiveSnapshot>();
    private previouslyLiveIds = new Set<number>();
    private finishingInFlight = new Set<number>();
    private droppedFromLiveIds = new Set<number>();
    private warmedLiveIds = new Set<number>();
    /** Throttle non-score event WS pushes (cards/subs) — max one delta / 8s per fixture. */
    private lastEventPushAt = new Map<number, number>();

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
        this.warmedLiveIds.clear();
        this.lastEventPushAt.clear();
        logger.info('🔴 Live fixture sync stopped');
    }

    private broadcastMatchUpdate(
        fixtureId: number,
        homeScore: number,
        awayScore: number,
        status: string,
        elapsed: number | null,
        extra?: number | null,
    ): void {
        const isFinished = TERMINAL_LATCH_STATUSES_SET.has(status);
        WebSocketService.sendMatchUpdate(fixtureId, {
            matchId: fixtureId,
            homeScore,
            awayScore,
            status,
            minute: elapsed ?? undefined,
            extra: isFinished ? null : extra ?? undefined,
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
            } else {
                const { footballDataCacheService } = await import('./football-data-cache.service');
                await footballDataCacheService.invalidateFixtureDetailCaches(fixtureId, 'LIVE→FT');
            }
            const { footballDataCacheService } = await import('./football-data-cache.service');
            const { calendarDateFromKickoff, calendarTodayKey } = await import(
                '../utils/calendar-day-bounds.util'
            );
            const dateKey =
                calendarDateFromKickoff(fixture?.fixture?.date ?? null) ??
                (fixture?.fixture?.timestamp != null
                    ? calendarDateFromKickoff(
                          new Date(fixture.fixture.timestamp * 1000).toISOString(),
                      )
                    : null) ??
                calendarTodayKey();
            await footballDataCacheService.invalidateMatchesByDateCache(dateKey, 'LIVE→FT');
            this.warmedLiveIds.delete(fixtureId);

            this.broadcastMatchUpdate(fixtureId, homeScore, awayScore, status, elapsed);

            void import('./live-fixture-event-push.service').then(({ resetPushedEventsForFixture }) =>
                resetPushedEventsForFixture(fixtureId),
            );

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
                    { source: 'job', purpose: 'verify-finished' },
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

    /**
     * Probe NS fixtures in the kickoff window so NS→LIVE is discovered without waiting
     * for calendar sync or the user opening match details.
     */
    private async probeNearKickoffNsFixtures(): Promise<FixtureFromAPI[]> {
        if (isFootballQuotaExhausted() || !isPurposeAllowed('probe-kickoff')) return [];

        const nowSec = Math.floor(Date.now() / 1000);
        const windowBefore = 20 * 60;
        const windowAfter = 90 * 60;
        try {
            const candidates = await prisma.cachedFixture.findMany({
                where: {
                    status: { in: ['NS', 'TBD'] },
                    matchTimestamp: {
                        gte: nowSec - windowAfter,
                        lte: nowSec + windowBefore,
                    },
                },
                select: { fixtureId: true, matchDate: true, matchTimestamp: true, status: true },
                orderBy: { matchDate: 'asc' },
                take: NS_KICKOFF_PROBE_LIMIT * 2,
            });

            const ids = candidates
                .filter((row) => isNsNearKickoff(row.status, row.matchDate, row.matchTimestamp))
                .map((row) => row.fixtureId)
                .slice(0, NS_KICKOFF_PROBE_LIMIT);

            if (!ids.length) return [];

            const refreshed: FixtureFromAPI[] = [];
            for (let i = 0; i < ids.length; i += 20) {
                const chunk = ids.slice(i, i + 20);
                const fixtures = await footballService.getFixtures(
                    { ids: chunk.join('-') },
                    { source: 'job', purpose: 'probe-kickoff' },
                );
                if (!Array.isArray(fixtures)) continue;
                for (const fixture of fixtures) {
                    if (fixture?.fixture?.id != null) {
                        refreshed.push(fixture as FixtureFromAPI);
                    }
                }
            }

            if (refreshed.length > 0) {
                await matchCacheService.upsertFixtures(refreshed);
                const becameLive = refreshed.filter((f) =>
                    LIVE_STATUSES_SET.has(f.fixture?.status?.short ?? ''),
                );
                const becameFinished = refreshed.filter((f) =>
                    FINISHED_STATUSES_SET.has(f.fixture?.status?.short ?? ''),
                );
                if (becameLive.length > 0) {
                    logger.info(
                        `[LiveFixtureSync] NS kickoff probe: ${becameLive.length}/${refreshed.length} now LIVE`,
                    );
                    void import('./football-data-cache.service')
                        .then(async ({ footballDataCacheService }) => {
                            const { calendarTodayKey } = await import('../utils/calendar-day-bounds.util');
                            await footballDataCacheService.invalidateMatchesByDateCache(
                                calendarTodayKey(),
                                'NS_probe→LIVE',
                            );
                            for (const f of becameLive) {
                                const id = f.fixture?.id;
                                if (id != null) {
                                    await footballDataCacheService.invalidateFixtureDetailCaches(
                                        id,
                                        'NS_probe→LIVE',
                                    );
                                }
                            }
                        })
                        .catch(() => undefined);
                }
                if (becameFinished.length > 0) {
                    logger.info(
                        `[LiveFixtureSync] NS probe: ${becameFinished.length}/${refreshed.length} now FT`,
                    );
                    void import('./football-data-cache.service')
                        .then(async ({ footballDataCacheService }) => {
                            const { calendarDateFromKickoff, calendarTodayKey } = await import(
                                '../utils/calendar-day-bounds.util'
                            );
                            await footballDataCacheService.invalidateMatchesByDateCache(
                                calendarTodayKey(),
                                'NS_probe→FT',
                            );
                            for (const f of becameFinished) {
                                const id = f.fixture?.id;
                                if (id == null) continue;
                                const dateKey =
                                    calendarDateFromKickoff(f.fixture?.date ?? null) ??
                                    calendarTodayKey();
                                await footballDataCacheService.invalidateMatchesByDateCache(
                                    dateKey,
                                    'NS_probe→FT',
                                );
                                await footballDataCacheService.invalidateFixtureDetailCaches(
                                    id,
                                    'NS_probe→FT',
                                );
                            }
                        })
                        .catch(() => undefined);
                }
            }
            return refreshed;
        } catch (err) {
            logger.warn('[LiveFixtureSync] NS kickoff probe failed:', err);
            return [];
        }
    }

    private async processLiveFixtures(liveFixtures: FixtureFromAPI[]): Promise<void> {
        const currentLiveIds = new Set<number>();
        const newlyLiveIds: number[] = [];

        for (const fixture of liveFixtures) {
            const id = fixture.fixture.id;
            const status = fixture.fixture.status.short;
            if (LIVE_STATUSES_SET.has(status)) {
                currentLiveIds.add(id);
                if (!this.previouslyLiveIds.has(id) && !this.warmedLiveIds.has(id)) {
                    newlyLiveIds.push(id);
                }
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

        if (newlyLiveIds.length > 0) {
            for (const id of newlyLiveIds) {
                this.warmedLiveIds.add(id);
                void import('./football-data-cache.service')
                    .then(({ footballDataCacheService }) =>
                        footballDataCacheService.invalidateFixtureDetailCaches(id, 'NS→LIVE'),
                    )
                    .catch(() => undefined);
            }
            // List must see LIVE without waiting for matches-by-date TTL.
            void import('./football-data-cache.service')
                .then(async ({ footballDataCacheService }) => {
                    const { calendarTodayKey } = await import('../utils/calendar-day-bounds.util');
                    await footballDataCacheService.invalidateMatchesByDateCache(
                        calendarTodayKey(),
                        'NS→LIVE',
                    );
                })
                .catch(() => undefined);
            void import('./football-data-cache.service')
                .then(({ footballDataCacheService }) =>
                    footballDataCacheService.warmLiveFixtureDetails(newlyLiveIds),
                )
                .catch((err) =>
                    logger.warn('[LiveFixtureSync] live detail warm failed:', err),
                );
        }

        // Bound warmed set size
        if (this.warmedLiveIds.size > 200) {
            for (const id of this.warmedLiveIds) {
                if (!currentLiveIds.has(id)) this.warmedLiveIds.delete(id);
            }
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
            const extra = fixture.fixture.status.extra ?? null;

            const prev = this.lastSnapshots.get(id);
            const scoreChanged =
                !prev || prev.homeScore !== homeScore || prev.awayScore !== awayScore;
            const statusChanged = !prev || prev.status !== status;
            const extraChanged = !prev || prev.extra !== extra;
            const changed =
                !prev ||
                scoreChanged ||
                statusChanged ||
                extraChanged ||
                prev.elapsed !== elapsed;

            if (changed) {
                this.lastSnapshots.set(id, { homeScore, awayScore, status, elapsed, extra });
                this.broadcastMatchUpdate(id, homeScore, awayScore, status, elapsed, extra);

                if (scoreChanged) {
                    // Leagues without an event feed still get goals on the events tab.
                    void import('./synthetic-goals.service')
                        .then(({ reconcileSyntheticGoals }) =>
                            reconcileSyntheticGoals(
                                id,
                                prev ? { home: prev.homeScore, away: prev.awayScore } : null,
                                { home: homeScore, away: awayScore },
                                elapsed,
                                extra,
                            ),
                        )
                        .catch(() => undefined);
                }

                const forceEvents = scoreChanged || statusChanged;
                const nowMs = Date.now();
                const lastPush = this.lastEventPushAt.get(id) ?? 0;
                if (forceEvents || nowMs - lastPush >= 8_000) {
                    this.lastEventPushAt.set(id, nowMs);
                    void import('./live-fixture-event-push.service').then(({ pushLiveFixtureEventDelta }) =>
                        pushLiveFixtureEventDelta(id, {
                            forceRefresh: forceEvents,
                            homeScore,
                            awayScore,
                            status,
                            minute: elapsed ?? undefined,
                            extra,
                            reason: forceEvents
                                ? scoreChanged
                                    ? 'score_change'
                                    : 'status_change'
                                : 'live_tick',
                        }),
                    );
                }
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
        // Allowlist: live-sync is barred from API-Football — never wipe Redis with [].
        if (isFootballQuotaExhausted() || !isPurposeAllowed('live-sync')) {
            logger.debug('[LiveFixtureSync] API quota/allowlist pause — continuing from cached snapshots');
            await this.syncFromCachedSnapshots();
            return;
        }

        const liveFixturesRaw: FixtureFromAPI[] = await footballService.getLiveFixtures({
            source: 'job',
            purpose: 'live-sync',
        });
        let liveFixtures: FixtureFromAPI[] = isWorldCupOnlyMode()
            ? (filterWorldCupFixtures(liveFixturesRaw) as FixtureFromAPI[])
            : liveFixturesRaw;

        signal.throwIfAborted();
        // Discover NS→LIVE for matches not yet in live=all (kickoff window probe).
        const probed = await this.probeNearKickoffNsFixtures();
        signal.throwIfAborted();
        if (probed.length > 0) {
            const byId = new Map<number, FixtureFromAPI>();
            for (const f of liveFixtures) {
                if (f?.fixture?.id != null) byId.set(f.fixture.id, f);
            }
            for (const f of probed) {
                const id = f?.fixture?.id;
                const short = f?.fixture?.status?.short ?? '';
                if (id != null && LIVE_STATUSES_SET.has(short)) {
                    byId.set(id, f);
                }
            }
            liveFixtures = Array.from(byId.values());
        }

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
