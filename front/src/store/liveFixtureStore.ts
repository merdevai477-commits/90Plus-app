import { create } from 'zustand';
import type { MatchUpdatePayload } from '../../services/websocketClient';
import {
  applyWebSocketToFixture,
  buildSnapshotFromRaw,
  fetchFastSnapshot,
  fetchFullSnapshot,
  shouldSkipHttpIngest,
} from './liveFixtureSync';
import type { LiveFixtureSnapshot } from './liveFixtureStore.types';
import {
  LIVE_FIXTURE_FINISHED_RETENTION_MS,
  LIVE_FIXTURE_MAX_SNAPSHOTS,
  LIVE_FIXTURE_UPCOMING_GRACE_MS,
} from './liveFixtureStore.types';

interface LiveFixtureStoreState {
  snapshots: Record<number, LiveFixtureSnapshot>;
  interestCounts: Record<number, number>;
  focusedFixtureId: number | null;
  evictionSchedule: Record<number, number>;

  registerInterest: (fixtureId: number) => void;
  unregisterInterest: (fixtureId: number) => void;
  setFocusedFixture: (fixtureId: number | null) => void;
  ingestSnapshot: (snapshot: LiveFixtureSnapshot) => void;
  patchFromWebSocket: (update: MatchUpdatePayload, messageTimestamp: number) => void;
  fetchAndIngestFast: (fixtureId: number) => Promise<void>;
  fetchAndIngestFull: (fixtureId: number) => Promise<void>;
  refreshInterestedLive: () => Promise<void>;
  getPollTargetIds: () => number[];
  sweepEvictions: () => void;
}

function cancelEviction(
  schedule: Record<number, number>,
  fixtureId: number,
): Record<number, number> {
  if (!schedule[fixtureId]) return schedule;
  const next = { ...schedule };
  delete next[fixtureId];
  return next;
}

function enforceSnapshotCap(
  snapshots: Record<number, LiveFixtureSnapshot>,
  interestCounts: Record<number, number>,
): Record<number, LiveFixtureSnapshot> {
  const ids = Object.keys(snapshots);
  if (ids.length <= LIVE_FIXTURE_MAX_SNAPSHOTS) return snapshots;

  const sorted = ids
    .map((id) => Number(id))
    .sort((a, b) => (snapshots[a]?.updatedAt ?? 0) - (snapshots[b]?.updatedAt ?? 0));

  const next = { ...snapshots };
  for (const id of sorted) {
    if (Object.keys(next).length <= LIVE_FIXTURE_MAX_SNAPSHOTS) break;
    if ((interestCounts[id] ?? 0) > 0) continue;
    delete next[id];
  }
  return next;
}

