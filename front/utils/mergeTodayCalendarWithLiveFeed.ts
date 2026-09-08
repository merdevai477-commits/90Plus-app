import type { Match } from '../components/Matches/matchCardUtils';
import { isStaleInPlayClock } from './staleMatchClock';

const TERMINAL_STATUS_SHORT = new Set(['FT', 'AET', 'PEN', 'ABD', 'AWD', 'WO', 'CANC']);

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
    map.set(
      liveRow.id,
      existing
        ? {
            ...existing,
            ...liveRow,
            status: 'live',
            score: liveRow.score,
            minute: liveRow.minute ?? existing.minute,
            elapsed: liveRow.elapsed ?? existing.elapsed,
            extra: liveRow.extra ?? existing.extra,
            statusShort: liveRow.statusShort ?? existing.statusShort,
          }
        : liveRow,
    );
  }

  return Array.from(map.values());
}
