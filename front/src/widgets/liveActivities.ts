import {
  liveActivities,
  type MatchActivityAttributes,
  type MatchActivityState,
} from '../../modules/widget-bridge';
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
  elapsed: number | null;
  extra: number | null;
  home: FeedSide;
  away: FeedSide;
  score: { home: number; away: number } | null;
  league: { name: string } | null;
}

function toState(match: FeedMatch, nowSec: number): MatchActivityState {
  const status = match.status === 'off' ? 'ft' : match.status;
  const minute = match.elapsed != null ? match.elapsed + (match.extra ?? 0) : null;
  return {
    homeScore: match.score?.home ?? 0,
    awayScore: match.score?.away ?? 0,
    status,
    minute,
    clockStart: status === 'live' && minute != null ? nowSec - minute * 60 : null,
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

/**
 * Opens (or refreshes) the lock screen / Dynamic Island card for followed teams playing right now.
 * The server starts them by push on iOS 17.2+; this covers older iOS and app-open moments.
 */
export async function syncLiveActivities(apiBase: string, teamIds: number[], language: string): Promise<void> {
  if (!liveActivities.isSupported) return;
  try {
    await liveActivities.refreshRegistration();
    if (teamIds.length === 0 || !(await liveActivities.areEnabled())) return;

    const url = `${apiBase}/football/widget/followed?teams=${teamIds.join(',')}&language=${language}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const body = await res.json();
    const live: FeedMatch[] = (body?.response?.teams ?? [])
      .map((team: { match: FeedMatch | null }) => team.match)
      .filter((m: FeedMatch | null): m is FeedMatch => m != null && (m.status === 'live' || m.status === 'ht'));
    if (live.length === 0) return;

    const running = new Set(await liveActivities.activeFixtureIds());
    const nowSec = Math.floor(Date.now() / 1000);
    let count = running.size;
    for (const match of live) {
      const isRunning = running.has(match.fixtureId);
      if (!isRunning && (count >= MAX_RUNNING || (match.elapsed ?? 0) > START_MAX_ELAPSED)) continue;
      const opened = await liveActivities.start(toAttributes(match, language), toState(match, nowSec));
      if (opened && !isRunning) count += 1;
    }
  } catch (error) {
    logger.warn('[live-activity] sync failed:', error);
  }
}