export const useLiveFixtureStore = create<LiveFixtureStoreState>((set, get) => ({
  snapshots: {},
  interestCounts: {},
  focusedFixtureId: null,
  evictionSchedule: {},

  registerInterest(fixtureId: number) {
    if (!fixtureId || Number.isNaN(fixtureId)) return;
    const state = get();
    const prev = state.interestCounts[fixtureId] ?? 0;
    set({
      interestCounts: { ...state.interestCounts, [fixtureId]: prev + 1 },
      evictionSchedule: cancelEviction(state.evictionSchedule, fixtureId),
    });
    if (prev === 0) {
      void get().fetchAndIngestFast(fixtureId);
    }
  },

  unregisterInterest(fixtureId: number) {
    if (!fixtureId) return;
    const state = get();
    const prev = state.interestCounts[fixtureId] ?? 0;
    if (prev <= 0) return;
    const nextCount = prev - 1;
    const interestCounts = { ...state.interestCounts };
    if (nextCount <= 0) {
      delete interestCounts[fixtureId];
    } else {
      interestCounts[fixtureId] = nextCount;
    }

    const snapshot = state.snapshots[fixtureId];
    let evictAt = Date.now() + LIVE_FIXTURE_UPCOMING_GRACE_MS;
    if (snapshot?.phase === 'finished') {
      evictAt = Date.now() + LIVE_FIXTURE_FINISHED_RETENTION_MS;
    }

    set({
      interestCounts,
      evictionSchedule:
        nextCount <= 0
          ? { ...state.evictionSchedule, [fixtureId]: evictAt }
          : state.evictionSchedule,
    });
  },

  setFocusedFixture(fixtureId: number | null) {
    set({ focusedFixtureId: fixtureId });
    if (fixtureId) {
      void get().fetchAndIngestFull(fixtureId);
    }
  },

  ingestSnapshot(snapshot: LiveFixtureSnapshot) {
    set((state) => ({
      snapshots: enforceSnapshotCap(
        { ...state.snapshots, [snapshot.fixtureId]: snapshot },
        state.interestCounts,
      ),
      evictionSchedule: cancelEviction(state.evictionSchedule, snapshot.fixtureId),
    }));
  },

  patchFromWebSocket(update: MatchUpdatePayload, messageTimestamp: number) {
    const fixtureId = update.matchId;
    const existing = get().snapshots[fixtureId];
    if (!existing) {
      void get().fetchAndIngestFast(fixtureId);
      return;
    }

    const patchedFixture = applyWebSocketToFixture(existing, update);
    const next = buildSnapshotFromRaw({
      fixtureId,
      fixture: patchedFixture,
      events: existing.events,
      lineups: existing.lineups,
      statistics: existing.statistics,
      venue: existing.venue,
      source: 'websocket',
      existing,
    });
    if (!next) return;

    next.lastWsAppliedAt = messageTimestamp;
    get().ingestSnapshot(next);

    if (update.status === 'HT' || update.status === 'FT') {
      void get().fetchAndIngestFull(fixtureId);
    }
  },

  async fetchAndIngestFast(fixtureId: number) {
    const existing = get().snapshots[fixtureId] ?? null;
    const startedAt = Date.now();
    const snapshot = await fetchFastSnapshot(fixtureId, existing);
    if (!snapshot) return;

    const current = get().snapshots[fixtureId];
    if (shouldSkipHttpIngest(current, snapshot, startedAt)) {
      return;
    }
    get().ingestSnapshot(snapshot);
  },

  async fetchAndIngestFull(fixtureId: number) {
    const existing = get().snapshots[fixtureId] ?? null;
    const startedAt = Date.now();
    const snapshot = await fetchFullSnapshot(fixtureId, existing);
    if (!snapshot) return;

    const current = get().snapshots[fixtureId];
    if (shouldSkipHttpIngest(current, snapshot, startedAt)) {
      return;
    }
    get().ingestSnapshot(snapshot);
  },

  async refreshInterestedLive() {
    const ids = get().getPollTargetIds();
    await Promise.all(ids.map((id) => get().fetchAndIngestFast(id)));
  },

  getPollTargetIds(): number[] {
    const { interestCounts, snapshots } = get();
    return Object.entries(interestCounts)
      .filter(([id, count]) => {
        if (count <= 0) return false;
        const phase = snapshots[Number(id)]?.phase;
        return phase !== 'finished';
      })
      .map(([id]) => Number(id));
  },

  sweepEvictions() {
    const now = Date.now();
    const state = get();
    const snapshots = { ...state.snapshots };
    const evictionSchedule = { ...state.evictionSchedule };
    let changed = false;

    for (const [idStr, evictAt] of Object.entries(evictionSchedule)) {
      const id = Number(idStr);
      if (now < evictAt) continue;
      if ((state.interestCounts[id] ?? 0) > 0) {
        delete evictionSchedule[id];
        changed = true;
        continue;
      }
      delete snapshots[id];
      delete evictionSchedule[id];
      changed = true;
    }

    if (changed) {
      set({ snapshots, evictionSchedule });
    }
  },
}));

export function selectLiveSnapshot(fixtureId: number): LiveFixtureSnapshot | undefined {
  return useLiveFixtureStore.getState().snapshots[fixtureId];
}
