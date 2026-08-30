import type { Fixture } from '../services/apiFootball';
import type { Match } from '../components/Matches/matchCardUtils';

/** Duck-typed list-row / calendar card used to paint details before the bundle arrives. */
export type MatchPreviewSeed = {
  id?: string | number;
  home?: string;
  away?: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  statusShort?: string;
  elapsed?: number | null;
  extra?: number | null;
  startTimestamp?: number;
  matchDate?: string;
  fixtureDate?: string;
  leagueId?: number;
  leagueName?: string;
  leagueCountry?: string;
  leagueLogo?: string;
  homeTeam?: { name: string; logo?: string };
  awayTeam?: { name: string; logo?: string };
  score?: { home: number; away: number };
  league?: {
    id?: number;
    name?: string;
    logo?: string;
    country?: string;
    countryFlag?: string | null;
    round?: string;
  };
};

function toUnixSeconds(value: number | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
}

function statusShortFromPreview(input: MatchPreviewSeed): string {
  const raw = String(input.statusShort ?? '').trim();
  if (raw) return raw;
  const status = String(input.status ?? '').trim().toLowerCase();
  if (status === 'live') return 'LIVE';
  if (status === 'finished' || status === 'ft') return 'FT';
  if (status === 'tbd') return 'TBD';
  if (status === 'pst') return 'PST';
  if (status === 'ns' || status === 'upcoming') return 'NS';
  const upper = String(input.status ?? '').trim().toUpperCase();
  if (['LIVE', 'FT', 'NS', 'TBD', 'PST', '1H', '2H', 'HT', 'ET'].includes(upper)) {
    return upper;
  }
  return 'NS';
}

/**
 * Build an API-Football-shaped Fixture from a calendar/list card so match
 * details can paint teams/score immediately (no empty shell) while 365 loads.
 */
export function matchCardToApiFixture(
  input: Match | MatchPreviewSeed,
  fixtureId?: number,
): Fixture | null {
  const id = Number(fixtureId ?? input.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const homeName = input.homeTeam?.name ?? input.home ?? 'Home';
  const awayName = input.awayTeam?.name ?? input.away ?? 'Away';
  const homeLogo = input.homeTeam?.logo ?? input.homeLogo ?? '';
  const awayLogo = input.awayTeam?.logo ?? input.awayLogo ?? '';
  const homeScore = input.score?.home ?? input.homeScore ?? null;
  const awayScore = input.score?.away ?? input.awayScore ?? null;
  const iso = input.fixtureDate ?? input.matchDate ?? '';
  const timestamp =
    toUnixSeconds(input.startTimestamp) ||
    (iso ? Math.floor(new Date(iso).getTime() / 1000) || 0 : 0);
  const short = statusShortFromPreview(input);

  return {
    fixture: {
      id,
      referee: null,
      timezone: 'UTC',
      date: iso,
      timestamp,
      periods: { first: timestamp || null, second: null },
      venue: { id: null, name: null, city: null },
      status: {
        long: short,
        short,
        elapsed: input.elapsed ?? null,
        extra: input.extra ?? null,
      },
    },
    league: {
      id: input.league?.id ?? input.leagueId ?? 0,
      name: input.league?.name ?? input.leagueName ?? '',
      country: input.league?.country ?? input.leagueCountry ?? '',
      logo: input.league?.logo ?? input.leagueLogo ?? '',
      flag: input.league?.countryFlag ?? null,
      season: 0,
      round: input.league?.round ?? '',
    },
    teams: {
      home: { id: 0, name: homeName, logo: homeLogo, winner: null },
      away: { id: 0, name: awayName, logo: awayLogo, winner: null },
    },
    goals: { home: homeScore, away: awayScore },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: homeScore, away: awayScore },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

export function isApiFootballFixtureShape(value: unknown): value is Fixture {
  if (!value || typeof value !== 'object') return false;
  const fx = value as Fixture;
  return (
    Number.isFinite(fx.fixture?.id) &&
    !!fx.teams?.home?.name &&
    !!fx.teams?.away?.name
  );
}
