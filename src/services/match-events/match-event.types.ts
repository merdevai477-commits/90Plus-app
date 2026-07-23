import type { PushTemplateKey } from '../push-templates.service';
import type { NotificationType } from '../notification.service';

/**
 * Match events that may trigger push + inbox notifications.
 * Yellow cards, substitutions, lineups, etc. are intentionally excluded.
 */
export const MATCH_PUSH_EVENT_KINDS = [
    'goal_home',
    'goal_away',
    'goal_cancelled',
    'kickoff',
    'card_red',
    'var',
    'halftime',
    'second_half_start',
    'fulltime',
] as const;

export type MatchEventKind = (typeof MATCH_PUSH_EVENT_KINDS)[number];

export type MatchNotificationPrefKey =
    | 'matchGoals'
    | 'matchStart'
    | 'matchEnd'
    | 'matchCards'
    | 'matchVar';

export interface NormalizedMatchEvent {
    fixtureId: number;
    eventKey: string;
    eventType: MatchEventKind;
    minute: number | null;
    extraMinute: number | null;
    teamId: number | null;
    playerId: number | null;
    detectedAt: Date;
    payload: Record<string, unknown>;
    templateVars: Record<string, string | number>;
    notificationType: NotificationType;
    titleKey: PushTemplateKey;
    bodyKey: PushTemplateKey;
    prefKey: MatchNotificationPrefKey | null;
    data: Record<string, unknown>;
}

export interface FixtureSnapshot {
    fixtureId: number;
    homeScore: number;
    awayScore: number;
    status: string;
    elapsed: number | null;
    isLive: boolean;
    latestEventKey: string | null;
}

export interface MatchEventIngestResult {
    fixtureId: number;
    snapshot: FixtureSnapshot;
    /** Events newly persisted in this ingest tick (not yet fan-out). */
    freshEvents: NormalizedMatchEvent[];
}
