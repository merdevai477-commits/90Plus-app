import type {
  Fixture,
  FixtureEvent,
  Lineup,
  TeamStatistics,
  Venue,
} from '../../services/apiFootball';
import { ApiFootballService } from '../../services/apiFootball';
import { reconcileFixtureWithEvents } from '../../utils/matchDetailsLiveSync';
import {
  buildFallbackStatisticsFromEvents,
  hasApiStatistics,
} from '../../utils/matchStatsFallback';
import {
  hasLineupData,
  isAuthoritativeLineupData,
  buildFallbackLineupsFromEvents,
} from '../../utils/matchLineupsFallback';
import type {
  LiveFixturePhase,
  LiveFixtureSnapshot,
  LiveFixtureSource,
} from './liveFixtureStore.types';
import {
  FINISHED_STATUS_SHORTS,
  LIVE_STATUS_SHORTS,
} from './liveFixtureStore.types';

const inFlightFast = new Map<number, Promise<LiveFixtureSnapshot | null>>();
const inFlightScore = new Map<number, Promise<LiveFixtureSnapshot | null>>();
const inFlightFull = new Map<number, Promise<LiveFixtureSnapshot | null>>();

export function derivePhase(statusShort: string): LiveFixturePhase {
  if (FINISHED_STATUS_SHORTS.has(statusShort)) return 'finished';
  if (LIVE_STATUS_SHORTS.has(statusShort)) return 'live';
  if (statusShort === 'NS' || statusShort === 'TBD' || statusShort === 'PST') return 'upcoming';
  return 'unknown';
}

function resolveStatistics(
  fixture: Fixture,
  events: FixtureEvent[],
  statistics: TeamStatistics[] | null | undefined,
): { statistics: TeamStatistics[] | null; statsFromEvents: boolean } {
  if (hasApiStatistics(statistics)) {
    return { statistics: statistics ?? [], statsFromEvents: false };
  }
  if (events.length > 0) {
    const fromEvents = buildFallbackStatisticsFromEvents(fixture, events);
    if (hasApiStatistics(fromEvents)) {
      return { statistics: fromEvents, statsFromEvents: true };
    }
  }
  return { statistics: null, statsFromEvents: false };
}

function resolveLineups(
  fixture: Fixture,
  events: FixtureEvent[],
  lineups: Lineup[] | null | undefined,
): Lineup[] | null {
  if (isAuthoritativeLineupData(lineups)) return lineups ?? [];
  if (hasLineupData(lineups)) return lineups ?? [];
  const is365 =
    (fixture as { _experiment?: string })._experiment === 'scores365' ||
    (fixture as { _scores365GameId?: number })._scores365GameId != null;
  if (is365) return null;
  if (events.length > 0) {
    const fromEvents = buildFallbackLineupsFromEvents(fixture, events);
    if (hasLineupData(fromEvents)) return fromEvents;
  }
  return null;
}

export function buildSnapshotFromRaw(params: {
  fixtureId: number;
  fixture: Fixture | null;
  events: FixtureEvent[];
  lineups?: Lineup[] | null;
  statistics?: TeamStatistics[] | null;
  venue?: Venue | null;
  source: LiveFixtureSource;
  existing?: LiveFixtureSnapshot | null;
  lastFetchError?: string | null;
}): LiveFixtureSnapshot | null {
  if (!params.fixture) return null;

  const reconciled = reconcileFixtureWithEvents(params.fixture, params.events);
  const statusShort = reconciled.fixture?.status?.short ?? 'NS';
  const { statistics, statsFromEvents } = resolveStatistics(
    reconciled,
    params.events,
    params.statistics ?? params.existing?.statistics,
  );
  const lineups = resolveLineups(
    reconciled,
    params.events,
    params.lineups ?? params.existing?.lineups,
  );
  const now = Date.now();
  const revision = (params.existing?.revision ?? 0) + 1;
  const isHttp = params.source === 'http-fast' || params.source === 'http-full';

  return {
    fixtureId: params.fixtureId,
    fixture: reconciled,
    events: params.events,
    statistics,
    statsFromEvents,
    lineups,
    venue: params.venue ?? params.existing?.venue ?? null,
    revision,
    updatedAt: now,
    lastHttpFetchAt: isHttp ? now : params.existing?.lastHttpFetchAt ?? null,
    lastWsAppliedAt: params.source === 'websocket'
      ? now
      : params.existing?.lastWsAppliedAt ?? null,
    lastSource: params.source,
    phase: derivePhase(statusShort),
    lastFetchError: params.lastFetchError ?? null,
  };
}

