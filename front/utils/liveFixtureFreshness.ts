/**
 * Live-row vs in-memory snapshot precedence for the Matches List.
 * Incoming Redis/calendar/live-feed rows must win when they are strictly
 * newer; older payloads must not regress elapsed, score, or period.
 */

import type { Fixture } from '../services/apiFootball';
import type { Match } from '../components/Matches/matchCardUtils';
import { formatLiveMinuteDisplay } from './formatLiveMinuteDisplay';
import { FINISHED_STATUS_SHORTS } from '../src/store/liveFixtureStore.types';

export type LiveClockView = {
  short: string;
  elapsed: number | null;
  extra: number | null;
  home: number;
  away: number;
};

export type LiveMergeReason =
  | 'INSERT'
  | 'STATUS_CHANGE'
  | 'SCORE_CHANGE'
  | 'ELAPSED_ADVANCE'
  | 'OLDER'
  | 'EQUAL';

export type LiveMergeAction = 'INSERT' | 'REPLACE' | 'KEEP';

export type LiveMergeDecision = {
  action: LiveMergeAction;
  reason: LiveMergeReason;
};

const LIVE_MERGE_LOG =
  process.env.EXPO_PUBLIC_LIVE_MERGE_FIX_LOG === '1' ||
  process.env.EXPO_PUBLIC_LIVE_MERGE_FIX_LOG === 'true';

const LIVE_RENDER_LOG =
  process.env.EXPO_PUBLIC_LIVE_RENDER_FIX_LOG === '1' ||
  process.env.EXPO_PUBLIC_LIVE_RENDER_FIX_LOG === 'true';

export function logLiveMergeFix(
  fixtureId: number,
  existing: LiveClockView | null,
  incoming: LiveClockView,
  decision: LiveMergeDecision,
): void {
  if (!LIVE_MERGE_LOG) return;
  if (decision.reason === 'EQUAL') return;
  console.info(
    JSON.stringify({
      tag: 'LIVE-MERGE-FIX',
      t: new Date().toISOString(),
      fixtureId,
      existingElapsed: existing?.elapsed ?? null,
      incomingElapsed: incoming.elapsed,
      existingStatus: existing?.short ?? null,
      incomingStatus: incoming.short,
      existingScore:
        existing != null ? `${existing.home}-${existing.away}` : null,
      incomingScore: `${incoming.home}-${incoming.away}`,
      decision: decision.action,
      reason: decision.reason,
    }),
  );
}

/** Temporary PTR/render-pipeline diagnostic. Default off. */
export function logLiveRenderFix(fields: Record<string, unknown>): void {
  if (!LIVE_RENDER_LOG) return;
  console.info(
    JSON.stringify({
      tag: 'LIVE-RENDER-FIX',
      t: new Date().toISOString(),
      ...fields,
    }),
  );
}

/** Cheap fingerprint for list-row live fields (status + score + elapsed/extra/minute). */
export function matchLiveFingerprint(row: Match): string {
  return `${row.status}|${row.score?.home ?? ''}|${row.score?.away ?? ''}|${row.elapsed ?? ''}|${row.extra ?? ''}|${row.minute ?? ''}|${row.statusShort ?? ''}|${row.corners?.home ?? ''}|${row.corners?.away ?? ''}`;
}

/**
 * Keep baked `minute` aligned with elapsed/status/extra so MatchRow cannot
 * show a stale label. Render also prefers resolveLiveMinuteLabel(elapsed) first.
 */
export function withAuthoritativeLiveMinute(row: Match): Match {
  if (row.status !== 'live') return row;
  const label = formatLiveMinuteDisplay(
    row.statusShort ?? '',
    row.elapsed,
    row.extra,
  );
  if (!label || row.minute === label) return row;
  return { ...row, minute: label };
}

function normalizeShort(short: string | null | undefined): string {
  return (short ?? '').trim().toUpperCase();
}

/** Period rank — higher is later in the match. LIVE/INT/SUSP map via elapsed. */
export function liveStatusRank(short: string, elapsed: number | null): number {
  const s = normalizeShort(short);
  if (s === 'NS' || s === 'TBD' || s === 'PST' || s === 'TIME') return 0;
  if (s === '1H') return 10;
  if (s === 'HT') return 20;
  if (s === '2H') return 30;
  if (s === 'BT') return 35;
  if (s === 'ET') return 40;
  if (s === 'P') return 45;
  if (FINISHED_STATUS_SHORTS.has(s)) return 50;
  if (s === 'LIVE' || s === 'INT' || s === 'SUSP') {
    if (elapsed != null && elapsed > 90) return 40;
    if (elapsed != null && elapsed > 45) return 30;
    return 10;
  }
  return 10;
}

export function clockFromFixture(fixture: Fixture): LiveClockView {
  const st = fixture.fixture?.status;
  return {
    short: normalizeShort(st?.short),
    elapsed: st?.elapsed ?? null,
    extra: st?.extra ?? null,
    home: fixture.goals?.home ?? 0,
    away: fixture.goals?.away ?? 0,
  };
}

