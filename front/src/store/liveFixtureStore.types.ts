import type {
  Fixture,
  FixtureEvent,
  TeamStatistics,
  Lineup,
  Venue,
} from '../../services/apiFootball';

export type LiveFixturePhase = 'unknown' | 'live' | 'finished' | 'upcoming';

export type LiveFixtureSource = 'http-fast' | 'http-full' | 'websocket' | 'bootstrap';

export interface LiveFixtureSnapshot {
  fixtureId: number;
  fixture: Fixture;
  events: FixtureEvent[];
  statistics: TeamStatistics[] | null;
  statsFromEvents: boolean;
  lineups: Lineup[] | null;
  venue: Venue | null;
  revision: number;
  updatedAt: number;
  lastHttpFetchAt: number | null;
  lastWsAppliedAt: number | null;
  lastSource: LiveFixtureSource;
  phase: LiveFixturePhase;
  lastFetchError: string | null;
}

export const LIVE_FIXTURE_FAST_POLL_MS = 5_000;
export const LIVE_FIXTURE_FULL_BUNDLE_EVERY_N = 2;
export const LIVE_FIXTURE_MAX_SNAPSHOTS = 64;
export const LIVE_FIXTURE_FINISHED_RETENTION_MS = 10 * 60 * 1000;
export const LIVE_FIXTURE_UPCOMING_GRACE_MS = 60 * 1000;
export const LIVE_FIXTURE_SWEEP_MS = 60_000;
export const LIVE_FIXTURE_CALENDAR_POLL_MS = 8_000;

export const LIVE_STATUS_SHORTS = new Set([
  '1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT',
]);

export const FINISHED_STATUS_SHORTS = new Set([
  'FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO',
]);