export async function fetchFastSnapshot(
  fixtureId: number,
  existing?: LiveFixtureSnapshot | null,
): Promise<LiveFixtureSnapshot | null> {
  const pending = inFlightFast.get(fixtureId);
  if (pending) return pending;

  const promise = (async () => {
    try {
      if (existing?.fixture) {
        // Always refresh fixture status alongside events. Events-only polls left
        // NS→1H / HT→2H / 2H→FT stuck until a focused full-bundle fetch.
        const [fixtureData, eventData] = await Promise.all([
          ApiFootballService.getFixtureById(fixtureId, { skipCache: true }).catch(
            () => existing.fixture,
          ),
          ApiFootballService.getFixtureEvents(fixtureId, {
            skipCache: true,
          }).catch(() => existing.events ?? []),
        ]);
        return buildSnapshotFromRaw({
          fixtureId,
          fixture: reconcileFixtureWithEvents(
            fixtureData ?? existing.fixture,
            eventData ?? [],
          ),
          events: eventData ?? [],
          source: 'http-fast',
          existing,
        });
      }

      let bundle = await ApiFootballService.getFixtureDetailsBundle(fixtureId);
      if (bundle.fixture) {
        return buildSnapshotFromRaw({
          fixtureId,
          fixture: bundle.fixture,
          events: bundle.events ?? [],
          lineups: bundle.lineups,
          statistics: bundle.statistics,
          venue: bundle.venue,
          source: 'http-fast',
          existing,
        });
      }

      if (fixtureId >= 4_000_000) {
        if (existing) {
          return { ...existing, updatedAt: Date.now() };
        }
        return null;
      }

      const [fixtureData, eventData] = await Promise.all([
        ApiFootballService.getFixtureById(fixtureId, { skipCache: true }),
        ApiFootballService.getFixtureEvents(fixtureId, { skipCache: true }),
      ]);
      return buildSnapshotFromRaw({
        fixtureId,
        fixture: fixtureData,
        events: eventData ?? [],
        source: 'http-fast',
        existing,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fast fetch failed';
      if (existing) {
        return { ...existing, lastFetchError: message, updatedAt: Date.now() };
      }
      return null;
    } finally {
      inFlightFast.delete(fixtureId);
    }
  })();

  inFlightFast.set(fixtureId, promise);
  return promise;
}

/**
 * List / non-focused poll path: refresh status + score only.
 * Keeps existing events/lineups so the matches list does not starve Events tab.
 */
export async function fetchScoreSnapshot(
  fixtureId: number,
  existing?: LiveFixtureSnapshot | null,
): Promise<LiveFixtureSnapshot | null> {
  const pending = inFlightScore.get(fixtureId);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const fixtureData = await ApiFootballService.getFixtureById(fixtureId, {
        skipCache: true,
      });
      if (!fixtureData) {
        if (existing) return { ...existing, updatedAt: Date.now() };
        return null;
      }
      return buildSnapshotFromRaw({
        fixtureId,
        fixture: fixtureData,
        events: existing?.events ?? [],
        lineups: existing?.lineups,
        statistics: existing?.statistics,
        venue: existing?.venue,
        source: 'http-fast',
        existing,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Score fetch failed';
      if (existing) {
        return { ...existing, lastFetchError: message, updatedAt: Date.now() };
      }
      return null;
    } finally {
      inFlightScore.delete(fixtureId);
    }
  })();

  inFlightScore.set(fixtureId, promise);
  return promise;
}

export async function fetchFullSnapshot(
  fixtureId: number,
  existing?: LiveFixtureSnapshot | null,
): Promise<LiveFixtureSnapshot | null> {
  const pending = inFlightFull.get(fixtureId);
  if (pending) return pending;

  const promise = (async () => {
    try {
      // Use cached bundle on first open. A second full English round-trip
      // just because events are empty used to add another 10–20s before paint.
      const bundle = await ApiFootballService.getFixtureDetailsBundle(fixtureId);
      let venue: Venue | null = bundle.venue ?? null;
      if (!venue && bundle.fixture?.fixture?.venue) {
        venue = bundle.fixture.fixture.venue as Venue;
      }
      return buildSnapshotFromRaw({
        fixtureId,
        fixture: bundle.fixture,
        events: bundle.events ?? [],
        lineups: bundle.lineups,
        statistics: bundle.statistics,
        venue,
        source: 'http-full',
        existing,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Full fetch failed';
      if (existing) {
        return { ...existing, lastFetchError: message, updatedAt: Date.now() };
      }
      return null;
    } finally {
      inFlightFull.delete(fixtureId);
    }
  })();

  inFlightFull.set(fixtureId, promise);
  return promise;
}

/**
 * Skip applying an HTTP snapshot when WS or a newer HTTP response already owns live fields.
 * Called after the fetch resolves, using the snapshot state at ingest time.
 */
export function shouldSkipHttpIngest(
  current: LiveFixtureSnapshot | undefined,
  incoming: LiveFixtureSnapshot,
  fetchStartedAt: number,
): boolean {
  if (!current) return false;

  if (current.lastWsAppliedAt != null && current.lastWsAppliedAt >= fetchStartedAt) {
    return true;
  }

  if (
    current.lastHttpFetchAt != null &&
    current.lastHttpFetchAt > fetchStartedAt &&
    (incoming.lastSource === 'http-fast' || incoming.lastSource === 'http-full')
  ) {
    return true;
  }

  const wsFresh =
    current.lastSource === 'websocket' ||
    (current.lastWsAppliedAt ?? 0) > (current.lastHttpFetchAt ?? 0);
  if (!wsFresh) return false;

  const curShort = current.fixture.fixture.status.short;
  const incShort = incoming.fixture.fixture.status.short;
  if (curShort === incShort) {
    const curElapsed = current.fixture.fixture.status.elapsed ?? 0;
    const incElapsed = incoming.fixture.fixture.status.elapsed ?? 0;
    if (incElapsed < curElapsed) return true;
  }

  const curGoals = (current.fixture.goals.home ?? 0) + (current.fixture.goals.away ?? 0);
  const incGoals = (incoming.fixture.goals.home ?? 0) + (incoming.fixture.goals.away ?? 0);
  if (incGoals < curGoals) return true;

  return false;
}

/** Deterministic WS status transitions — always allow terminal / period changes. */
export function isValidStatusTransition(from: string, to: string): boolean {
  if (from === to) return true;
  if (FINISHED_STATUS_SHORTS.has(to)) return true;
  if (to === 'HT' || to === 'BT') return true;
  if (from === 'HT' && to === '2H') return true;
  if (from === '1H' && to === '2H') return true;
  if (from === '2H' && (to === 'ET' || to === 'P')) return true;
  if (LIVE_STATUS_SHORTS.has(to)) return true;
  return false;
}

export function applyWebSocketToFixture(
  snapshot: LiveFixtureSnapshot,
  update: {
    homeScore: number;
    awayScore: number;
    status: string;
    minute?: number;
    extra?: number | null;
  },
): Fixture {
  const fixture = snapshot.fixture;
  const currentShort = fixture.fixture.status.short;
  const currentElapsed = fixture.fixture.status.elapsed ?? 0;
  const currentExtra = fixture.fixture.status.extra ?? null;
  const currentHome = fixture.goals.home ?? 0;
  const currentAway = fixture.goals.away ?? 0;

  let nextShort = currentShort;
  if (update.status !== currentShort && isValidStatusTransition(currentShort, update.status)) {
    nextShort = update.status;
  }

  let nextHome = currentHome;
  let nextAway = currentAway;
  const totalWs = update.homeScore + update.awayScore;
  const totalCur = currentHome + currentAway;
  if (totalWs >= totalCur || FINISHED_STATUS_SHORTS.has(nextShort)) {
    nextHome = update.homeScore;
    nextAway = update.awayScore;
  }

  let nextElapsed = currentElapsed;
  if (FINISHED_STATUS_SHORTS.has(nextShort) || nextShort === 'HT' || nextShort === 'BT') {
    if (update.minute != null) nextElapsed = update.minute;
  } else if (update.minute != null) {
    nextElapsed = Math.max(currentElapsed, update.minute);
  }

  let nextExtra = currentExtra;
  if (FINISHED_STATUS_SHORTS.has(nextShort)) {
    nextExtra = null;
  } else if (update.extra !== undefined) {
    nextExtra = update.extra;
  }

  return {
    ...fixture,
    goals: { home: nextHome, away: nextAway },
    fixture: {
      ...fixture.fixture,
      status: {
        ...fixture.fixture.status,
        short: nextShort,
        elapsed: nextElapsed,
        extra: nextExtra,
      },
    },
  };
}
