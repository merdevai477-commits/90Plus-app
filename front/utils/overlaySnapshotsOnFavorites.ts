/**
 * Favorites-only live overlay.
 *
 * Competitor / disk / bell rows stay the base source. When liveFixtureStore
 * has a fresher snapshot for the same fixture id, live score/status/clock win
 * via the shared decideLiveMerge freshness rules (same semantics as Matches).
 *
 * Does not mutate competitor fixtures or store snapshots.
 * Does not touch overlaySnapshotsOnCalendar / useMatchesData.
 */

import type { FavoritesListFixture } from '../hooks/useFavoritesFeed';
import type { LiveFixtureSnapshot } from '../src/store/liveFixtureStore.types';
import { formatLiveMinuteDisplay } from './formatLiveMinuteDisplay';
import {
  decideLiveMerge,
  type LiveClockView,
} from './liveFixtureFreshness';

const LIVE_SHORT = new Set([
  '1H',
  '2H',
  'HT',
  'ET',
  'BT',
  'P',
  'LIVE',
  'INT',
]);

function mapApiStatus(short?: string | null): FavoritesListFixture['status'] {
  const s = (short || '').toUpperCase();
  if (LIVE_SHORT.has(s)) return 'LIVE';
  if (s === 'FT' || s === 'AET' || s === 'PEN') return 'FT';
  return 'UPCOMING';
}

function normalizeShort(short: string | null | undefined): string {
  return (short ?? '').trim().toUpperCase();
}

export function clockFromFavoritesListFixture(row: FavoritesListFixture): LiveClockView {
  const short =
    normalizeShort(row.statusShort) ||
    (row.status === 'FT' ? 'FT' : row.status === 'LIVE' ? 'LIVE' : 'NS');
  return {
    short,
    elapsed: row.elapsed ?? null,
    extra: row.extra ?? null,
    home: row.homeScore,
    away: row.awayScore,
  };
}

function favoritesLiveFingerprint(row: FavoritesListFixture): string {
  return `${row.status}|${row.homeScore}|${row.awayScore}|${row.elapsed ?? ''}|${row.extra ?? ''}|${row.minute ?? ''}|${row.statusShort ?? ''}`;
}

/** Build a Favorites row projection from a store snapshot (static fields from base). */
export function favoritesRowFromSnapshot(
  base: FavoritesListFixture,
  snap: LiveFixtureSnapshot,
): FavoritesListFixture {
  const st = snap.fixture?.fixture?.status;
  const short = (st?.short ?? '').trim();
  const status = mapApiStatus(short);
  const elapsed = st?.elapsed ?? null;
  const extra = st?.extra ?? null;
  const homeSide = snap.fixture?.teams?.home;
  const awaySide = snap.fixture?.teams?.away;
  const homeScore = snap.fixture?.goals?.home ?? base.homeScore;
  const awayScore = snap.fixture?.goals?.away ?? base.awayScore;
  const minute =
    status === 'FT'
      ? undefined
      : formatLiveMinuteDisplay(short, elapsed, extra) ??
        (status === 'LIVE' && elapsed != null ? `${elapsed}'` : base.minute);

  return {
    ...base,
    home: preferRealName(base.home, homeSide?.name),
    away: preferRealName(base.away, awaySide?.name),
    homeLogo: preferLogo(base.homeLogo, homeSide?.logo),
    awayLogo: preferLogo(base.awayLogo, awaySide?.logo),
    homeScore: homeScore ?? 0,
    awayScore: awayScore ?? 0,
    status,
    live: status === 'LIVE',
    statusShort: short || base.statusShort,
    elapsed,
    extra,
    minute,
  };
}

function withAuthoritativeFavoritesMinute(row: FavoritesListFixture): FavoritesListFixture {
  if (row.status !== 'LIVE') return row;
  const label = formatLiveMinuteDisplay(row.statusShort ?? '', row.elapsed, row.extra);
  if (!label || row.minute === label) return row;
  return { ...row, minute: label };
}

/**
 * Overlay liveFixtureStore snapshots onto Favorites list rows.
 * Unchanged rows keep the same object reference.
 */
export type FavoriteLiveFields = {
  home?: string;
  away?: string;
  homeLogo?: string;
  awayLogo?: string;
  leagueName?: string;
  leagueLogo?: string;
  homeScore: number;
  awayScore: number;
  status: FavoritesListFixture['status'];
  live?: boolean;
  statusShort?: string;
  elapsed?: number | null;
  extra?: number | null;
  minute?: string;
};

const PLACEHOLDER_TEAM_NAMES = new Set([
  'home',
  'away',
  'tbd',
  'match',
  'المنزل',
  'بعيداً',
  'بعيدا',
  'مباراة',
]);

export function isPlaceholderTeamName(name: string | null | undefined): boolean {
  const trimmed = (name ?? '').trim().toLowerCase();
  return trimmed.length === 0 || PLACEHOLDER_TEAM_NAMES.has(trimmed);
}

function preferRealName(current: string, incoming: string | null | undefined): string {
  const next = (incoming ?? '').trim();
  if (!next || isPlaceholderTeamName(next)) return current;
  if (isPlaceholderTeamName(current)) return next;
  return current;
}

function preferLogo(current: string, incoming: string | null | undefined): string {
  const next = (incoming ?? '').trim();
  return current.trim() || next;
}

