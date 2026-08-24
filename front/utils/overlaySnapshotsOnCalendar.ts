import type { Match } from '../components/Matches/matchCardUtils';
import type { LiveFixtureSnapshot } from '../src/store/liveFixtureStore.types';
import { snapshotToMatchRow } from '../src/utils/snapshotToMatchRow';

/** Cheap fingerprint for list-row live fields (status + score + elapsed/extra). */
export function matchLiveFingerprint(row: Match): string {
  return `${row.status}|${row.score?.home ?? ''}|${row.score?.away ?? ''}|${row.elapsed ?? ''}|${row.extra ?? ''}|${row.minute ?? ''}|${row.statusShort ?? ''}`;
}

/**
 * Overlay Zustand live snapshots onto calendar rows for live/finished fixtures.
 * Unchanged rows keep the same object reference so React.memo / FlashList can skip work.
 */
export function overlaySnapshotsOnCalendar(
  calendarRows: Match[],
  snapshots: Record<number, LiveFixtureSnapshot>,
): Match[] {
  if (Object.keys(snapshots).length === 0) return calendarRows;
  let anyChanged = false;
  const next = calendarRows.map((row) => {
    const id = parseInt(row.id, 10);
    if (Number.isNaN(id)) return row;
    const snap = snapshots[id];
    if (!snap) return row;
    // Promote NS→live/finished from per-fixture polls even when calendar is still stale.
    if (
      row.status === 'live' ||
      snap.phase === 'live' ||
      snap.phase === 'finished' ||
      (row.status === 'upcoming' && snap.phase !== 'upcoming' && snap.phase !== 'unknown')
    ) {
      const overlaid = snapshotToMatchRow(snap);
      if (matchLiveFingerprint(row) === matchLiveFingerprint(overlaid)) {
        return row;
      }
      anyChanged = true;
      return overlaid;
    }
    return row;
  });
  return anyChanged ? next : calendarRows;
}
