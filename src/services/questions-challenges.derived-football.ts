/**
 * Derived football candidates — real facts the project already holds, reshaped.
 *
 * API-Football supplies transfers (`/transfers`) and scorer rankings
 * (`/players/topscorers`). When that account is unavailable, both pools arrive
 * empty and Transfer Puzzle and Top 10 cannot be authored at all — even though
 * the same facts are already sitting in `cached_365_player_career`, which
 * stores each player's season-by-season record including the club and
 * competition every appearance was made for.
 *
 * NOTHING HERE IS INVENTED. Every club, season, goal total, player name and
 * image comes from a persisted provider response:
 *
 *   club sequence  ← seasons[].competitions[].teamName  (the club a player
 *                    actually played for that season, chosen by appearances)
 *   ranking        ← seasons[].competitions[].goals     (goals actually scored
 *                    in that competition that season)
 *   portraits      ← cached_365_player_career.photo
 *   crests         ← cached_teams.logo / cached_fixtures team logos
 *
 * What is DERIVED is only the arrangement: ordering seasons chronologically,
 * collapsing consecutive seasons at one club into a single step, and sorting
 * players by a goal total that was already recorded. No date, fee, club or
 * statistic is estimated, and a chain or ranking that cannot be built entirely
 * from present values is dropped rather than completed with a guess.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import type { QuizLanguage } from '../types/quiz.types';
import type { RankingCandidate, TransferCandidate } from './questions-challenges.football-data';
import { TOP10_SLOT_COUNT } from '../constants/questions-modes.config';
import { remoteImageUrlOrNull as imageUrlOrNull } from './questions-challenges.round-contract';

/** 365Scores labels club rows as "Club (Name)" / "نادي (Name)". */
function cleanClubName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/^Club\s*\((.*)\)$/, '$1')
    .replace(/^نادي\s*\((.*)\)$/, '$1')
    .trim();
}

function normalizeKey(raw: unknown): string {
  return cleanClubName(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9؀-ۿ ]/g, '')
    .trim();
}

/**
 * National-team rows are not transfers. A player moving between his club and
 * his country is not a career move, and treating it as one would state
 * something false.
 */
function isNationalTeam(name: string): boolean {
  return /^National team/i.test(name) || /^منتخب/.test(name);
}

/**
 * A season split across clubs is stored as one row naming several teams
 * ("Man City & Bayern"). Which club the player actually left, and when, is not
 * recoverable from that, so the season is skipped rather than guessed at.
 */
function isAmbiguousClub(name: string): boolean {
  return name.includes('&');
}

interface CareerRow {
  athleteId: number;
  name: string;
  photo: string | null;
  data: {
    seasons?: Array<{
      seasonKey?: string;
      competitions?: Array<{
        teamId?: number;
        teamName?: string;
        competitionId?: number;
        competitionName?: string;
        goals?: number;
        appearances?: number;
      }>;
    }>;
  } | null;
}

async function loadCareerRows(): Promise<CareerRow[]> {
  return prisma.$queryRawUnsafe<CareerRow[]>(
    `select "athleteId", name, photo, data
       from public.cached_365_player_career
      where photo is not null and photo <> ''`,
  );
}

/** name → crest, from the two tables that actually carry club imagery. */
async function loadCrestIndex(): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const teams = await prisma.$queryRawUnsafe<Array<{ name: string; logo: string }>>(
    `select name, logo from public.cached_teams where logo is not null and logo <> ''`,
  );
  for (const team of teams) {
    const url = imageUrlOrNull(team.logo);
    if (url) index.set(normalizeKey(team.name), url);
  }

  // Fixtures carry crests for clubs the teams table never cached.
  const fixtures = await prisma.$queryRawUnsafe<Array<{ n: string; l: string }>>(
    `select distinct "homeTeamName" as n, "homeTeamLogo" as l
       from public.cached_fixtures
      where "homeTeamLogo" is not null and "homeTeamLogo" <> ''
      limit 20000`,
  );
  for (const row of fixtures) {
    const key = normalizeKey(row.n);
    if (index.has(key)) continue;
    const url = imageUrlOrNull(row.l);
    if (url) index.set(key, url);
  }
  return index;
}

/** The club a player actually played for in one season: most appearances. */
function clubForSeason(season: CareerRow['data'] extends null ? never : any): { club: string } | null {
  const competitions = Array.isArray(season?.competitions) ? season.competitions : [];
  const byClub = new Map<string, number>();
  for (const competition of competitions) {
    if (!competition?.teamId || !competition?.teamName) continue;
    const name = cleanClubName(competition.teamName);
    if (!name) continue;
    byClub.set(name, (byClub.get(name) ?? 0) + (competition.appearances ?? 0));
  }
  if (byClub.size === 0) return null;
  const [club] = [...byClub.entries()].sort((a, b) => b[1] - a[1])[0]!;
  if (!club || isNationalTeam(club) || isAmbiguousClub(club)) return null;
  return { club };
}

