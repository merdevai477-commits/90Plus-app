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
  // `Match` carries the nested shape and calendar rows carry the flat one; both
  // are read through the seed's optional fields rather than narrowed per branch.
  const seed = input as MatchPreviewSeed;

  const id = Number(fixtureId ?? seed.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const homeName = seed.homeTeam?.name ?? seed.home ?? 'Home';
  const awayName = seed.awayTeam?.name ?? seed.away ?? 'Away';
  const homeLogo = seed.homeTeam?.logo ?? seed.homeLogo ?? '';
  const awayLogo = seed.awayTeam?.logo ?? seed.awayLogo ?? '';
  const homeScore = seed.score?.home ?? seed.homeScore ?? null;
  const awayScore = seed.score?.away ?? seed.awayScore ?? null;
  const iso = seed.fixtureDate ?? seed.matchDate ?? '';
  const timestamp =
    toUnixSeconds(seed.startTimestamp) ||
    (iso ? Math.floor(new Date(iso).getTime() / 1000) || 0 : 0);
  const short = statusShortFromPreview(seed);

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
        elapsed: seed.elapsed ?? null,
        extra: seed.extra ?? null,
      },
    },
    league: {
      id: seed.league?.id ?? seed.leagueId ?? 0,
      name: seed.league?.name ?? seed.leagueName ?? '',
      country: seed.league?.country ?? seed.leagueCountry ?? '',
      logo: seed.league?.logo ?? seed.leagueLogo ?? '',
      flag: seed.league?.countryFlag ?? null,
      season: 0,
      round: seed.league?.round ?? '',
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
