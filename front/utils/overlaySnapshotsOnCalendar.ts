/**
 * Overlay Zustand live snapshots onto calendar rows for live/finished fixtures.
 * Unchanged rows keep the same object reference so React.memo / FlashList can skip work.
 * Also returns which row IDs changed (P1-5 incremental grouping).
 *
 * A stale in-memory snapshot must not bury a newer Redis/calendar/live-feed row.
 */
import type { Match } from '../components/Matches/matchCardUtils';
import type { LiveFixtureSnapshot } from '../src/store/liveFixtureStore.types';
import { snapshotToMatchRow } from '../src/utils/snapshotToMatchRow';
import {
  applyLiveClockToMatch,
  clockFromMatch,
  decideLiveMerge,
  logLiveMergeFix,
} from './liveFixtureFreshness';

/** Cheap fingerprint for list-row live fields (status + score + elapsed/extra). */
export function matchLiveFingerprint(row: Match): string {
  return `${row.status}|${row.score?.home ?? ''}|${row.score?.away ?? ''}|${row.elapsed ?? ''}|${row.extra ?? ''}|${row.minute ?? ''}|${row.statusShort ?? ''}`;
}

export type OverlayResult = {
  rows: Match[];
  changedIds: Set<string>;
  anyChanged: boolean;
};

export function overlaySnapshotsOnCalendarDetailed(
  calendarRows: Match[],
  snapshots: Record<number, LiveFixtureSnapshot>,
): OverlayResult {
  if (Object.keys(snapshots).length === 0) {
    return { rows: calendarRows, changedIds: new Set(), anyChanged: false };
  }
  const changedIds = new Set<string>();
  let anyChanged = false;
  const next = calendarRows.map((row) => {
    const id = parseInt(row.id, 10);
    if (Number.isNaN(id)) return row;
    const snap = snapshots[id];
    if (!snap) return row;
    // Details/calendar FT must not be revived by a leftover live snapshot.
    if (row.status === 'finished' && snap.phase !== 'finished') {
      return row;
    }
    // Promote NS→live/finished from per-fixture polls even when calendar is still stale.
    if (
      row.status === 'live' ||
      snap.phase === 'live' ||
      snap.phase === 'finished' ||
      (row.status === 'upcoming' && snap.phase !== 'upcoming' && snap.phase !== 'unknown')
    ) {
      const overlaid = snapshotToMatchRow(snap);
      const snapClock = clockFromMatch(overlaid);
      const rowClock = clockFromMatch(row);
      const decision = decideLiveMerge(snapClock, rowClock);
      logLiveMergeFix(id, snapClock, rowClock, decision);

      // Calendar/live-feed row is newer than the in-memory snapshot — keep it.
      if (decision.action === 'REPLACE') {
        return row;
      }

      if (matchLiveFingerprint(row) === matchLiveFingerprint(overlaid)) {
        return row;
      }
      anyChanged = true;
      changedIds.add(row.id);
      return applyLiveClockToMatch(row, overlaid);
    }
    return row;
  });
  return {
    rows: anyChanged ? next : calendarRows,
    changedIds,
    anyChanged,
  };
}

/**
 * Overlay Zustand live snapshots onto calendar rows for live/finished fixtures.
 * Unchanged rows keep the same object reference so React.memo / FlashList can skip work.
 */
export function overlaySnapshotsOnCalendar(
  calendarRows: Match[],
  snapshots: Record<number, LiveFixtureSnapshot>,
): Match[] {
  return overlaySnapshotsOnCalendarDetailed(calendarRows, snapshots).rows;
}
