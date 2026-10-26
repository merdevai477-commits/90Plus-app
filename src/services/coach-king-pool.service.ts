/**
 * King of Coaches pool — every outfield line from the big-five clubs already
 * used by Top Scorers Five, plus one head coach per club.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { TOP_SCORERS_FIVE_BUNDESLIGA } from '../data/top-scorers-five-bundesliga';
import { TOP_SCORERS_FIVE_LALIGA } from '../data/top-scorers-five-laliga';
import { TOP_SCORERS_FIVE_LIGUE1 } from '../data/top-scorers-five-ligue1';
import { TOP_SCORERS_FIVE_PL } from '../data/top-scorers-five-pl';
import { TOP_SCORERS_FIVE_SERIEA } from '../data/top-scorers-five-seriea';
import type { TopScorersFiveSeedClub } from '../data/top-scorers-five-laliga';
import { coachKingPriceMilli, type CkLine } from './coach-king-scoring';
import { threeSixFiveScoresService, type SquadPositionGroup, type ThreeSixFiveSquadPlayer } from './threeSixFiveScores.service';
import { TSF_EUROPE_LEAGUE_KEYS, TSF_LEAGUES, tsfPortraitUrl } from './top-scorers-five-scoring';
import { tsfPositionCode } from './top-scorers-five-pool.service';

type Club = { leagueKey: string; teamId: number; clubNameAr: string; clubNameEn: string };

const SEEDS: Array<[string, TopScorersFiveSeedClub[]]> = [
  ['laliga', TOP_SCORERS_FIVE_LALIGA],
  ['seriea', TOP_SCORERS_FIVE_SERIEA],
  ['bundesliga', TOP_SCORERS_FIVE_BUNDESLIGA],
  ['pl', TOP_SCORERS_FIVE_PL],
  ['ligue1', TOP_SCORERS_FIVE_LIGUE1],
];

function norm(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '');
}

function europeClubs(): { clubs: Club[]; stars: Set<string> } {
  const clubs = new Map<number, Club>();
  const stars = new Set<string>();
  for (const [leagueKey, list] of SEEDS) {
    for (const club of list) {
      if (!clubs.has(club.teamId)) {
        clubs.set(club.teamId, {
          leagueKey,
          teamId: club.teamId,
          clubNameAr: club.clubNameAr,
          clubNameEn: club.clubNameEn,
        });
      }
      for (const player of club.players) {
        const ar = norm(player.nameAr);
        const en = norm(player.nameEn);
        if (ar) stars.add(ar);
        if (en) stars.add(en);
      }
    }
  }
  return { clubs: [...clubs.values()], stars };
}

function lineOf(group: SquadPositionGroup): CkLine | null {
  if (group === 'goalkeeper') return 'GK';
  if (group === 'defender') return 'DEF';
  if (group === 'midfielder') return 'MID';
  if (group === 'forward') return 'FWD';
  return null;
}

function isStar(player: ThreeSixFiveSquadPlayer, stars: Set<string>): boolean {
  return stars.has(norm(player.name)) || stars.has(norm(player.shortName));
}

let poolSync: Promise<{ players: number; coaches: number }> | null = null;
let lastCoachAttempt = 0;

export async function ensureCoachKingPool(): Promise<void> {
  const players = await prisma.coachKingPlayer.count();
  const coaches = players > 0 ? await prisma.coachKingCoach.count() : 0;
  if (players > 0 && coaches > 0) return;
  if (players > 0 && Date.now() - lastCoachAttempt < 60 * 60_000) return;
  lastCoachAttempt = Date.now();
  if (!poolSync) {
    poolSync = syncCoachKingPool().finally(() => {
      poolSync = null;
    });
  }
  await poolSync;
}

export async function syncCoachKingPool(): Promise<{ players: number; coaches: number }> {
  const { clubs, stars } = europeClubs();
  const clubByTeam = new Map(clubs.map((club) => [club.teamId, club]));
  let players = 0;

  for (const club of clubs) {
    try {
      const [ar, en] = await Promise.all([
        threeSixFiveScoresService.getCompetitorSquad(club.teamId, 'ar'),
        threeSixFiveScoresService.getCompetitorSquad(club.teamId, 'en'),
      ]);
      const english = new Map((en.data?.players ?? []).map((player) => [player.athleteId, player]));
      for (const player of ar.data?.players ?? en.data?.players ?? []) {
        const twin = english.get(player.athleteId);
        const line = lineOf(player.positionGroup !== 'other' ? player.positionGroup : twin?.positionGroup ?? 'other');
        if (!line) continue;
        const star = isStar(player, stars) || (twin ? isStar(twin, stars) : false);
        const position = tsfPositionCode(twin?.position ?? player.position)
          ?? (line === 'GK' ? 'GK' : line === 'DEF' ? 'CB' : line === 'MID' ? 'CM' : 'ST');
        await prisma.coachKingPlayer.upsert({
          where: { externalPlayerId: player.athleteId },
          create: {
            leagueKey: club.leagueKey,
            teamId: club.teamId,
            clubNameAr: club.clubNameAr,
            clubNameEn: club.clubNameEn,
            externalPlayerId: player.athleteId,
            nameAr: player.name || twin?.name || '—',
            nameEn: twin?.name ?? null,
            photoUrl: player.photo || twin?.photo || tsfPortraitUrl(player.athleteId),
            position,
            line,
            shirtNumber: player.jerseyNumber ?? twin?.jerseyNumber ?? null,
            priceMilli: coachKingPriceMilli(line, player.athleteId, star),
          },
          update: {
            leagueKey: club.leagueKey,
            teamId: club.teamId,
            clubNameAr: club.clubNameAr,
            clubNameEn: club.clubNameEn,
            nameAr: player.name || twin?.name || '—',
            nameEn: twin?.name ?? null,
            photoUrl: player.photo || twin?.photo || tsfPortraitUrl(player.athleteId),
            position,
            line,
            shirtNumber: player.jerseyNumber ?? twin?.jerseyNumber ?? null,
            priceMilli: coachKingPriceMilli(line, player.athleteId, star),
            active: true,
          },
        });
        players += 1;
      }
    } catch (error) {
      logger.warn(`[CoachKing] squad ${club.teamId} skipped: ${(error as Error)?.message}`);
    }
  }

  let coaches = 0;
  for (const key of TSF_EUROPE_LEAGUE_KEYS) {
    const cfg = TSF_LEAGUES[key];
    if (!cfg) continue;
    try {
      const [ar, en] = await Promise.all([
        threeSixFiveScoresService.extractCompetitionCoaches(cfg.scores365CompetitionId, 'ar'),
        threeSixFiveScoresService.extractCompetitionCoaches(cfg.scores365CompetitionId, 'en'),
      ]);
      const english = new Map((en.data ?? []).map((coach) => [coach.athleteId, coach]));
      const seenTeams = new Set<number>();
      const ordered = [...(ar.data ?? [])].sort((a, b) => Number(a.role !== 'head_coach') - Number(b.role !== 'head_coach'));
      for (const coach of ordered) {
        const club = clubByTeam.get(coach.teamId);
        if (!club || seenTeams.has(coach.teamId) || coach.role !== 'head_coach') continue;
        seenTeams.add(coach.teamId);
        const twin = english.get(coach.athleteId);
        await prisma.coachKingCoach.updateMany({
          where: { teamId: coach.teamId, externalCoachId: { not: coach.athleteId } },
          data: { active: false },
        });
        await prisma.coachKingCoach.upsert({
          where: { externalCoachId: coach.athleteId },
          create: {
            leagueKey: club.leagueKey,
            teamId: club.teamId,
            clubNameAr: club.clubNameAr,
            clubNameEn: club.clubNameEn,
            externalCoachId: coach.athleteId,
            nameAr: coach.name || twin?.name || '—',
            nameEn: twin?.name ?? coach.name,
            photoUrl: coach.imageUrl || twin?.imageUrl || null,
            priceMilli: coachKingPriceMilli('COACH', coach.athleteId, false),
          },
          update: {
            leagueKey: club.leagueKey,
            teamId: club.teamId,
            clubNameAr: club.clubNameAr,
            clubNameEn: club.clubNameEn,
            nameAr: coach.name || twin?.name || '—',
            nameEn: twin?.name ?? coach.name,
            photoUrl: coach.imageUrl || twin?.imageUrl || null,
            priceMilli: coachKingPriceMilli('COACH', coach.athleteId, false),
            active: true,
          },
        });
        coaches += 1;
      }
    } catch (error) {
      logger.warn(`[CoachKing] coaches for ${key} skipped: ${(error as Error)?.message}`);
    }
  }

  logger.info(`[CoachKing] pool sync players=${players} coaches=${coaches}`);
  return { players, coaches };
}