/**
 * Transfer chains: consecutive seasons at one club collapse into a single step,
 * dated with the first season the player appeared for that club. The step's
 * `year` is that season key — a real season the player played, not an invented
 * transfer date.
 */
export async function buildDerivedTransferCandidates(limit: number): Promise<TransferCandidate[]> {
  const [rows, crests] = await Promise.all([loadCareerRows(), loadCrestIndex()]);
  const out: TransferCandidate[] = [];

  for (const row of rows) {
    if (out.length >= limit) break;
    const seasons = Array.isArray(row.data?.seasons) ? row.data!.seasons! : [];

    const perSeason: Array<{ season: string; club: string }> = [];
    for (const season of seasons) {
      const resolved = clubForSeason(season);
      if (!resolved || !season?.seasonKey) continue;
      perSeason.push({ season: String(season.seasonKey), club: resolved.club });
    }
    perSeason.sort((a, b) => Number(a.season) - Number(b.season));

    const chain: Array<{ club: string; season: string }> = [];
    for (const entry of perSeason) {
      if (chain.length === 0 || chain[chain.length - 1]!.club !== entry.club) {
        chain.push({ club: entry.club, season: entry.season });
      }
    }

    // Every rendered step shows a crest, so a step without one is unusable.
    const steps = chain
      .map((entry) => ({
        clubName: entry.club,
        logoUrl: crests.get(normalizeKey(entry.club)),
        year: entry.season,
      }))
      .filter((step): step is { clubName: string; logoUrl: string; year: string } => Boolean(step.logoUrl));

    if (steps.length < 3) continue;

    const lastThree = steps.slice(-3);
    out.push({
      id: `derived-transfer:${row.athleteId}`,
      playerId: `derived-player:${row.athleteId}`,
      playerName: row.name,
      priorSteps: lastThree.slice(0, -1),
      finalStep: lastThree[lastThree.length - 1]!,
    });
  }

  return out;
}

/**
 * Rankings: players ordered by goals actually recorded in one competition and
 * season. A tie anywhere in the top three means there is no single right order,
 * so that ranking is dropped — the same rule the API-Football path applies.
 */
export async function buildDerivedRankingCandidates(
  language: QuizLanguage,
  limit: number,
): Promise<RankingCandidate[]> {
  const rows = await loadCareerRows();

  type Entry = { name: string; photoUrl: string; goals: number };
  const groups = new Map<string, { label: string; season: string; competitionId: number; byPlayer: Map<number, Entry> }>();

  for (const row of rows) {
    const photoUrl = imageUrlOrNull(row.photo);
    if (!photoUrl) continue;
    for (const season of Array.isArray(row.data?.seasons) ? row.data!.seasons! : []) {
      for (const competition of Array.isArray(season?.competitions) ? season.competitions! : []) {
        const goals = Number(competition?.goals ?? 0);
        if (!competition?.competitionId || !competition?.competitionName || !(goals > 0)) continue;
        const key = `${competition.competitionId}|${season.seasonKey}`;
        let group = groups.get(key);
        if (!group) {
          group = {
            label: String(competition.competitionName),
            season: String(season.seasonKey ?? ''),
            competitionId: Number(competition.competitionId),
            byPlayer: new Map(),
          };
          groups.set(key, group);
        }
        const existing = group.byPlayer.get(row.athleteId);
        // One player, one row per competition-season: keep his best recorded total.
        if (!existing || goals > existing.goals) {
          group.byPlayer.set(row.athleteId, { name: row.name, photoUrl, goals });
        }
      }
    }
  }

  const out: RankingCandidate[] = [];
  /*
   * One ranking per competition. A round refuses two questions about the same
   * subject (ROUND_DUPLICATE_SUBJECT), and a Top 10 question's subject is its
   * league — so the Premier League in 2024 and in 2025 are the same subject and
   * collide. Competitions are keyed by id here; seasons compete for the slot
   * and the most recent one wins.
   */
  const seenCompetitions = new Set<number>();
  const ordered = [...groups.entries()].sort(
    (a, b) => Number(b[1].season) - Number(a[1].season),
  );

  for (const [key, group] of ordered) {
    if (out.length >= limit) break;
    if (seenCompetitions.has(group.competitionId)) continue;
    const ranked = [...group.byPlayer.values()].sort((a, b) => b.goals - a.goals).slice(0, TOP10_SLOT_COUNT);
    if (ranked.length < 3) continue;
    if (ranked[0]!.goals === ranked[1]!.goals || ranked[1]!.goals === ranked[2]!.goals) continue;

    seenCompetitions.add(group.competitionId);
    out.push({
      id: `derived-ranking:${key}`,
      leagueId: group.competitionId,
      leagueLabel: group.label,
      season: Number(group.season) || 0,
      rows: ranked,
    });
  }

  logger.info('[QuestionsChallenges:Derived] built candidates from persisted career data', {
    language,
    rankings: out.length,
  });
  return out;
}
