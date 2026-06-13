import type { PushTemplateKey } from '../push-templates.service';
import type { NotificationType } from '../notification.service';

/** Canonical event kinds emitted by the ingestor. */
export type MatchEventKind =
    | 'goal_home'
    | 'goal_away'
    | 'kickoff'
    | 'halftime'
    | 'fulltime'
    | 'card_yellow'
    | 'card_red'
    | 'substitution'
    | 'var'
    | 'penalty'
    | 'lineup';

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
    prefKey: 'matchGoals' | 'matchStart' | 'matchEnd' | 'matchHalftime' | 'matchCards' | 'matchSubs' | 'matchVar' | 'matchLineups' | null;
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
