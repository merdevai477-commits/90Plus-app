import { addBreadcrumb } from '../config/sentry.config';
import { logger } from '../utils/logger';
import { footballDataCacheService } from './football-data-cache.service';
import WebSocketService, { type MatchUpdatePayload, type WsFixtureEvent } from './websocket.service';

/** Dedupe key for events already pushed over WS (per fixture). */
const lastPushedEventKeys = new Map<number, Set<string>>();

export function fixtureEventDedupeKey(event: WsFixtureEvent): string {
    const elapsed = event?.time?.elapsed ?? 0;
    const extra = event?.time?.extra ?? 0;
    const type = event?.type ?? '';
    const detail = event?.detail ?? '';
    const playerId = event?.player?.id ?? 0;
    const teamId = event?.team?.id ?? 0;
    return `${elapsed}:${extra}:${type}:${detail}:${playerId}:${teamId}`;
}

export function resetPushedEventsForFixture(fixtureId: number): void {
    lastPushedEventKeys.delete(fixtureId);
}

export interface PushEventDeltaContext {
    forceRefresh?: boolean;
    homeScore: number;
    awayScore: number;
    status: string;
    minute?: number;
    extra?: number | null;
    reason?: string;
}

/**
 * Fetch latest events and push only newly-seen items over match_update.newEvents.
 * Called from LiveFixtureSync on score/status changes and periodic live ticks.
 */
export async function pushLiveFixtureEventDelta(
    fixtureId: number,
    context: PushEventDeltaContext,
): Promise<number> {
    const startedAt = Date.now();
    try {
        const events = await footballDataCacheService.getMatchEvents(fixtureId, {
            forceRefresh: context.forceRefresh === true,
        });
        if (!Array.isArray(events) || events.length === 0) {
            addBreadcrumb('WS event push — no events', 'match-details.ws', 'info', {
                fixtureId,
                reason: context.reason,
                latencyMs: Date.now() - startedAt,
            });
            return 0;
        }

        const prevKeys = lastPushedEventKeys.get(fixtureId) ?? new Set<string>();
        const newEvents: WsFixtureEvent[] = [];
        const nextKeys = new Set(prevKeys);

        for (const raw of events) {
            const event = raw as WsFixtureEvent;
            const key = fixtureEventDedupeKey(event);
            if (prevKeys.has(key)) continue;
            newEvents.push(event);
            nextKeys.add(key);
        }

        if (newEvents.length === 0) {
            return 0;
        }

        lastPushedEventKeys.set(fixtureId, nextKeys);

        const payload: MatchUpdatePayload = {
            matchId: fixtureId,
            homeScore: context.homeScore,
            awayScore: context.awayScore,
            status: context.status,
            minute: context.minute,
            extra: context.extra,
            newEvents,
        };
        WebSocketService.sendMatchUpdate(fixtureId, payload);

        addBreadcrumb('WS match_event push', 'match-details.ws', 'info', {
            fixtureId,
            newEventCount: newEvents.length,
            reason: context.reason,
            latencyMs: Date.now() - startedAt,
        });

        logger.debug(
            `[LiveFixtureEventPush] fixture ${fixtureId}: pushed ${newEvents.length} event(s) (${context.reason ?? 'delta'})`,
        );
        return newEvents.length;
    } catch (err: unknown) {
        logger.warn(
            `[LiveFixtureEventPush] fixture ${fixtureId} failed:`,
            (err as Error)?.message,
        );
        return 0;
    }
}
