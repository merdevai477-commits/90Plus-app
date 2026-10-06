/**
 * Top Scorers Five — the curated player pool: seeding the supplied lists and
 * resolving each name to a 365Scores athleteId once, so no request ever
 * re-resolves names.
 *
 * Resolution uses the existing 365Scores client: the club squad (Arabic and
 * English, Redis-cached) first, the athlete search as a fallback.
 */

import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { TOP_SCORERS_FIVE_LALIGA, type TopScorersFiveSeedClub } from '../data/top-scorers-five-laliga';
import { scoreTsfNameMatch, tsfPortraitUrl, type TsfLeagueKey } from './top-scorers-five-scoring';
import type { ThreeSixFiveSquadPlayer } from './threeSixFiveScores.service';

const SEED_LISTS: Partial<Record<TsfLeagueKey, TopScorersFiveSeedClub[]>> = {
  laliga: TOP_SCORERS_FIVE_LALIGA,
};

const POSITION_CODES: Array<[RegExp, string]> = [
  [/goalkeeper/i, 'GK'],
  [/centre back|center back/i, 'CB'],
  [/left back|left wing back/i, 'LB'],
  [/right back|right wing back/i, 'RB'],
  [/defensive midfield/i, 'DM'],
  [/attacking midfield/i, 'AM'],
  [/central midfield|midfielder/i, 'CM'],
  [/left (forward|wing)/i, 'LW'],
  [/right (forward|wing)/i, 'RW'],
  [/secondary striker/i, 'SS'],
  [/centre forward|center forward|striker|forward/i, 'CF'],
];

/** The pick screens show broadcast codes ("CF"), not 365's role names. */
export function tsfPositionCode(position: string | null | undefined): string | null {
  if (!position) return null;
  return POSITION_CODES.find(([pattern]) => pattern.test(position))?.[1] ?? null;
}

const ACCEPT_SCORE = 0.75;
const CERTAIN_SCORE = 0.9;

export async function seedTopScorersFivePool(leagueKey: TsfLeagueKey): Promise<{ upserted: number }> {
  const clubs = SEED_LISTS[leagueKey];
  if (!clubs) return { upserted: 0 };

  let sortOrder = 0;
  let upserted = 0;
  for (const club of clubs) {
    for (const player of club.players) {
      sortOrder += 1;
      const where = { leagueKey_nameAr: { leagueKey, nameAr: player.nameAr } };
      const existing = await prisma.topScorersFivePlayer.findUnique({ where, select: { resolveNote: true } });
      // A move resolution followed (see resolveTopScorersFivePool) outranks the list.
      const keepClub = existing?.resolveNote?.startsWith('moved_within_league') ?? false;
      await prisma.topScorersFivePlayer.upsert({
        where,
        create: {
          leagueKey,
          nameAr: player.nameAr,
          nameEn: player.nameEn,
          clubNameAr: club.clubNameAr,
          clubNameEn: club.clubNameEn,
          teamId: club.teamId,
          sortOrder,
        },
        update: {
          ...(player.nameEn ? { nameEn: player.nameEn } : {}),
          ...(keepClub ? {} : { clubNameAr: club.clubNameAr, clubNameEn: club.clubNameEn, teamId: club.teamId }),
          sortOrder,
        },
      });
      upserted += 1;
    }
  }
  return { upserted };
}

type Candidate = {
  athleteId: number;
  score: number;
  name: string;
  clubId: number | null;
  clubName: string | null;
  photo: string | null;
  position: string | null;
};

export type TsfResolveOutcome = {
  id: string;
  nameAr: string;
  status: 'resolved' | 'unresolved' | 'skipped';
  externalPlayerId: number | null;
  matchedName: string | null;
  note: string | null;
};

function bestBy(candidates: Candidate[]): { best: Candidate | null; runnerUp: Candidate | null } {
  const byAthlete = new Map<number, Candidate>();
  for (const candidate of candidates) {
    const prev = byAthlete.get(candidate.athleteId);
    if (!prev || candidate.score > prev.score) byAthlete.set(candidate.athleteId, candidate);
  }
  const ranked = [...byAthlete.values()].sort((a, b) => b.score - a.score);
  return { best: ranked[0] ?? null, runnerUp: ranked[1] ?? null };
}

function squadCandidates(
  squad: ThreeSixFiveSquadPlayer[],
  wanted: string | null,
  teamId: number,
): Candidate[] {
  if (!wanted) return [];
  return squad.map((player) => ({
    athleteId: player.athleteId,
    score: Math.max(scoreTsfNameMatch(wanted, player.name), scoreTsfNameMatch(wanted, player.shortName)),
    name: player.name,
    clubId: teamId,
    clubName: null,
    photo: player.photo,
    position: player.position,
  }));
}

/**
 * Resolve pool players that have no athleteId yet (or all of them with
 * `force`). One player failing never stops the rest.
 */
