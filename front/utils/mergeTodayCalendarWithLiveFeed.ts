import type { Match } from '../components/Matches/matchCardUtils';

const TERMINAL_STATUS_SHORT = new Set(['FT', 'AET', 'PEN', 'ABD', 'AWD', 'WO', 'CANC']);

/**
 * Merge today's date-indexed calendar with the global live feed.
 * Calendar cache can lag behind kickoff; live endpoint is authoritative for
 * both promotions (NS → live) and demotions (stale live → finished).
 */
export function mergeTodayCalendarWithLiveFeed(calendar: Match[], liveFeed: Match[]): Match[] {
  const liveIds = new Set(liveFeed.filter((row) => row.status === 'live').map((row) => row.id));
  const map = new Map<string, Match>();
  const demoteMissingLive = liveIds.size > 0;

  for (const row of calendar) {
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

  for (const liveRow of liveFeed) {
    if (liveRow.status !== 'live') continue;
    const existing = map.get(liveRow.id);
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
