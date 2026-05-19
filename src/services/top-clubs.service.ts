/**
 * Top Clubs Service
 *
 * Returns the top 5 clubs per country, backed by the `cached_teams` table so
 * the API-Football quota is hit at most once every 7 days per country.
 *
 * Strategy:
 *  1. Look up the country's primary domestic league from COUNTRY_TOP_LEAGUE.
 *  2. If we have one → fetch the current standings, take the top 5 teams.
 *  3. If we don't → fall back to /teams?country={X} and take the first 5
 *     non-national teams (still useful as a discovery list).
 *  4. Persist each team to `cached_teams` (upsert by `teamId`) and serve all
 *     subsequent reads from the DB until the cache is older than 7 days.
 */

import prisma from '../lib/prisma';
import { footballService } from './football.service';
import { logger } from '../utils/logger';

export interface TopClub {
  teamId: number;
  name: string;
  logo: string | null;
  country: string;
  founded: number | null;
  venueName: string | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TOP_N = 5;
const DEFAULT_SEASON = new Date().getFullYear();

/**
 * Country (lowercased) → primary domestic league ID for that country.
 * Used as the source of truth for "top clubs" since standings give us a
 * meaningful ranking. Add more countries here as needed.
 */
const COUNTRY_TOP_LEAGUE: Record<string, number> = {
  england: 39,
  spain: 140,
  italy: 135,
  germany: 78,
  france: 61,
  netherlands: 88,
  portugal: 94,
  belgium: 144,
  turkey: 203,
  saudi: 307, // Saudi Pro League
  'saudi-arabia': 307,
  'saudi arabia': 307,
  egypt: 233, // Egyptian Premier League
  morocco: 200,
  algeria: 186,
  tunisia: 202,
  brazil: 71, // Serie A Brasil
  argentina: 128, // Liga Profesional
  usa: 253, // MLS
  'united-states': 253,
  'united states': 253,
  mexico: 262,
};

function normaliseCountry(country: string): string {
  return country.trim().toLowerCase();
}

interface StandingTeam {
  team?: { id?: number; name?: string; logo?: string };
}

interface ApiTeamRow {
  team?: { id?: number; name?: string; logo?: string; country?: string; founded?: number; national?: boolean };
  venue?: { name?: string; address?: string; city?: string; capacity?: number; image?: string };
}

async function fetchFromApi(country: string): Promise<TopClub[]> {
  const key = normaliseCountry(country);
  const leagueId = COUNTRY_TOP_LEAGUE[key];

  // Path 1 — country has a known primary league: use standings for ranking.
  if (leagueId) {
    try {
      const standings = await footballService.getStandings(leagueId, DEFAULT_SEASON);
      if (Array.isArray(standings) && standings.length > 0) {
        const top = standings.slice(0, TOP_N);
        // Standings rows give us team id/name/logo but no venue / country —
        // we can still persist what we have and the UI only needs id+logo+name.
        return top
          .map((row: StandingTeam): TopClub | null => {
            const t = row.team;
            if (!t?.id || !t?.name) return null;
            return {
              teamId: t.id,
              name: t.name,
              logo: t.logo ?? null,
              country,
              founded: null,
              venueName: null,
            };
          })
          .filter((x): x is TopClub => x !== null);
      }
    } catch (err: any) {
      logger.warn(`[top-clubs] Standings lookup failed for ${country} (league ${leagueId}):`, err?.message);
    }
  }

  // Path 2 — fall back to /teams?country={X}, first N non-national teams.
  try {
    const result = await footballService.getTeamsByCountry(country);
    const rows: ApiTeamRow[] = Array.isArray(result?.teams) ? (result.teams as ApiTeamRow[]) : [];
    return rows
      .filter((r) => r.team?.id && r.team?.name && !r.team?.national)
      .slice(0, TOP_N)
      .map((r): TopClub => ({
        teamId: r.team!.id!,
        name: r.team!.name!,
        logo: r.team!.logo ?? null,
        country: r.team!.country ?? country,
        founded: r.team!.founded ?? null,
        venueName: r.venue?.name ?? null,
      }));
  } catch (err: any) {
    logger.warn(`[top-clubs] /teams fallback failed for ${country}:`, err?.message);
    return [];
  }
}

async function persistTopClubs(country: string, clubs: TopClub[]): Promise<void> {
  if (clubs.length === 0) return;
  await Promise.all(
    clubs.map((c) =>
      prisma.cachedTeam
        .upsert({
          where: { teamId: c.teamId },
          create: {
            teamId: c.teamId,
            name: c.name,
            logo: c.logo,
            country: c.country,
            founded: c.founded,
            venueName: c.venueName,
            fullData: c as unknown as object,
          },
          update: {
            name: c.name,
            logo: c.logo,
            country: c.country,
            founded: c.founded,
            venueName: c.venueName,
            fullData: c as unknown as object,
          },
        })
        .catch((err: any) => logger.warn(`[top-clubs] persist failed for ${c.teamId}:`, err?.message)),
    ),
  );
}

async function readFromDb(country: string): Promise<TopClub[]> {
  const rows = await prisma.cachedTeam.findMany({
    where: { country: { equals: country, mode: 'insensitive' } },
    orderBy: { updatedAt: 'desc' },
    take: TOP_N,
  });
  return rows.map((r) => ({
    teamId: r.teamId,
    name: r.name,
    logo: r.logo,
    country: r.country ?? country,
    founded: r.founded,
    venueName: r.venueName,
  }));
}

function isStale(rows: { updatedAt: Date }[]): boolean {
  if (rows.length === 0) return true;
  const newest = Math.max(...rows.map((r) => r.updatedAt.getTime()));
  return Date.now() - newest > SEVEN_DAYS_MS;
}

/**
 * Get the top 5 clubs for a country.
 *
 * Tries cache first (DB). If empty or stale (>7 days) refreshes from
 * API-Football and persists. On API failure with a stale cache, returns the
 * stale cache rather than nothing so the UX still works.
 */
export async function getTopClubsByCountry(
  country: string,
  forceRefresh = false,
): Promise<{ clubs: TopClub[]; source: 'cache' | 'api' | 'stale-cache' }> {
  const dbRows = await prisma.cachedTeam.findMany({
    where: { country: { equals: country, mode: 'insensitive' } },
    orderBy: { updatedAt: 'desc' },
    take: TOP_N,
  });

  if (!forceRefresh && dbRows.length >= TOP_N && !isStale(dbRows)) {
    return {
      clubs: dbRows.map((r) => ({
        teamId: r.teamId,
        name: r.name,
        logo: r.logo,
        country: r.country ?? country,
        founded: r.founded,
        venueName: r.venueName,
      })),
      source: 'cache',
    };
  }

  // Cache is empty/stale — refresh from API.
  const fresh = await fetchFromApi(country);

  if (fresh.length > 0) {
    await persistTopClubs(country, fresh);
    return { clubs: fresh, source: 'api' };
  }

  // API gave us nothing — fall back to whatever stale cache we still have.
  if (dbRows.length > 0) {
    logger.warn(`[top-clubs] Returning stale cache for ${country} (API returned no clubs)`);
    return {
      clubs: await readFromDb(country),
      source: 'stale-cache',
    };
  }

  return { clubs: [], source: 'api' };
}

/**
 * Public list of countries we support out of the box.
 */
export function getSupportedCountries(): string[] {
  return Object.keys(COUNTRY_TOP_LEAGUE);
}
