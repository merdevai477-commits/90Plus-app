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
  /**
   * Backend verdict on the provider's event feed: `true` real events exist, `false` goals
   * happened but the provider publishes none (events are score-delta goals), `null`/absent
   * unknown (0-0 or older backend).
   */
  eventsFeedAvailable?: boolean | null;
  /** Backend verdict on lineups: `false` means the provider has none yet — no spinner. */
  lineupsAvailable?: boolean | null;
}

export const LIVE_FIXTURE_FAST_POLL_MS = 5_000;
export const LIVE_FIXTURE_FULL_BUNDLE_EVERY_N = 2;
export const LIVE_FIXTURE_MAX_SNAPSHOTS = 64;
export const LIVE_FIXTURE_FINISHED_RETENTION_MS = 10 * 60 * 1000;
export const LIVE_FIXTURE_UPCOMING_GRACE_MS = 60 * 1000;
export const LIVE_FIXTURE_SWEEP_MS = 60_000;
/** Full-day calendar refresh — live scores come from live-feed + WS + score polls. */
export const LIVE_FIXTURE_CALENDAR_POLL_MS = 45_000;
/** Max fixtures the matches list may register for background score polling. */
export const MATCHES_LIST_INTEREST_CAP = 20;
/** Upcoming kickoff window for list interest (ms before kickoff). */
export const MATCHES_LIST_KICKOFF_INTEREST_MS = 10 * 60 * 1000;
/** Calendar row still NS/upcoming this long after kickoff → stale; poll for FT. */
export const MATCHES_LIST_OVERDUE_KICKOFF_MS = 105 * 60 * 1000;
/** Cap overdue stale polls so we don't fan out on a stuck calendar day. */
export const MATCHES_LIST_STALE_OVERDUE_CAP = 15;
/** Live fixtures off-screen still polled (score-only) when not in viewport. */
export const MATCHES_LIST_BACKGROUND_LIVE_CAP = 5;

export const LIVE_STATUS_SHORTS = new Set([
  '1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP',
]);

export const FINISHED_STATUS_SHORTS = new Set([
  'FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO',
]);
