import { create } from 'zustand';
import type { MatchUpdatePayload } from '../../services/websocketClient';
import {
  applyWebSocketToFixture,
  buildSnapshotFromRaw,
  fetchFastSnapshot,
  fetchScoreSnapshot,
  fetchFullSnapshot,
  shouldSkipHttpIngest,
} from './liveFixtureSync';
import { hasApiStatistics } from '../../utils/matchStatsFallback';
import { hasLineupData, pickBetterLineups } from '../../utils/matchLineupsFallback';
import type { LiveFixtureSnapshot } from './liveFixtureStore.types';
import type { Fixture } from '../../services/apiFootball';
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
  /** Paint teams/score instantly from the calendar row before the 365 bundle. */
  ingestPreviewIfEmpty: (fixtureId: number, fixture: Fixture) => void;
  patchFromWebSocket: (update: MatchUpdatePayload, messageTimestamp: number) => void;
  /** One-shot HTTP warm-up for WS/push paths — never increments interestCounts. */
  ensureSnapshot: (fixtureId: number) => Promise<void>;
  fetchAndIngestFast: (fixtureId: number, options?: { includeEvents?: boolean }) => Promise<void>;
  fetchAndIngestFull: (fixtureId: number) => Promise<void>;
  refreshInterestedLive: () => Promise<void>;
  getPollTargetIds: () => number[];
  sweepEvictions: () => void;
}

/** Coalesced one-shot HTTP fetches — not ref-counted interest. */
const oneShotFetchInFlight = new Map<number, Promise<void>>();

/** Serializes WS-before-snapshot ensure + apply loops per fixture. */
const wsEnsureInFlight = new Map<number, Promise<void>>();

/** Latest WS payload to apply after ensureSnapshot fetch completes. */
const pendingWsWhileEnsuring = new Map<
  number,
  { update: MatchUpdatePayload; messageTimestamp: number }
>();

type StoreGetter = () => LiveFixtureStoreState;

/** Apply a WS patch to an existing snapshot (shared by direct WS and post-ensure paths). */
function applyWebSocketPatch(
  get: StoreGetter,
  fixtureId: number,
  update: MatchUpdatePayload,
  messageTimestamp: number,
  existing: LiveFixtureSnapshot,
): void {
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
}

/**
 * Coalesced one-shot HTTP fetch — shared by ensureSnapshot, WS warm-up, and push refresh.
 * Never touches interestCounts.
 */
async function runOneShotFetch(get: StoreGetter, fixtureId: number): Promise<void> {
  if (get().snapshots[fixtureId]) return;

  let inFlight = oneShotFetchInFlight.get(fixtureId);
  if (!inFlight) {
    inFlight = get()
      .fetchAndIngestFast(fixtureId, { includeEvents: false })
      .finally(() => {
        oneShotFetchInFlight.delete(fixtureId);
      });
    oneShotFetchInFlight.set(fixtureId, inFlight);
  }
  await inFlight;
}

async function ensureSnapshotForWebSocket(
  get: StoreGetter,
  fixtureId: number,
  update: MatchUpdatePayload,
  messageTimestamp: number,
): Promise<void> {
  pendingWsWhileEnsuring.set(fixtureId, { update, messageTimestamp });

  const existing = get().snapshots[fixtureId];
  if (existing) {
    const pending = pendingWsWhileEnsuring.get(fixtureId)!;
    pendingWsWhileEnsuring.delete(fixtureId);
    applyWebSocketPatch(get, fixtureId, pending.update, pending.messageTimestamp, existing);
    return;
  }

  let chain = wsEnsureInFlight.get(fixtureId);
  if (!chain) {
    chain = (async () => {
      while (pendingWsWhileEnsuring.has(fixtureId)) {
        await runOneShotFetch(get, fixtureId);

        const pending = pendingWsWhileEnsuring.get(fixtureId);
        if (!pending) break;

        const snap = get().snapshots[fixtureId];
        if (!snap) {
          pendingWsWhileEnsuring.delete(fixtureId);
          break;
        }

        pendingWsWhileEnsuring.delete(fixtureId);
        applyWebSocketPatch(get, fixtureId, pending.update, pending.messageTimestamp, snap);
      }
    })().finally(() => {
      wsEnsureInFlight.delete(fixtureId);
    });
    wsEnsureInFlight.set(fixtureId, chain);
  }

  await chain;
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
      // Defer HTTP to the global poll loop — eager fetch here stampedes
      // AsyncStorage (score-only) or /details (365 ids) and blocks the UI.
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

  ingestPreviewIfEmpty(fixtureId: number, fixture: Fixture) {
    if (!fixtureId || fixtureId <= 0) return;
    if (get().snapshots[fixtureId]?.fixture) return;
    const snap = buildSnapshotFromRaw({
      fixtureId,
      fixture,
      events: [],
      source: 'bootstrap',
    });
    if (snap) get().ingestSnapshot(snap);
  },

  patchFromWebSocket(update: MatchUpdatePayload, messageTimestamp: number) {
    const fixtureId = update.matchId;
    const existing = get().snapshots[fixtureId];
    if (!existing) {
      // One-shot fetch + apply WS — never registerInterest (no ref-count leak).
      void ensureSnapshotForWebSocket(get, fixtureId, update, messageTimestamp);
      return;
    }

    applyWebSocketPatch(get, fixtureId, update, messageTimestamp, existing);
  },

  async ensureSnapshot(fixtureId: number) {
    if (!fixtureId || fixtureId <= 0) return;
    await runOneShotFetch(get, fixtureId);
  },

  async fetchAndIngestFast(fixtureId: number, options?: { includeEvents?: boolean }) {
    const existing = get().snapshots[fixtureId] ?? null;
    const startedAt = Date.now();
    const includeEvents = options?.includeEvents !== false;

    // Score-only list poll: never stampede /details for 365 rows with calendar data.
    if (
      !includeEvents &&
      fixtureId >= 4_000_000 &&
      existing?.fixture &&
      (existing.lastSource === 'bootstrap' ||
        existing.lastSource === 'websocket' ||
        Date.now() - existing.updatedAt < 30_000)
    ) {
      return;
    }

    const snapshot = includeEvents
      ? await fetchFastSnapshot(fixtureId, existing)
      : await fetchScoreSnapshot(fixtureId, existing);
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
      if (current) {
        const merged = buildSnapshotFromRaw({
          fixtureId,
          fixture: current.fixture,
          events: snapshot.events.length > 0 ? snapshot.events : current.events,
          lineups: pickBetterLineups(current.lineups, snapshot.lineups),
          statistics: hasApiStatistics(snapshot.statistics)
            ? snapshot.statistics
            : current.statistics,
          venue: snapshot.venue ?? current.venue,
          source: 'http-full',
          existing: current,
        });
        if (merged) get().ingestSnapshot(merged);
      }
      return;
    }
    get().ingestSnapshot(snapshot);
  },

  async refreshInterestedLive() {
    const state = get();
    const ids = state.getPollTargetIds();
    const focusedId = state.focusedFixtureId;
    const MAX_CONCURRENT = 6;
    for (let i = 0; i < ids.length; i += MAX_CONCURRENT) {
      const batch = ids.slice(i, i + MAX_CONCURRENT);
      await Promise.all(
        batch.map((id) => {
          const includeEvents = focusedId != null && id === focusedId;
          return get().fetchAndIngestFast(id, { includeEvents });
        }),
      );
    }
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
