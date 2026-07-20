import { NotificationType } from '../notification.service';
import type { PushTemplateKey } from '../push-templates.service';
import {
    buildMatchEventKey,
    buildScoreGoalEventKey,
    buildStatusEventKey,
} from '../../utils/match-event-key.util';
import type { MatchEventKind, NormalizedMatchEvent, FixtureSnapshot } from './match-event.types';

export const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']);
export const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
/** Pre-kickoff / not-started statuses (API sometimes stalls here while score advances). */
export const NS_LIKE_STATUSES = new Set(['NS', 'TBD']);

interface ApiFootballEvent {
    time: { elapsed?: number; extra?: number | null };
    team: { id: number; name: string };
    player: { id: number | null; name: string | null };
    assist: { id: number | null; name: string | null };
    type: string;
    detail: string;
}

interface ApiFootballFixture {
    fixture: { id: number; status: { short: string; elapsed?: number | null } };
    goals: { home: number | null; away: number | null };
}

function classifyApiEvent(event: ApiFootballEvent): {
    kind: MatchEventKind;
    notificationType: NotificationType;
    titleKey: PushTemplateKey;
    bodyKey: PushTemplateKey;
    prefKey: NormalizedMatchEvent['prefKey'];
} | null {
    if (event.type === 'Card') {
        if (event.detail === 'Red Card' || event.detail === 'Second Yellow card') {
            return {
                kind: 'card_red',
                notificationType: NotificationType.MATCH_RED_CARD,
                titleKey: 'matchRedCardTitle',
                bodyKey: 'matchCardBody',
                prefKey: 'matchCards',
            };
        }
        return null;
    }
    if (event.type === 'Var') {
        return {
            kind: 'var',
            notificationType: NotificationType.MATCH_UPDATE,
            titleKey: 'matchVarTitle',
            bodyKey: 'matchVarBody',
            prefKey: 'matchVar',
        };
    }
    return null;
}

export function normalizeApiEvents(
    fixtureId: number,
    events: ApiFootballEvent[],
    meta: { homeTeam: string; awayTeam: string },
): NormalizedMatchEvent[] {
    const now = new Date();
    const out: NormalizedMatchEvent[] = [];

    for (const event of events) {
        const classified = classifyApiEvent(event);
        if (!classified) continue;

        const minute = event.time?.elapsed ?? null;
        const extraMinute = event.time?.extra ?? null;
        const teamId = event.team?.id ?? null;
        const playerId = event.player?.id ?? null;
        const playerOff = event.player?.name || '';
        const playerOn = event.assist?.name || playerOff;

        const eventKey = buildMatchEventKey(fixtureId, {
            eventType: classified.kind,
            minute,
            extraMinute,
            teamId,
            playerId,
            playerName: event.player?.name ?? event.assist?.name ?? null,
            detail: event.detail || '',
        });

        out.push({
            fixtureId,
            eventKey,
            eventType: classified.kind,
            minute,
            extraMinute,
            teamId,
            playerId,
            detectedAt: now,
            payload: { api: event },
            templateVars: {
                player: event.player?.name || '',
                playerIn: playerOn,
                playerOut: playerOff,
                team: event.team?.name || '',
                minute: minute ?? '',
                detail: event.detail || '',
            },
            notificationType: classified.notificationType,
            titleKey: classified.titleKey,
            bodyKey: classified.bodyKey,
            prefKey: classified.prefKey,
            data: {
                eventKind: classified.kind,
                team: event.team?.name || '',
                elapsed: minute ?? '',
                homeTeam: meta.homeTeam,
                awayTeam: meta.awayTeam,
            },
        });
    }

    return out;
}

export function diffScoreGoals(
    fixtureId: number,
    prev: Pick<FixtureSnapshot, 'homeScore' | 'awayScore'> | null,
    current: { homeScore: number; awayScore: number },
    meta: { homeTeam: string; awayTeam: string },
): NormalizedMatchEvent[] {
    const now = new Date();
    const out: NormalizedMatchEvent[] = [];
    const prevHome = prev?.homeScore ?? 0;
    const prevAway = prev?.awayScore ?? 0;

    for (let h = prevHome + 1; h <= current.homeScore; h++) {
        const eventKey = buildScoreGoalEventKey(fixtureId, 'home', h, current.awayScore);
        out.push(buildGoalEvent(fixtureId, 'home', h, current.awayScore, eventKey, now, meta));
    }
    for (let a = prevAway + 1; a <= current.awayScore; a++) {
        const eventKey = buildScoreGoalEventKey(fixtureId, 'away', current.homeScore, a);
        out.push(buildGoalEvent(fixtureId, 'away', current.homeScore, a, eventKey, now, meta));
    }

    return out;
}

