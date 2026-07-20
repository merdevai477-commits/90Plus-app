import prisma from '../../lib/prisma';
import { footballService } from '../football.service';
import { logger } from '../../utils/logger';
import {
    parseFixtureSnapshot,
    LIVE_STATUSES,
    getCachedFixtureState,
} from './match-event-normalizer';
import type { FixtureSnapshot } from './match-event.types';
import { addSubscriberToIndex } from './match-subscriber-index.adapter';

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

/** Fetch current fixture state from API-Football (for immediate baseline on subscribe). */
export async function fetchFixtureSnapshot(fixtureId: number): Promise<FixtureSnapshot | null> {
    try {
        const data = await footballService.fetchFromApi<any[]>('/fixtures', { id: fixtureId });
        if (!data?.length) return null;
        return parseFixtureSnapshot(fixtureId, data[0]);
    } catch (err: any) {
        logger.warn(`[MatchSubscription] fetchFixtureSnapshot ${fixtureId} failed:`, err?.message);
        return getCachedFixtureState(fixtureId);
    }
}

/**
 * Upsert FavoriteMatch with subscription anchor + baseline scores.
 * Marks all existing MatchEvent rows for this fixture as delivered for this subscription
 * so mid-match follows never replay historical events.
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

    const alreadyStarted =
        snapshot.isLive || ['HT', '2H', 'ET', 'BT', 'P'].includes(snapshot.status);

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
            notifiedEnd: false,
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
            notifiedEnd: false,
            lastDeliveredEventKey: null,
        },
    });

    // Seed delivery ledger: all events that already happened before subscribe are "delivered" silently.
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
        idempotencyKey: `match-favorite:${userId}:${fixtureId}`,
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

/** Subscription minute filter for API events with explicit minute (cards/subs). */
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
