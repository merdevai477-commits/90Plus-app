import {
  liveActivities,
  type LiveActivityTokenRow,
  type MatchActivityAttributes,
  type MatchActivityState,
} from '../../modules/widget-bridge';
import { captureMessage } from '../../services/sentry.service';
import { logger } from '../../utils/logger';

/** Mirrors START_MAX_ELAPSED / per-device caps in the backend live-activity.service.ts. */
const MAX_RUNNING = 2;
const START_MAX_ELAPSED = 80;

interface FeedSide {
  id: number;
  name: string;
  logo: string | null;
}

interface FeedMatch {
  fixtureId: number;
  status: 'live' | 'ht' | 'upcoming' | 'ft' | 'off';
  statusShort?: string;
  elapsed: number | null;
  extra: number | null;
  home: FeedSide;
  away: FeedSide;
  score: { home: number; away: number } | null;
  league: { name: string } | null;
}

function periodEndMin(statusShort: string, elapsed: number): number {
  const s = statusShort.trim().toUpperCase();
  if (s === '1H') return 45;
  if (s === 'ET') return elapsed >= 120 ? 120 : 90;
  if (s === 'LIVE' || s === 'INT') {
    if (elapsed <= 45) return 45;
    if (elapsed <= 90) return 90;
    return elapsed >= 120 ? 120 : 90;
  }
  return 90;
}

function isActivityStoppage(
  statusShort: string,
  elapsed: number | null,
  extra: number | null,
): boolean {
  const s = statusShort.trim().toUpperCase();
  const hasExtra = extra != null && extra > 0;
  if (elapsed == null) return hasExtra;
  if (s === '1H') return hasExtra || elapsed > 45;
  if (s === '2H' || s === 'LIVE' || s === 'INT') {
    return hasExtra || elapsed > periodEndMin(s, elapsed);
  }
  if (s === 'ET') return hasExtra || elapsed > 120;
  return false;
}

function toState(match: FeedMatch, nowSec: number): MatchActivityState {
  const status = match.status === 'off' ? 'ft' : match.status;
  const elapsed = match.elapsed;
  const extra = match.extra;
  const statusShort = match.statusShort ?? 'LIVE';
  const stoppage = isActivityStoppage(statusShort, elapsed, extra);
  const canTick =
    status === 'live' &&
    elapsed != null &&
    !stoppage &&
    elapsed < periodEndMin(statusShort, elapsed);
  // Snap "now" to the minute so re-pushes with the same elapsed do not jitter the on-device timer.
  const clockStart = canTick ? Math.floor(nowSec / 60) * 60 - elapsed! * 60 : null;
  return {
    homeScore: match.score?.home ?? 0,
    awayScore: match.score?.away ?? 0,
    status,
    minute: elapsed,
    statusShort,
    extra,
    clockStart,
  };
}

function toAttributes(match: FeedMatch, language: string): MatchActivityAttributes {
  return {
    fixtureId: match.fixtureId,
    homeName: match.home.name,
    awayName: match.away.name,
    homeLogo: match.home.logo ?? '',
    awayLogo: match.away.logo ?? '',
    league: match.league?.name ?? '',
    language,
  };
}

function normalizePair(home: string, away: string): string {
  return `${home.trim().toLowerCase()}|${away.trim().toLowerCase()}`;
}

/**
 * Native URLSession registration has been observed to never reach production.
 * JS fetch is the reliable path; native still posts as a best-effort parallel.
 */
