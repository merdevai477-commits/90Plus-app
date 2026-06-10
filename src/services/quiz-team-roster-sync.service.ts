/**
 * Sync TeamInfo + TeamPlayer squads from API-Football.
 * Used by dataRefreshWorker (monthly) and the quiz roster seed script.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { footballService } from './football.service';

const ROSTER_TTL_MS = 30 * 24 * 60 * 60_000;

function currentSeason(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? year : year - 1;
}

/** Upsert TeamInfo + squad snapshot; back-link matching PlayerInfo rows. */
export async function syncTeamRoster(apiTeamId: number, teamName: string): Promise<number | null> {
  try {
    const expiresAt = new Date(Date.now() + ROSTER_TTL_MS);
    const teamInfo = await prisma.teamInfo.upsert({
      where: { apiTeamId },
      create: {
        apiTeamId,
        teamName,
        season: currentSeason(),
        lastFetched: new Date(),
        expiresAt,
      },
      update: {
        teamName,
        season: currentSeason(),
        lastFetched: new Date(),
        expiresAt,
      },
    });

    const squadRows = await footballService.getTeamSquad(apiTeamId);
    const squad = squadRows?.[0]?.players ?? [];
    if (!Array.isArray(squad) || squad.length === 0) return teamInfo.id;

    await prisma.$transaction([
      prisma.teamPlayer.deleteMany({ where: { teamInfoId: teamInfo.id } }),
      prisma.teamPlayer.createMany({
        data: squad
          .filter((p: { id?: number; name?: string }) => p?.id && p?.name)
          .map((p: { id: number; name: string; position?: string; number?: number }) => ({
            teamInfoId: teamInfo.id,
            apiPlayerId: p.id,
            playerName: p.name,
            position: p.position ?? 'Unknown',
            jerseyNumber: typeof p.number === 'number' ? p.number : null,
          })),
      }),
    ]);

    const squadIds = squad
      .map((p: { id?: number }) => p?.id)
      .filter((id): id is number => Number.isInteger(id));
    if (squadIds.length > 0) {
      await prisma.playerInfo.updateMany({
        where: { apiPlayerId: { in: squadIds } },
        data: { teamId: teamInfo.id },
      });
    }

    return teamInfo.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[QuizRosterSync] roster sync failed for team ${apiTeamId} — ${msg.slice(0, 120)}`);
    return null;
  }
}

/** Seed quiz rosters from top CachedTeam entries (logo present). */
export async function syncQuizRostersFromCachedTeams(teamLimit = 25): Promise<{ synced: number; total: number }> {
  const teams = await prisma.cachedTeam.findMany({
    where: { logo: { not: null } },
    orderBy: { teamId: 'asc' },
    take: teamLimit,
    select: { teamId: true, name: true },
  });

  logger.info(`[QuizRosterSync] syncing ${teams.length} cached team(s)...`);

  let synced = 0;
  for (const team of teams) {
    const id = await syncTeamRoster(team.teamId, team.name);
    if (id) synced += 1;
  }

  logger.info(`[QuizRosterSync] done — ${synced}/${teams.length} team(s)`);
  return { synced, total: teams.length };
}
