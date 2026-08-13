import prisma from '../../lib/prisma';
import { footballService } from '../football.service';
import { logger } from '../../utils/logger';
import { matchCacheService } from '../match-cache.service';
import { isNative365FixtureId } from '../../utils/native-365-fixture-id';
import { getScores365ExperimentFixture } from '../scores365-experiment.service';
import {
    parseFixtureSnapshot,
    LIVE_STATUSES,
    FINISHED_STATUSES,
    getCachedFixtureState,
    setCachedFixtureState,
} from './match-event-normalizer';
import type { FixtureSnapshot } from './match-event.types';
import { addSubscriberToIndex } from './match-subscriber-index.adapter';
import { MatchEventIngestor } from './match-event-ingestor.service';

export interface SubscribeBaselineInput {
    userId: string;
    fixtureId: number;
    matchDate: Date;
    homeTeam: string;
    awayTeam: string;
    homeTeamLogo?: string | null;
    awayTeamLogo?: string | null;
    leagueName?: string | null;
}

export interface SubscribeBaselineResult {
    subscriptionId: string;
    snapshot: FixtureSnapshot;
}

/** Fetch current fixture state. Native 365 gameIds never hit API-Football. */
export async function fetchFixtureSnapshot(fixtureId: number): Promise<FixtureSnapshot | null> {
    try {
        const cached = getCachedFixtureState(fixtureId);
        if (cached) return cached;

        if (isNative365FixtureId(fixtureId)) {
            const dbRow = await prisma.cachedFixture.findUnique({ where: { fixtureId } });
            if (dbRow) {
                return parseFixtureSnapshot(fixtureId, matchCacheService.convertDbMatchToApiFormat(dbRow));
            }
            const from365 = await getScores365ExperimentFixture(fixtureId);
            if (from365) return parseFixtureSnapshot(fixtureId, from365);
            logger.warn(
                `[MatchSubscription] 365 snapshot missing for ${fixtureId} — no API-Football fallback`,
            );
            return null;
        }

        const data = await footballService.fetchFromApi<any[]>('/fixtures', { id: fixtureId });
        if (!data?.length) return null;
        return parseFixtureSnapshot(fixtureId, data[0]);
    } catch (err: any) {
        logger.warn(`[MatchSubscription] fetchFixtureSnapshot ${fixtureId} failed:`, err?.message);
        return getCachedFixtureState(fixtureId);
    }
}

function isMatchAlreadyStarted(status: string): boolean {
    return (
        LIVE_STATUSES.has(status) ||
        FINISHED_STATUSES.has(status) ||
        ['HT', '2H', 'ET', 'BT', 'P'].includes(status)
    );
}

/**
 * Upsert FavoriteMatch with subscription anchor + baseline scores.
 *
 * Mid-match follows must NOT replay historical goals/cards/VAR/HT:
 * 1) Snapshot current score/status into process cache (blocks scoreboard catch-up diffs)
 * 2) Persist current event feed without fan-out
 * 3) Create subscription
 * 4) Seed delivery ledger as SENT for every known event
 * 5) Only then add Redis subscriber index
 */
