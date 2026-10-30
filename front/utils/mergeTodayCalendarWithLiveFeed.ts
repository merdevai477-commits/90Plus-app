import type { Match } from '../components/Matches/matchCardUtils';
import { isStaleInPlayClock, STALE_2H_AGE_MIN } from './staleMatchClock';

const TERMINAL_STATUS_SHORT = new Set(['FT', 'AET', 'PEN', 'ABD', 'AWD', 'WO', 'CANC']);
/** Not being played: a missing row like this belongs to another day's list. */
const PAUSED_STATUS_SHORT = new Set(['INT', 'SUSP']);

/**
 * A live row must stay absent from the feed this long (≈3 feed polls) before it
 * may be called FT. One dropped poll mid-stoppage must not end the match.
 */
export const LIVE_FEED_GAP_GRACE_MS = 45_000;

const firstMissingAt = new Map<string, number>();
const MISSING_TRACKER_MAX = 200;

export function __resetLiveFeedGapTrackerForTests(): void {
  firstMissingAt.clear();
}

/** Regulation (or ET) is already played out, so leaving the feed most likely means FT. */
function playedOut(row: Match): boolean {
  const s = (row.statusShort ?? '').trim().toUpperCase();
  const elapsed = row.elapsed ?? null;
  if (s === 'P') return true;
  if (s === 'ET') return elapsed != null && elapsed >= 120;
  if (s === '2H' || s === 'LIVE') return elapsed != null && elapsed >= 90;
  return false;
}

function kickoffAgeMin(row: Match, nowMs: number): number | null {
  if (!row.fixtureDate) return null;
  const kick = Date.parse(row.fixtureDate);
  return Number.isFinite(kick) ? (nowMs - kick) / 60_000 : null;
}

/**
 * Live row absent from a non-empty feed. Only becomes FT after the grace
 * window AND when the clock says the match is played out (or the kickoff is
 * so old the row is a ghost). A row at 60' or 90+3 that blinks out of one
 * feed poll stays live.
 */
function shouldFinishMissingLiveRow(row: Match, nowMs: number): boolean {
  if (TERMINAL_STATUS_SHORT.has(row.statusShort ?? '')) return true;
  let since = firstMissingAt.get(row.id);
  if (since == null) {
    if (firstMissingAt.size >= MISSING_TRACKER_MAX) firstMissingAt.clear();
    since = nowMs;
    firstMissingAt.set(row.id, since);
  }
  if (nowMs - since < LIVE_FEED_GAP_GRACE_MS) return false;
  if (playedOut(row)) return true;
  const s = (row.statusShort ?? '').trim().toUpperCase();
  const ghostAgeMin = s === 'ET' || s === 'BT' ? STALE_2H_AGE_MIN + 60 : STALE_2H_AGE_MIN;
  const age = kickoffAgeMin(row, nowMs);
  return age != null && age >= ghostAgeMin;
}

function finishStaleLiveRow(row: Match): Match {
  if (row.status !== 'live') return row;
  if (
    !isStaleInPlayClock({
      statusShort: row.statusShort ?? 'LIVE',
      elapsed: row.elapsed,
      extra: row.extra,
      kickoffIso: row.fixtureDate,
    })
  ) {
    return row;
  }
  return {
    ...row,
    status: 'finished',
    statusShort: TERMINAL_STATUS_SHORT.has(row.statusShort ?? '') ? row.statusShort! : 'FT',
    extra: null,
    minute: undefined,
  };
}

function isFinishedCalendarRow(row: Match): boolean {
  if (row.finishedByFeedGap) return false;
  return row.status === 'finished' || TERMINAL_STATUS_SHORT.has(row.statusShort ?? '');
}

/**
 * Merge today's date-indexed calendar with the global live feed.
 * Calendar cache can lag behind kickoff; live endpoint is authoritative for
 * promotions (NS → live). Demotions (live → FT because the row left the feed)
 * wait out a grace window and only apply to played-out or ghost rows; the feed
 * can revive such a row. A real calendar/details FT is never revived.
 */
export function mergeTodayCalendarWithLiveFeed(
  calendar: Match[],
  liveFeed: Match[],
  nowMs: number = Date.now(),
): Match[] {
  const liveRows = liveFeed.map(finishStaleLiveRow).filter((row) => row.status === 'live');
  const liveIds = new Set(liveRows.map((row) => row.id));
  const map = new Map<string, Match>();
  const demoteMissingLive = liveIds.size > 0;

  for (const id of liveIds) firstMissingAt.delete(id);

  for (const raw of calendar) {
    const row = finishStaleLiveRow(raw);
    if (
      demoteMissingLive &&
      row.status === 'live' &&
      !liveIds.has(row.id) &&
      shouldFinishMissingLiveRow(row, nowMs)
    ) {
      const statusShort =
        row.statusShort && TERMINAL_STATUS_SHORT.has(row.statusShort) ? row.statusShort : 'FT';
      map.set(row.id, {
        ...row,
        status: 'finished',
        statusShort,
        finishedByFeedGap: !TERMINAL_STATUS_SHORT.has(row.statusShort ?? ''),
      });
    } else {
      map.set(row.id, row);
    }
  }

  for (const liveRow of liveRows) {
    const existing = map.get(liveRow.id);
    if (existing && isFinishedCalendarRow(existing)) {
      continue;
    }
    if (!existing) {
      if (!PAUSED_STATUS_SHORT.has(liveRow.statusShort ?? '')) map.set(liveRow.id, liveRow);
      continue;
    }
    const merged: Match = {
      ...existing,
      ...liveRow,
      status: 'live',
      score: liveRow.score,
      minute: liveRow.minute ?? existing.minute,
      elapsed: liveRow.elapsed ?? existing.elapsed,
      extra: liveRow.extra ?? existing.extra,
      statusShort: liveRow.statusShort ?? existing.statusShort,
      finishedByFeedGap: undefined,
    };
    // Keep the existing object when the tick changed nothing visible, so
    // memoized rows / grouping don't rebuild on every live-feed poll.
    map.set(liveRow.id, sameLiveState(existing, merged) ? existing : merged);
  }

  // Nothing changed → hand back the same array so downstream memos hold.
  if (map.size === calendar.length) {
    let identical = true;
    for (const row of calendar) {
      if (map.get(row.id) !== row) {
        identical = false;
        break;
      }
    }
    if (identical) return calendar;
  }

  return Array.from(map.values());
}

function sameLiveState(a: Match, b: Match): boolean {
  return (
    a.status === b.status &&
    a.statusShort === b.statusShort &&
    a.score?.home === b.score?.home &&
    a.score?.away === b.score?.away &&
    a.minute === b.minute &&
    a.elapsed === b.elapsed &&
    a.extra === b.extra &&
    a.startTimestamp === b.startTimestamp
  );
}
