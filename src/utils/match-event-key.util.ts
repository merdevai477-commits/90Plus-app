import { createHash } from 'crypto';
import type { MatchEventKind } from '../services/match-events/match-event.types';

export function buildMatchEventKey(
    fixtureId: number,
    parts: {
        eventType: MatchEventKind | string;
        minute?: number | null;
        extraMinute?: number | null;
        teamId?: number | null;
        playerId?: number | null;
        playerName?: string | null;
        detail?: string | null;
        /** For synthetic score-based goals — disambiguates multiple goals at same scoreline step */
        scoreMarker?: string | null;
    },
): string {
    const playerSegment =
        parts.playerId != null ? String(parts.playerId) : (parts.playerName?.trim() || 'na');
    const segments = [
        fixtureId,
        parts.eventType,
        parts.minute ?? 'na',
        parts.extraMinute ?? 0,
        parts.teamId ?? 'na',
        playerSegment,
        parts.detail ?? '',
        parts.scoreMarker ?? '',
    ];
    return createHash('sha256').update(segments.join(':')).digest('hex').slice(0, 32);
}

/** Stable key for a score-transition goal (home or away side). */
export function buildScoreGoalEventKey(
    fixtureId: number,
    side: 'home' | 'away',
    homeScore: number,
    awayScore: number,
): string {
    return buildMatchEventKey(fixtureId, {
        eventType: side === 'home' ? 'goal_home' : 'goal_away',
        scoreMarker: `${homeScore}-${awayScore}`,
    });
}

/** Stable key for status-transition events (kickoff, HT, FT). */
export function buildStatusEventKey(fixtureId: number, eventType: string, status: string): string {
    return buildMatchEventKey(fixtureId, {
        eventType,
        detail: status,
    });
}