/**
 * Bell and followed-team rows are stored without a live score or clock.
 * The matches list already has both. Copy them when the list is ahead:
 * a minute arrived, the score moved, or the match finished.
 */
export function overlayLiveListOnFavorites(
  rows: FavoritesListFixture[],
  liveById: Record<string, FavoriteLiveFields>,
): FavoritesListFixture[] {
  if (rows.length === 0 || Object.keys(liveById).length === 0) return rows;

  let anyChanged = false;
  const next = rows.map((row) => {
    const live = liveById[row.id];
    if (!live) return row;
    const liveGoals = (live.homeScore ?? 0) + (live.awayScore ?? 0);
    const rowGoals = row.homeScore + row.awayScore;
    const clockArrived = live.elapsed != null && row.elapsed == null;
    const scoreArrived = liveGoals > rowGoals;
    const finishedArrived = live.status === 'FT' && row.status !== 'FT';
    const home = preferRealName(row.home, live.home);
    const away = preferRealName(row.away, live.away);
    const homeLogo = preferLogo(row.homeLogo, live.homeLogo);
    const awayLogo = preferLogo(row.awayLogo, live.awayLogo);
    const leagueName = preferRealName(row.leagueName ?? '', live.leagueName) || row.leagueName;
    const leagueLogo = preferLogo(row.leagueLogo ?? '', live.leagueLogo) || row.leagueLogo;
    const identityArrived =
      home !== row.home ||
      away !== row.away ||
      homeLogo !== row.homeLogo ||
      awayLogo !== row.awayLogo ||
      leagueName !== row.leagueName ||
      leagueLogo !== row.leagueLogo;
    if (!clockArrived && !scoreArrived && !finishedArrived && !identityArrived) return row;

    const minute =
      live.status === 'FT'
        ? undefined
        : formatLiveMinuteDisplay(live.statusShort ?? '', live.elapsed, live.extra) ??
          live.minute ??
          row.minute;
    anyChanged = true;
    return {
      ...row,
      home,
      away,
      homeLogo,
      awayLogo,
      leagueName,
      leagueLogo,
      homeScore: clockArrived || scoreArrived ? live.homeScore : row.homeScore,
      awayScore: clockArrived || scoreArrived ? live.awayScore : row.awayScore,
      status: finishedArrived ? 'FT' : live.status === 'LIVE' ? 'LIVE' : row.status,
      live: finishedArrived ? false : (live.live ?? live.status === 'LIVE'),
      statusShort: live.statusShort ?? row.statusShort,
      elapsed: live.elapsed ?? row.elapsed,
      extra: live.extra ?? row.extra,
      minute,
    };
  });

  return anyChanged ? next : rows;
}

export function overlaySnapshotsOnFavorites(
  rows: FavoritesListFixture[],
  snapshots: Record<number, LiveFixtureSnapshot>,
): FavoritesListFixture[] {
  if (rows.length === 0 || Object.keys(snapshots).length === 0) {
    return rows;
  }

  let anyChanged = false;
  const next = rows.map((row) => {
    const id = parseInt(row.id, 10);
    if (!Number.isFinite(id) || id <= 0) return row;
    const snap = snapshots[id];
    if (!snap?.fixture) return row;

    // Do not revive a finished Favorites row with a leftover live snapshot.
    if (row.status === 'FT' && snap.phase !== 'finished') {
      return row;
    }

    const shouldConsider =
      row.status === 'LIVE' ||
      snap.phase === 'live' ||
      snap.phase === 'finished' ||
      (row.status === 'UPCOMING' &&
        snap.phase !== 'upcoming' &&
        snap.phase !== 'unknown');
    if (!shouldConsider) return row;

    const fromSnap = favoritesRowFromSnapshot(row, snap);
    const snapClock = clockFromFavoritesListFixture(fromSnap);
    const rowClock = clockFromFavoritesListFixture(row);
    // Same argument order as overlaySnapshotsOnCalendar:
    // existing = snapshot, incoming = competitor/cache row.
    const decision = decideLiveMerge(snapClock, rowClock);

    if (decision.action === 'REPLACE') {
      const fresh = withAuthoritativeFavoritesMinute(row);
      if (favoritesLiveFingerprint(fresh) !== favoritesLiveFingerprint(row)) {
        anyChanged = true;
        return fresh;
      }
      return row;
    }

    if (favoritesLiveFingerprint(row) === favoritesLiveFingerprint(fromSnap)) {
      return row;
    }
    anyChanged = true;
    return fromSnap;
  });

  return anyChanged ? next : rows;
}

/** Shallow equality for a small id→snapshot map (revision + live clock fields). */
export function favoritesOverlaySnapshotsEqual(
  a: Record<number, LiveFixtureSnapshot>,
  b: Record<number, LiveFixtureSnapshot>,
): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    const id = Number(key);
    const left = a[id];
    const right = b[id];
    if (!right || !left) return false;
    if (left.revision !== right.revision) return false;
    if (left.phase !== right.phase) return false;
    if (left.updatedAt !== right.updatedAt) return false;
    const ls = left.fixture?.fixture?.status;
    const rs = right.fixture?.fixture?.status;
    if (ls?.short !== rs?.short) return false;
    if (ls?.elapsed !== rs?.elapsed) return false;
    if (ls?.extra !== rs?.extra) return false;
    if (left.fixture?.goals?.home !== right.fixture?.goals?.home) return false;
    if (left.fixture?.goals?.away !== right.fixture?.goals?.away) return false;
  }
  return true;
}