export function clockFromMatch(row: Match): LiveClockView {
  return {
    short: normalizeShort(row.statusShort ?? (row.status === 'finished' ? 'FT' : '')),
    elapsed: row.elapsed ?? null,
    extra: row.extra ?? null,
    home: row.score?.home ?? 0,
    away: row.score?.away ?? 0,
  };
}

function goalTotal(clock: LiveClockView): number {
  return clock.home + clock.away;
}

/**
 * existing = in-memory snapshot clock.
 * incoming = Redis/calendar/live-feed clock.
 */
export function decideLiveMerge(
  existing: LiveClockView | null | undefined,
  incoming: LiveClockView,
): LiveMergeDecision {
  if (existing == null) {
    return { action: 'INSERT', reason: 'INSERT' };
  }

  const existingRank = liveStatusRank(existing.short, existing.elapsed);
  const incomingRank = liveStatusRank(incoming.short, incoming.elapsed);
  if (incomingRank > existingRank) {
    return { action: 'REPLACE', reason: 'STATUS_CHANGE' };
  }
  if (incomingRank < existingRank) {
    return { action: 'KEEP', reason: 'OLDER' };
  }

  const existingGoals = goalTotal(existing);
  const incomingGoals = goalTotal(incoming);
  if (incomingGoals > existingGoals) {
    return { action: 'REPLACE', reason: 'SCORE_CHANGE' };
  }
  if (incomingGoals < existingGoals) {
    return { action: 'KEEP', reason: 'OLDER' };
  }

  const existingElapsed = existing.elapsed;
  const incomingElapsed = incoming.elapsed;
  if (
    typeof incomingElapsed === 'number' &&
    typeof existingElapsed === 'number' &&
    incomingElapsed > existingElapsed
  ) {
    return { action: 'REPLACE', reason: 'ELAPSED_ADVANCE' };
  }
  if (
    typeof incomingElapsed === 'number' &&
    typeof existingElapsed === 'number' &&
    incomingElapsed < existingElapsed
  ) {
    return { action: 'KEEP', reason: 'OLDER' };
  }
  if (incomingElapsed != null && existingElapsed == null) {
    return { action: 'REPLACE', reason: 'ELAPSED_ADVANCE' };
  }

  const existingExtra = existing.extra ?? 0;
  const incomingExtra = incoming.extra ?? 0;
  if (incomingExtra > existingExtra) {
    return { action: 'REPLACE', reason: 'ELAPSED_ADVANCE' };
  }
  if (incomingExtra < existingExtra) {
    return { action: 'KEEP', reason: 'OLDER' };
  }

  return { action: 'KEEP', reason: 'EQUAL' };
}

/** Copy live mutable fields from incoming; keep existing static metadata when incoming is thin. */
export function mergeIncomingLiveOntoFixture(existing: Fixture, incoming: Fixture): Fixture {
  const homeLogo = incoming.teams?.home?.logo || existing.teams?.home?.logo || '';
  const awayLogo = incoming.teams?.away?.logo || existing.teams?.away?.logo || '';
  const homeName = incoming.teams?.home?.name || existing.teams?.home?.name || '';
  const awayName = incoming.teams?.away?.name || existing.teams?.away?.name || '';
  const homeId = incoming.teams?.home?.id || existing.teams?.home?.id || 0;
  const awayId = incoming.teams?.away?.id || existing.teams?.away?.id || 0;

  return {
    ...existing,
    goals: {
      home: incoming.goals?.home ?? existing.goals?.home ?? null,
      away: incoming.goals?.away ?? existing.goals?.away ?? null,
    },
    teams: {
      home: {
        ...existing.teams.home,
        id: homeId,
        name: homeName,
        logo: homeLogo,
      },
      away: {
        ...existing.teams.away,
        id: awayId,
        name: awayName,
        logo: awayLogo,
      },
    },
    league: {
      ...existing.league,
      id: incoming.league?.id || existing.league?.id,
      name: incoming.league?.name || existing.league?.name,
      logo: incoming.league?.logo || existing.league?.logo,
      country: incoming.league?.country || existing.league?.country,
      flag: incoming.league?.flag ?? existing.league?.flag ?? null,
      round: incoming.league?.round || existing.league?.round,
    },
    fixture: {
      ...existing.fixture,
      status: {
        ...existing.fixture.status,
        short: incoming.fixture.status.short || existing.fixture.status.short,
        long: incoming.fixture.status.long || existing.fixture.status.long,
        elapsed:
          incoming.fixture.status.elapsed ?? existing.fixture.status.elapsed,
        extra: incoming.fixture.status.extra,
      },
    },
  };
}

/** Overlay a newer snapshot's live fields onto the calendar row (keep logos/league/crowd). */
export function applyLiveClockToMatch(row: Match, live: Match): Match {
  return withAuthoritativeLiveMinute({
    ...row,
    score: live.score,
    status: live.status,
    statusShort: live.statusShort,
    elapsed: live.elapsed,
    extra: live.extra,
    minute: live.minute,
  });
}
