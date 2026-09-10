/**
 * Overlay Zustand live snapshots onto calendar rows for live/finished fixtures.
 * Unchanged rows keep the same object reference so React.memo / FlashList can skip work.
 * Also returns which row IDs changed (P1-5 incremental grouping).
 *
 * A stale in-memory snapshot must not bury a newer Redis/calendar/live-feed row.
 * REPLACE (calendar newer) must mark changedIds so grouping rebuilds FlashList rows.
 */
import type { Match } from '../components/Matches/matchCardUtils';
import type { LiveFixtureSnapshot } from '../src/store/liveFixtureStore.types';
import { snapshotToMatchRow } from '../src/utils/snapshotToMatchRow';
import {
  applyLiveClockToMatch,
  clockFromMatch,
  decideLiveMerge,
  logLiveMergeFix,
  logLiveRenderFix,
  matchLiveFingerprint,
  withAuthoritativeLiveMinute,
} from './liveFixtureFreshness';

export { matchLiveFingerprint } from './liveFixtureFreshness';

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
      // Always mark changedIds so incremental grouping cannot reuse a stale Match.
      if (decision.action === 'REPLACE') {
        const fresh = withAuthoritativeLiveMinute(row);
        anyChanged = true;
        changedIds.add(row.id);
        logLiveRenderFix({
          fixtureId: id,
          decision: decision.action,
          reason: decision.reason,
          existingElapsed: snapClock.elapsed,
          incomingElapsed: rowClock.elapsed,
          changedIdsContains: true,
          renderedElapsed: fresh.elapsed ?? null,
          renderedMinute: fresh.minute ?? null,
          renderedScore: `${fresh.score?.home ?? 0}-${fresh.score?.away ?? 0}`,
          renderedStatus: fresh.statusShort ?? null,
        });
        return fresh;
      }

      if (matchLiveFingerprint(row) === matchLiveFingerprint(overlaid)) {
        return row;
      }
      anyChanged = true;
      changedIds.add(row.id);
      const kept = applyLiveClockToMatch(row, overlaid);
      logLiveRenderFix({
        fixtureId: id,
        decision: decision.action,
        reason: decision.reason,
        existingElapsed: snapClock.elapsed,
        incomingElapsed: rowClock.elapsed,
        changedIdsContains: true,
        renderedElapsed: kept.elapsed ?? null,
        renderedMinute: kept.minute ?? null,
        renderedScore: `${kept.score?.home ?? 0}-${kept.score?.away ?? 0}`,
        renderedStatus: kept.statusShort ?? null,
      });
      return kept;
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
