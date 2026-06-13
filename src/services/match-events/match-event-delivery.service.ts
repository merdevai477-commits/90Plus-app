import prisma from '../../lib/prisma';
import { PredictionResolverService } from '../prediction-resolver.service';
import {
    isBaselinedGoal,
    isEventBeforeSubscribeMinute,
} from './match-subscription.service';
import type { NormalizedMatchEvent } from './match-event.types';

export type SubscriptionRow = {
    id: string;
    userId: string;
    apiMatchId: number;
    subscribedAt: Date;
    matchDate: Date;
    homeTeam: string;
    awayTeam: string;
    homeTeamLogo: string | null;
    awayTeamLogo: string | null;
    leagueName: string | null;
    baselineHomeScore: number | null;
    baselineAwayScore: number | null;
    notifiedStart: boolean;
    notifiedEnd: boolean;
};

export function shouldDeliverToSubscription(
    sub: SubscriptionRow,
    event: NormalizedMatchEvent,
): boolean {
    if (event.detectedAt < sub.subscribedAt) return false;

    if (event.eventType === 'goal_home' || event.eventType === 'goal_away') {
        return !isBaselinedGoal(sub, event);
    }

    if (event.minute != null && event.minute > 0) {
        if (isEventBeforeSubscribeMinute(sub, event.minute)) return false;
    }

    if (event.eventType === 'kickoff' && sub.notifiedStart) return false;
    if (event.eventType === 'fulltime' && sub.notifiedEnd) return false;

    return true;
}

export async function isPrefAllowed(userId: string, prefKey: string | null): Promise<boolean> {
    if (!prefKey) return true;
    try {
        const prefs = await (prisma as any).notificationPreferences.findUnique({
            where: { userId },
            select: { [prefKey]: true },
        });
        if (!prefs) return true;
        return prefs[prefKey] !== false;
    } catch {
        return true;
    }
}

export async function updateSubscriptionFlags(
    sub: SubscriptionRow,
    event: NormalizedMatchEvent,
): Promise<void> {
    const data: Record<string, unknown> = { lastDeliveredEventKey: event.eventKey };

    if (event.eventType === 'kickoff') data.notifiedStart = true;
    if (event.eventType === 'fulltime') {
        data.notifiedEnd = true;
        const homeScore = Number(event.payload.homeScore ?? event.templateVars.homeScore ?? 0);
        const awayScore = Number(event.payload.awayScore ?? event.templateVars.awayScore ?? 0);
        await PredictionResolverService.resolveMatchPredictions(sub.apiMatchId, homeScore, awayScore);
    }

    if (event.eventType === 'goal_home' || event.eventType === 'goal_away') {
        const homeScore = Number(event.payload.homeScore ?? 0);
        const awayScore = Number(event.payload.awayScore ?? 0);
        data.lastHomeScore = homeScore;
        data.lastAwayScore = awayScore;
    }

    if (event.eventType === 'halftime' || event.eventType === 'fulltime' || event.eventType === 'kickoff') {
        const status =
            event.eventType === 'halftime'
                ? 'HT'
                : event.eventType === 'fulltime'
                    ? String(event.payload.status ?? 'FT')
                    : String(event.payload.status ?? '1H');
        data.lastStatus = status;
    }

    await prisma.favoriteMatch.update({
        where: { id: sub.id },
        data: data as any,
    });
}

export async function isDeliveryRecorded(subscriptionId: string, eventKey: string): Promise<boolean> {
    const row = await prisma.matchEventDelivery.findUnique({
        where: { subscriptionId_eventKey: { subscriptionId, eventKey } },
        select: { id: true },
    });
    return row != null;
}

export async function recordMatchEventDelivery(
    subscriptionId: string,
    eventKey: string,
    fixtureId: number,
): Promise<void> {
    await prisma.matchEventDelivery.createMany({
        data: [{ subscriptionId, eventKey, fixtureId }],
        skipDuplicates: true,
    });
}