export async function subscribeWithBaseline(input: SubscribeBaselineInput): Promise<SubscribeBaselineResult> {
    const subscribedAt = new Date();
    const snapshot =
        (await fetchFixtureSnapshot(input.fixtureId)) ?? {
            fixtureId: input.fixtureId,
            homeScore: 0,
            awayScore: 0,
            status: 'NS',
            elapsed: null,
            isLive: false,
            latestEventKey: null,
        };

    // Prevent scoreboard catch-up (0-0 → current) from looking like brand-new goals.
    setCachedFixtureState(snapshot);

    // Persist historical feed rows BEFORE this user becomes a fan-out target.
    try {
        await MatchEventIngestor.ingestFixture(
            input.fixtureId,
            { homeTeam: input.homeTeam, awayTeam: input.awayTeam },
            { forceRefreshEvents: true, forceApiRefresh: false },
        );
        // Keep cache pinned to subscribe snapshot (ingest may overwrite with same values).
        setCachedFixtureState(snapshot);
    } catch (err: any) {
        logger.warn(
            `[MatchSubscription] pre-subscribe ingest ${input.fixtureId} failed:`,
            err?.message,
        );
    }

    const alreadyStarted = isMatchAlreadyStarted(snapshot.status);
    const alreadyFinished = FINISHED_STATUSES.has(snapshot.status);

    const subscription = await prisma.favoriteMatch.upsert({
        where: {
            userId_apiMatchId: { userId: input.userId, apiMatchId: input.fixtureId },
        },
        create: {
            userId: input.userId,
            apiMatchId: input.fixtureId,
            matchDate: input.matchDate,
            homeTeam: input.homeTeam,
            awayTeam: input.awayTeam,
            homeTeamLogo: input.homeTeamLogo ?? null,
            awayTeamLogo: input.awayTeamLogo ?? null,
            leagueName: input.leagueName ?? null,
            subscribedAt,
            baselineHomeScore: snapshot.homeScore,
            baselineAwayScore: snapshot.awayScore,
            baselineStatus: snapshot.status,
            lastHomeScore: snapshot.homeScore,
            lastAwayScore: snapshot.awayScore,
            lastStatus: snapshot.status,
            notifiedStart: alreadyStarted,
            notifiedEnd: alreadyFinished,
        },
        update: {
            matchDate: input.matchDate,
            homeTeam: input.homeTeam,
            awayTeam: input.awayTeam,
            homeTeamLogo: input.homeTeamLogo ?? null,
            awayTeamLogo: input.awayTeamLogo ?? null,
            leagueName: input.leagueName ?? null,
            subscribedAt,
            baselineHomeScore: snapshot.homeScore,
            baselineAwayScore: snapshot.awayScore,
            baselineStatus: snapshot.status,
            lastHomeScore: snapshot.homeScore,
            lastAwayScore: snapshot.awayScore,
            lastStatus: snapshot.status,
            notifiedStart: alreadyStarted,
            notifiedEnd: alreadyFinished,
            lastDeliveredEventKey: null,
        },
    });

    // Seed delivery ledger: everything already known at subscribe is silent.
    const existingEvents = await prisma.matchEvent.findMany({
        where: { fixtureId: input.fixtureId },
        select: { eventKey: true, fixtureId: true },
        orderBy: { detectedAt: 'asc' },
    });

    if (existingEvents.length > 0) {
        await prisma.matchEventDelivery.createMany({
            data: existingEvents.map((e) => ({
                subscriptionId: subscription.id,
                eventKey: e.eventKey,
                fixtureId: e.fixtureId,
                status: 'SENT',
                deliveredAt: subscribedAt,
            })),
            skipDuplicates: true,
        });

        const latest = existingEvents[existingEvents.length - 1];
        await prisma.favoriteMatch.update({
            where: { id: subscription.id },
            data: { lastDeliveredEventKey: latest.eventKey },
        });
    }

    await addSubscriberToIndex(input.fixtureId, subscription.id);

    logger.info(
        `[MatchSubscription] subscribed user=${input.userId} fixture=${input.fixtureId} ` +
            `score=${snapshot.homeScore}-${snapshot.awayScore} status=${snapshot.status} ` +
            `seeded=${existingEvents.length} events`,
    );

    return { subscriptionId: subscription.id, snapshot };
}

/** Localized push confirming the user followed/starred a match (home + matches bell). */
export async function notifyMatchFavoriteConfirmation(params: {
    userId: string;
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    leagueName?: string | null;
}): Promise<void> {
    const { notifyUser } = await import('../notify.service');
    const { NotificationType } = await import('../notification.service');
    const { userId, fixtureId, homeTeam, awayTeam, leagueName } = params;

    await notifyUser({
        userId,
        type: NotificationType.MATCH_FAVORITE,
        titleKey: 'matchFavoriteTitle',
        bodyKey: 'matchFavoriteBody',
        vars: { home: homeTeam, away: awayTeam },
        bypassPreferences: true,
        // v2 bypasses stale Redis claims created while the production
        // notification schema was missing during the reliability rollout.
        idempotencyKey: `match-favorite:v2:${userId}:${fixtureId}`,
        data: {
            type: 'MATCH_FAVORITE',
            matchId: String(fixtureId),
            fixtureId: String(fixtureId),
            homeTeam,
            awayTeam,
            leagueName: leagueName ?? '',
            screen: '/(tabs)/match-details',
        },
    });
}

