import { logger } from '../../utils/logger';
import { loadActiveSubscriptions } from './match-subscriber-index.adapter';
import {
    isPrefAllowed,
    isPushNotifiableMatchEvent,
    shouldDeliverToSubscription,
} from './match-event-delivery.service';
import type { NormalizedMatchEvent } from './match-event.types';
import { processMatchEventPushJob } from './match-event-push.processor';
import type { MatchEventPushJob } from '../../queues/match-event-push.queue';

type SubscriptionRow = Awaited<ReturnType<typeof loadActiveSubscriptions>>[number];

function buildPushPayload(sub: SubscriptionRow, event: NormalizedMatchEvent) {
    const fixtureIdStr = String(event.fixtureId);
    const matchMeta = {
        homeTeam: sub.homeTeam,
        awayTeam: sub.awayTeam,
        homeTeamLogo: sub.homeTeamLogo ?? '',
        awayTeamLogo: sub.awayTeamLogo ?? '',
        leagueName: sub.leagueName ?? '',
        matchDate: sub.matchDate,
    };

    let vars = { ...event.templateVars };

    if (event.eventType === 'goal_home' || event.eventType === 'goal_away') {
        const side = event.eventType === 'goal_home' ? 'home' : 'away';
        const scorer = side === 'home' ? sub.homeTeam : sub.awayTeam;
        const homeScore = Number(event.payload.homeScore ?? 0);
        const awayScore = Number(event.payload.awayScore ?? 0);
        vars = {
            ...vars,
            scorer,
            team: scorer,
            home: sub.homeTeam,
            away: sub.awayTeam,
            homeScore,
            awayScore,
        };
    }

    if (event.eventType === 'goal_cancelled') {
        const side = String(event.payload.cancelledTeam ?? 'home') === 'away' ? 'away' : 'home';
        const team = side === 'home' ? sub.homeTeam : sub.awayTeam;
        vars = {
            ...vars,
            team,
            home: sub.homeTeam,
            away: sub.awayTeam,
            homeScore: Number(event.payload.homeScore ?? 0),
            awayScore: Number(event.payload.awayScore ?? 0),
        };
    }

    return {
        subscriptionId: sub.id,
        userId: sub.userId,
        event,
        fixtureId: event.fixtureId,
        notificationType: event.notificationType,
        titleKey: event.titleKey,
        bodyKey: event.bodyKey,
        // Never hard-code copy here — processor renders localized templates.
        vars,
        prefKey: event.prefKey,
        data: {
            screen: '/(tabs)/match-details',
            matchId: fixtureIdStr,
            fixtureId: fixtureIdStr,
            priority: 'high',
            ...matchMeta,
            ...event.data,
        },
        idempotencyKey: `match-event:${event.eventKey}:${sub.userId}`,
    };
}

/**
 * Deliver push + inbox immediately (same path as social notifications — no Bull delay).
 */
export async function fanOutMatchEvent(event: NormalizedMatchEvent): Promise<number> {
    if (!isPushNotifiableMatchEvent(event)) return 0;

    const subs = await loadActiveSubscriptions(event.fixtureId);
    if (subs.length === 0) return 0;

    const payloads: MatchEventPushJob[] = [];

    for (const sub of subs) {
        if (!shouldDeliverToSubscription(sub, event)) continue;
        if (!(await isPrefAllowed(sub.userId, event.prefKey))) continue;
        payloads.push(buildPushPayload(sub, event));
    }

    if (payloads.length === 0) return 0;

    const results = await Promise.allSettled(
        payloads.map((payload) => processMatchEventPushJob(payload)),
    );

    for (const result of results) {
        if (result.status === 'rejected') {
            logger.warn('[MatchEventFanout] immediate push failed:', result.reason?.message ?? result.reason);
        }
    }

    return payloads.length;
}

export async function fanOutMatchEvents(events: NormalizedMatchEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const counts = await Promise.all(events.map((event) => fanOutMatchEvent(event)));
    return counts.reduce((sum, n) => sum + n, 0);
}