async function registerTokensWithFetch(
  apiBase: string,
  language: string,
  teamIds: number[],
): Promise<void> {
  const bundle = await liveActivities.currentTokens();
  if (!bundle.deviceId || bundle.tokens.length === 0) return;

  await Promise.all(
    bundle.tokens.map(async (row: LiveActivityTokenRow) => {
      const body: Record<string, unknown> = {
        kind: row.kind,
        token: row.token,
        deviceId: bundle.deviceId,
        language,
      };
      if (row.kind === 'start') body.teamIds = teamIds;
      if (row.kind === 'update' && row.fixtureId != null) body.fixtureId = row.fixtureId;
      try {
        const res = await fetch(`${apiBase}/live-activity/tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          logger.warn(`[live-activity] token POST ${row.kind} → ${res.status}`);
        }
      } catch (error) {
        logger.warn('[live-activity] token POST failed:', error);
      }
    }),
  );
}

let lastEmptyTokenReportAt = 0;

async function maybeReportMissingTokens(activeCount: number): Promise<void> {
  if (activeCount === 0) return;
  const now = Date.now();
  if (now - lastEmptyTokenReportAt < 30 * 60_000) return;
  const bundle = await liveActivities.currentTokens();
  const hasUpdate = bundle.tokens.some((t) => t.kind === 'update');
  if (hasUpdate) return;
  lastEmptyTokenReportAt = now;
  const diag = await liveActivities.diagnostics();
  captureMessage('Live Activity update token missing while cards are active', 'warning', {
    tags: { area: 'live-activity' },
    extra: { activeCount, deviceId: bundle.deviceId, diag },
  });
}

/**
 * Opens (or refreshes) the lock screen / Dynamic Island card for followed teams playing right now.
 * The server starts them by push on iOS 17.2+; this covers older iOS and app-open moments.
 */
export async function syncLiveActivities(
  apiBase: string,
  teamIds: number[],
  language: string,
  favoriteIds: number[] = [],
): Promise<void> {
  if (!liveActivities.isSupported) return;
  try {
    await liveActivities.refreshRegistration();
    await registerTokensWithFetch(apiBase, language, teamIds);

    if ((teamIds.length === 0 && favoriteIds.length === 0) || !(await liveActivities.areEnabled())) {
      return;
    }

    const params = new URLSearchParams({ language });
    if (teamIds.length > 0) params.set('teams', teamIds.join(','));
    if (favoriteIds.length > 0) params.set('favorites', favoriteIds.join(','));
    const url = `${apiBase}/football/widget/followed?${params.toString()}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const body = await res.json();
    const response = body?.response ?? {};
    const primary = response.primary as FeedMatch | null | undefined;
    const fromTeams: FeedMatch[] = (response.teams ?? [])
      .map((team: { match: FeedMatch | null }) => team.match)
      .filter((m: FeedMatch | null): m is FeedMatch => m != null && (m.status === 'live' || m.status === 'ht'));
    const seen = new Set<number>();
    const seenPairs = new Set<string>();
    const live: FeedMatch[] = [];
    for (const match of [primary, ...fromTeams]) {
      if (match == null || (match.status !== 'live' && match.status !== 'ht')) continue;
      if (seen.has(match.fixtureId)) continue;
      const pair = normalizePair(match.home.name, match.away.name);
      if (seenPairs.has(pair)) continue;
      seen.add(match.fixtureId);
      seenPairs.add(pair);
      live.push(match);
    }

    // Drop finished / orphaned cards as soon as the app is open — do not wait for APNs end events.
    await liveActivities.endExcept(live.map((m) => m.fixtureId));

    if (live.length === 0) {
      await registerTokensWithFetch(apiBase, language, teamIds);
      return;
    }

    const running = new Set(await liveActivities.activeFixtureIds());
    await maybeReportMissingTokens(running.size);

    const nowSec = Math.floor(Date.now() / 1000);
    let count = running.size;
    for (const match of live) {
      const isRunning = running.has(match.fixtureId);
      if (!isRunning && (count >= MAX_RUNNING || (match.elapsed ?? 0) > START_MAX_ELAPSED)) continue;
      const opened = await liveActivities.start(toAttributes(match, language), toState(match, nowSec));
      if (opened && !isRunning) count += 1;
    }

    // Tokens often arrive a beat after Activity.request — register again after starts.
    await liveActivities.refreshRegistration();
    await registerTokensWithFetch(apiBase, language, teamIds);
  } catch (error) {
    logger.warn('[live-activity] sync failed:', error);
  }
}