export function isLiveStatus(status: string): boolean {
    return LIVE_STATUSES.has(status);
}

/** Whether a goal event was already reflected in the subscription baseline score. */
export function isBaselinedGoal(
    sub: {
        baselineHomeScore: number | null;
        baselineAwayScore: number | null;
        subscribedAt: Date;
    },
    event: { eventType: string; detectedAt: Date; payload: Record<string, unknown> },
): boolean {
    if (event.detectedAt < sub.subscribedAt) return true;

    const homeScore = Number(event.payload.homeScore ?? 0);
    const awayScore = Number(event.payload.awayScore ?? 0);
    const baseHome = sub.baselineHomeScore ?? 0;
    const baseAway = sub.baselineAwayScore ?? 0;

    if (event.eventType === 'goal_home' && homeScore <= baseHome) return true;
    if (event.eventType === 'goal_away' && awayScore <= baseAway) return true;

    return false;
}

/**
 * Status phases for suppressing obsolete kickoff/HT/2H/FT on mid-match follow.
 * Higher number = later in the match.
 */
export function statusPhase(status: string | null | undefined): number {
    const s = status || 'NS';
    if (FINISHED_STATUSES.has(s) || s === 'CANC' || s === 'ABD' || s === 'AWD' || s === 'WO') return 50;
    if (s === '2H' || s === 'ET' || s === 'BT' || s === 'P') return 30;
    if (s === 'HT') return 20;
    if (s === '1H' || s === 'LIVE' || s === 'INT' || s === 'SUSP') return 10;
    return 0;
}

/** True when this status event is already in the past relative to baselineStatus. */
export function isStatusEventObsolete(
    baselineStatus: string | null | undefined,
    eventType: string,
): boolean {
    const phase = statusPhase(baselineStatus);
    if (eventType === 'kickoff') return phase >= 10;
    if (eventType === 'halftime') return phase >= 20;
    if (eventType === 'second_half_start') return phase >= 30;
    if (eventType === 'fulltime') return phase >= 50;
    return false;
}

/** Subscription minute filter for API events with explicit minute (cards/VAR). */
export function isEventBeforeSubscribeMinute(
    sub: { subscribedAt: Date; matchDate: Date },
    eventMinute: number,
): boolean {
    if (eventMinute <= 0) return false;
    const kickoffMs = new Date(sub.matchDate).getTime();
    if (!Number.isFinite(kickoffMs)) return false;
    const subscribedMinute = Math.floor(
        (new Date(sub.subscribedAt).getTime() - kickoffMs) / 60_000,
    );
    if (subscribedMinute <= 0) return false;
    return eventMinute <= subscribedMinute;
}

/**
 * Catch-up burst right after mid-match follow: historical API rows get detectedAt=now.
 * Drop timed events that land within a short window after subscribe when the match
 * was already underway (seed + baseline cover the real history).
 */
export function isCatchUpReplayEvent(
    sub: {
        subscribedAt: Date;
        baselineStatus: string | null;
        matchDate: Date;
    },
    event: { detectedAt: Date; minute: number | null },
): boolean {
    if (!isMatchAlreadyStarted(sub.baselineStatus || 'NS')) return false;
    const msSinceSub = event.detectedAt.getTime() - sub.subscribedAt.getTime();
    if (msSinceSub < 0 || msSinceSub > 20_000) return false;

    if (event.minute != null && event.minute > 0) {
        if (isEventBeforeSubscribeMinute(sub, event.minute)) return true;
        // Bad/missing kickoff clock mid-match: still treat immediate timed replays as historical.
        const kickoffMs = new Date(sub.matchDate).getTime();
        const subscribedMinute = Number.isFinite(kickoffMs)
            ? Math.floor((sub.subscribedAt.getTime() - kickoffMs) / 60_000)
            : 0;
        if (subscribedMinute <= 0) return true;
    }

    return false;
}
