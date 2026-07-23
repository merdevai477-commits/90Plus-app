import prisma from '../../lib/prisma';
import { randomUUID } from 'crypto';
import { PredictionResolverService } from '../prediction-resolver.service';
import {
    isBaselinedGoal,
    isEventBeforeSubscribeMinute,
    isStatusEventObsolete,
    isCatchUpReplayEvent,
} from './match-subscription.service';
import type { MatchEventKind, NormalizedMatchEvent } from './match-event.types';
import { MATCH_PUSH_EVENT_KINDS } from './match-event.types';

/** Only these live-match events trigger push/inbox notifications. */
const PUSH_NOTIFIABLE_MATCH_EVENTS = new Set<MatchEventKind>(MATCH_PUSH_EVENT_KINDS);

export function isPushNotifiableMatchEvent(event: NormalizedMatchEvent): boolean {
    return PUSH_NOTIFIABLE_MATCH_EVENTS.has(event.eventType);
}

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
    baselineStatus: string | null;
    notifiedStart: boolean;
    notifiedEnd: boolean;
};

export function shouldDeliverToSubscription(
    sub: SubscriptionRow,
    event: NormalizedMatchEvent,
): boolean {
    if (event.detectedAt < sub.subscribedAt) return false;

    if (isStatusEventObsolete(sub.baselineStatus, event.eventType)) {
        return false;
    }

    if (event.eventType === 'goal_home' || event.eventType === 'goal_away') {
        return !isBaselinedGoal(sub, event);
    }

    // Score drops after subscribe are live; block only immediate catch-up replays.
    if (event.eventType === 'goal_cancelled') {
        if (isCatchUpReplayEvent(sub, event)) return false;
        return true;
    }

    if (isCatchUpReplayEvent(sub, event)) return false;

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

    if (
        event.eventType === 'goal_home' ||
        event.eventType === 'goal_away' ||
        event.eventType === 'goal_cancelled'
    ) {
        const homeScore = Number(event.payload.homeScore ?? 0);
        const awayScore = Number(event.payload.awayScore ?? 0);
        data.lastHomeScore = homeScore;
        data.lastAwayScore = awayScore;
    }

    if (event.eventType === 'fulltime' || event.eventType === 'kickoff') {
        const status =
            event.eventType === 'fulltime'
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
        select: { status: true } as any,
    });
    return (row as any)?.status === 'SENT';
}

export type MatchEventDeliveryClaim = {
    subscriptionId: string;
    eventKey: string;
    token: string;
};

const DELIVERY_CLAIM_MS = 2 * 60 * 1000;

/**
 * Atomically reserve a delivery attempt. SENT rows are immutable; abandoned
 * PROCESSING rows become retryable after the short claim deadline.
 */
export async function claimMatchEventDelivery(
    subscriptionId: string,
    eventKey: string,
    fixtureId: number,
): Promise<MatchEventDeliveryClaim | null> {
    const token = randomUUID();
    const now = new Date();
    const processingUntil = new Date(now.getTime() + DELIVERY_CLAIM_MS);

    try {
        await (prisma.matchEventDelivery as any).create({
            data: {
                subscriptionId,
                eventKey,
                fixtureId,
                status: 'PROCESSING',
                processingToken: token,
                processingUntil,
            },
        });
        return { subscriptionId, eventKey, token };
    } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
    }

    const claimed = await (prisma.matchEventDelivery as any).updateMany({
        where: {
            subscriptionId,
            eventKey,
            status: { not: 'SENT' },
            OR: [
                { status: 'PENDING' },
                { processingUntil: null },
                { processingUntil: { lt: now } },
            ],
        },
        data: {
            status: 'PROCESSING',
            processingToken: token,
            processingUntil,
        },
    });
    return claimed.count === 1 ? { subscriptionId, eventKey, token } : null;
}

export async function completeMatchEventDelivery(
    claim: MatchEventDeliveryClaim,
): Promise<boolean> {
    const completed = await (prisma.matchEventDelivery as any).updateMany({
        where: {
            subscriptionId: claim.subscriptionId,
            eventKey: claim.eventKey,
            status: 'PROCESSING',
            processingToken: claim.token,
        },
        data: {
            status: 'SENT',
            deliveredAt: new Date(),
            processingToken: null,
            processingUntil: null,
        },
    });
    return completed.count === 1;
}

export async function releaseMatchEventDeliveryClaim(
    claim: MatchEventDeliveryClaim,
): Promise<void> {
    await (prisma.matchEventDelivery as any).updateMany({
        where: {
            subscriptionId: claim.subscriptionId,
            eventKey: claim.eventKey,
            status: 'PROCESSING',
            processingToken: claim.token,
        },
        data: {
            status: 'PENDING',
            processingToken: null,
            processingUntil: null,
        },
    });
}