export async function resolveTopScorersFivePool(
  leagueKey: TsfLeagueKey,
  options: { force?: boolean } = {},
): Promise<TsfResolveOutcome[]> {
  const { threeSixFiveScoresService } = await import('./threeSixFiveScores.service');
  const players = await prisma.topScorersFivePlayer.findMany({
    where: { leagueKey, ...(options.force ? {} : { externalPlayerId: null }) },
    orderBy: { sortOrder: 'asc' },
  });

  const leagueClubs = new Map(
    (SEED_LISTS[leagueKey] ?? []).map((club) => [club.teamId, club] as const),
  );
  const listedClubByName = new Map(
    (SEED_LISTS[leagueKey] ?? []).flatMap((club) => club.players.map((p) => [p.nameAr, club] as const)),
  );
  const squadCache = new Map<string, ThreeSixFiveSquadPlayer[]>();
  const loadSquad = async (teamId: number, language: 'ar' | 'en') => {
    const key = `${teamId}:${language}`;
    if (!squadCache.has(key)) {
      const result = await threeSixFiveScoresService.getCompetitorSquad(teamId, language);
      squadCache.set(key, result.data?.players ?? []);
    }
    return squadCache.get(key) ?? [];
  };

  const outcomes: TsfResolveOutcome[] = [];
  for (const player of players) {
    try {
      const candidates: Candidate[] = [];
      if (player.teamId) {
        candidates.push(...squadCandidates(await loadSquad(player.teamId, 'ar'), player.nameAr, player.teamId));
        candidates.push(...squadCandidates(await loadSquad(player.teamId, 'en'), player.nameEn, player.teamId));
      }

      let { best, runnerUp } = bestBy(candidates);
      let note: string | null = null;
      let movedTo: number | null = null;
      const ambiguous = (b: Candidate | null, r: Candidate | null) =>
        !!b && !!r && b.score < 1 && r.score >= b.score - 0.01;

      if (!best || best.score < ACCEPT_SCORE || ambiguous(best, runnerUp)) {
        const searched: Candidate[] = [];
        for (const [query, language] of [[player.nameAr, 'ar'], [player.nameEn, 'en']] as const) {
          if (!query) continue;
          const result = await threeSixFiveScoresService.searchAthletes(query, language);
          for (const hit of result.data ?? []) {
            searched.push({
              athleteId: hit.athleteId,
              score: Math.max(scoreTsfNameMatch(query, hit.name), scoreTsfNameMatch(query, hit.shortName)),
              name: hit.name,
              clubId: hit.clubId,
              clubName: hit.clubName,
              photo: hit.imageUrl,
              position: null,
            });
          }
        }
        const sameClub = searched.filter((c) => player.teamId != null && c.clubId === player.teamId);
        const pickSameClub = bestBy(sameClub);
        const anyClub = bestBy(searched);
        const otherClub = anyClub.best && anyClub.best.score >= CERTAIN_SCORE && !ambiguous(anyClub.best, anyClub.runnerUp)
          ? anyClub.best
          : null;
        if (pickSameClub.best && pickSameClub.best.score >= ACCEPT_SCORE && !ambiguous(pickSameClub.best, pickSameClub.runnerUp)) {
          ({ best, runnerUp } = pickSameClub);
        } else if (otherClub && otherClub.clubId != null && leagueClubs.has(otherClub.clubId)) {
          // Moved within the league: follow the provider so his fixtures are found.
          best = otherClub;
          movedTo = otherClub.clubId;
          note = `moved_within_league: listed at ${player.clubNameEn ?? player.clubNameAr}`;
        } else if (otherClub) {
          // Same name at a club outside the league — a different person or a
          // departure. Not linked, so nobody can pick a player who cannot score.
          best = null;
          note = `not_in_league: 365Scores lists ${otherClub.name} (${otherClub.athleteId}) at ${otherClub.clubName ?? 'another club'}`;
        } else {
          const top = [...searched, ...candidates]
            .filter((c) => c.score > 0.3)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((c) => `${c.name}${c.clubName ? ` (${c.clubName})` : ''}`);
          best = null;
          note = top.length ? `ambiguous_or_not_found: ${top.join(' | ')}` : 'not_found';
        }
      }

      if (!best) {
        await prisma.topScorersFivePlayer.update({
          where: { id: player.id },
          data: { externalPlayerId: null, resolvedAt: null, resolveNote: note },
        });
        outcomes.push({ id: player.id, nameAr: player.nameAr, status: 'unresolved', externalPlayerId: null, matchedName: null, note });
        continue;
      }

      const listed = listedClubByName.get(player.nameAr);
      if (note == null && listed && player.teamId != null && player.teamId !== listed.teamId) {
        note = `moved_within_league: listed at ${listed.clubNameEn}`;
      }

      const squadTeam = movedTo ?? player.teamId;
      const englishEntry = squadTeam
        ? (await loadSquad(squadTeam, 'en').catch(() => [])).find((p) => p.athleteId === best!.athleteId)
        : undefined;
      const englishName = player.nameEn ?? englishEntry?.name ?? null;
      const positionCode = tsfPositionCode(englishEntry?.position ?? best.position);

      await prisma.topScorersFivePlayer.update({
        where: { id: player.id },
        data: {
          externalPlayerId: best.athleteId,
          nameEn: englishName ?? best.name,
          ...(movedTo != null
            ? {
                teamId: movedTo,
                clubNameAr: leagueClubs.get(movedTo)?.clubNameAr ?? player.clubNameAr,
                clubNameEn: leagueClubs.get(movedTo)?.clubNameEn ?? player.clubNameEn,
              }
            : {}),
          photoUrl: tsfPortraitUrl(best.athleteId),
          position: positionCode ?? player.position,
          resolvedAt: new Date(),
          resolveNote: note,
        },
      });
      outcomes.push({ id: player.id, nameAr: player.nameAr, status: 'resolved', externalPlayerId: best.athleteId, matchedName: best.name, note });
    } catch (error) {
      const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      const note = duplicate ? 'duplicate_athlete: another pool entry already has this athlete' : `error: ${(error as Error)?.message ?? 'unknown'}`;
      logger.warn(`[TopScorersFive] resolve failed for ${player.nameAr}: ${note}`);
      await prisma.topScorersFivePlayer
        .update({ where: { id: player.id }, data: { resolveNote: note } })
        .catch(() => undefined);
      outcomes.push({ id: player.id, nameAr: player.nameAr, status: 'unresolved', externalPlayerId: null, matchedName: null, note });
    }
  }
  return outcomes;
}