function buildGoalEvent(
    fixtureId: number,
    side: 'home' | 'away',
    homeScore: number,
    awayScore: number,
    eventKey: string,
    detectedAt: Date,
    meta: { homeTeam: string; awayTeam: string },
): NormalizedMatchEvent {
    const scorer = side === 'home' ? meta.homeTeam : meta.awayTeam;
    return {
        fixtureId,
        eventKey,
        eventType: side === 'home' ? 'goal_home' : 'goal_away',
        minute: null,
        extraMinute: null,
        teamId: null,
        playerId: null,
        detectedAt,
        payload: { scoringTeam: side, homeScore, awayScore },
        templateVars: {
            scorer,
            home: meta.homeTeam,
            away: meta.awayTeam,
            homeScore,
            awayScore,
        },
        notificationType: NotificationType.MATCH_GOAL,
        titleKey: 'goalTitle',
        bodyKey: 'goalTitle',
        prefKey: 'matchGoals',
        data: {
            type: 'MATCH_GOAL',
            eventKind: side === 'home' ? 'goal_home' : 'goal_away',
            homeScore,
            awayScore,
            scoringTeam: side,
            homeTeam: meta.homeTeam,
            awayTeam: meta.awayTeam,
        },
    };
}

function buildKickoffEvent(
    fixtureId: number,
    status: string,
    detectedAt: Date,
    meta: { homeTeam: string; awayTeam: string },
): NormalizedMatchEvent {
    return {
        fixtureId,
        // Stable key so status-path and synthetic score-path kickoffs are idempotent.
        eventKey: buildStatusEventKey(fixtureId, 'kickoff', 'kickoff'),
        eventType: 'kickoff',
        minute: 0,
        extraMinute: null,
        teamId: null,
        playerId: null,
        detectedAt,
        payload: { status },
        templateVars: { home: meta.homeTeam, away: meta.awayTeam, minutes: 0 },
        notificationType: NotificationType.MATCH_START,
        titleKey: 'matchStartTitle',
        bodyKey: 'matchStartBody',
        prefKey: 'matchStart',
        data: { type: 'MATCH_START', homeTeam: meta.homeTeam, awayTeam: meta.awayTeam },
    };
}

export function diffStatusEvents(
    fixtureId: number,
    prevStatus: string | null | undefined,
    currentStatus: string,
    scores: { homeScore: number; awayScore: number },
    meta: { homeTeam: string; awayTeam: string },
): NormalizedMatchEvent[] {
    const now = new Date();
    const out: NormalizedMatchEvent[] = [];
    const last = prevStatus ?? 'NS';

    const statusKickoff =
        !['1H', 'LIVE', 'HT'].includes(last) && ['1H', 'LIVE', 'HT'].includes(currentStatus);

    // Small leagues sometimes leave status at NS while the scoreboard advances.
    const syntheticKickoff =
        !statusKickoff &&
        NS_LIKE_STATUSES.has(currentStatus) &&
        (scores.homeScore > 0 || scores.awayScore > 0) &&
        !LIVE_STATUSES.has(last) &&
        !FINISHED_STATUSES.has(last);

    if (statusKickoff || syntheticKickoff) {
        out.push(
            buildKickoffEvent(
                fixtureId,
                statusKickoff ? currentStatus : '1H',
                now,
                meta,
            ),
        );
    }

    if (!FINISHED_STATUSES.has(last) && FINISHED_STATUSES.has(currentStatus)) {
        out.push({
            fixtureId,
            eventKey: buildStatusEventKey(fixtureId, 'fulltime', currentStatus),
            eventType: 'fulltime',
            minute: 90,
            extraMinute: null,
            teamId: null,
            playerId: null,
            detectedAt: now,
            payload: { status: currentStatus, ...scores },
            templateVars: {
                home: meta.homeTeam,
                away: meta.awayTeam,
                homeScore: scores.homeScore,
                awayScore: scores.awayScore,
            },
            notificationType: NotificationType.MATCH_UPDATE,
            titleKey: 'fulltimeTitle',
            bodyKey: 'fulltimeBody',
            prefKey: 'matchEnd',
            data: {
                type: 'MATCH_END',
                homeScore: scores.homeScore,
                awayScore: scores.awayScore,
                homeTeam: meta.homeTeam,
                awayTeam: meta.awayTeam,
            },
        });
    }

    return out;
}

export function parseFixtureSnapshot(fixtureId: number, raw: ApiFootballFixture): FixtureSnapshot {
    const status = raw.fixture.status.short;
    const homeScore = raw.goals.home ?? 0;
    const awayScore = raw.goals.away ?? 0;
    return {
        fixtureId,
        homeScore,
        awayScore,
        status,
        elapsed: raw.fixture.status.elapsed ?? null,
        isLive: LIVE_STATUSES.has(status),
        latestEventKey: null,
    };
}

/** In-memory fixture state between ingest ticks (per process). */
const fixtureStateCache = new Map<number, FixtureSnapshot>();

export function getCachedFixtureState(fixtureId: number): FixtureSnapshot | null {
    return fixtureStateCache.get(fixtureId) ?? null;
}

export function setCachedFixtureState(snapshot: FixtureSnapshot): void {
    fixtureStateCache.set(snapshot.fixtureId, snapshot);
}

export function clearCachedFixtureState(fixtureId: number): void {
    fixtureStateCache.delete(fixtureId);
}
