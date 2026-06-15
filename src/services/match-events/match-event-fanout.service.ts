import { logger } from '../../utils/logger';
import { loadActiveSubscriptions } from './match-subscriber-index.adapter';
import { isPrefAllowed, shouldDeliverToSubscription } from './match-event-delivery.service';
import type { NormalizedMatchEvent } from './match-event.types';
import { enqueueMatchEventPush } from '../../queues/match-event-push.queue';

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

    let vars = event.templateVars;
    let customMessage: string | undefined;

    if (event.eventType === 'goal_home' || event.eventType === 'goal_away') {
        const side = event.eventType === 'goal_home' ? 'home' : 'away';
        const scorer = side === 'home' ? sub.homeTeam : sub.awayTeam;
        const homeScore = Number(event.payload.homeScore ?? 0);
        const awayScore = Number(event.payload.awayScore ?? 0);
        customMessage = `${scorer} — ${sub.homeTeam} ${homeScore} - ${awayScore} ${sub.awayTeam}`;
        vars = { ...vars, scorer, homeScore, awayScore };
    }

    return {
        subscriptionId: sub.id,
        userId: sub.userId,
        event,
        fixtureId: event.fixtureId,
        notificationType: event.notificationType,
        titleKey: event.titleKey,
        bodyKey: event.bodyKey,
        message: customMessage,
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
 * Enqueue push jobs only — delivery ledger is written by the worker after push succeeds.
 */
export async function fanOutMatchEvent(event: NormalizedMatchEvent): Promise<number> {
    const subs = await loadActiveSubscriptions(event.fixtureId);
    if (subs.length === 0) return 0;

    let enqueued = 0;

    for (const sub of subs) {
        if (!shouldDeliverToSubscription(sub, event)) continue;
        if (!(await isPrefAllowed(sub.userId, event.prefKey))) continue;

        try {
            const payload = buildPushPayload(sub, event);
            await enqueueMatchEventPush(payload);
            enqueued++;
        } catch (err: any) {
            logger.warn(
                `[MatchEventFanout] enqueue failed sub=${sub.id} event=${event.eventKey}:`,
                err?.message,
            );
        }
    }

    return enqueued;
}

export async function fanOutMatchEvents(events: NormalizedMatchEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const counts = await Promise.all(events.map((event) => fanOutMatchEvent(event)));
    return counts.reduce((sum, n) => sum + n, 0);
}
