import type { Match } from '../components/Matches/matchCardUtils';
import { isStaleInPlayClock } from './staleMatchClock';

const TERMINAL_STATUS_SHORT = new Set(['FT', 'AET', 'PEN', 'ABD', 'AWD', 'WO', 'CANC']);
/** Not being played: a missing row like this belongs to another day's list. */
const PAUSED_STATUS_SHORT = new Set(['INT', 'SUSP']);

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
  return row.status === 'finished' || TERMINAL_STATUS_SHORT.has(row.statusShort ?? '');
}

/**
 * Merge today's date-indexed calendar with the global live feed.
 * Calendar cache can lag behind kickoff; live endpoint is authoritative for
 * both promotions (NS → live) and demotions (stale live → finished).
 * A calendar/details FT must not be revived by a lagging live-feed row.
 */
export function mergeTodayCalendarWithLiveFeed(calendar: Match[], liveFeed: Match[]): Match[] {
  const liveRows = liveFeed.map(finishStaleLiveRow).filter((row) => row.status === 'live');
  const liveIds = new Set(liveRows.map((row) => row.id));
  const map = new Map<string, Match>();
  const demoteMissingLive = liveIds.size > 0;

  for (const raw of calendar) {
    const row = finishStaleLiveRow(raw);
    if (demoteMissingLive && row.status === 'live' && !liveIds.has(row.id)) {
      const statusShort =
        row.statusShort && TERMINAL_STATUS_SHORT.has(row.statusShort) ? row.statusShort : 'FT';
      map.set(row.id, {
        ...row,
        status: 'finished',
        statusShort,
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
