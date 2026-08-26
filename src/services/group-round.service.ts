/**
 * Daily prediction-group round — up to 10 Big 5 league matches per day.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { calendarTodayKey } from '../utils/calendar-day-bounds.util';
import { footballDataCacheService } from './football-data-cache.service';
import { pickTopFixtures } from '../utils/fixture-importance';

const ROUND_MATCH_LIMIT = 10;

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((id, i) => id === right[i]);
}

export function formatFixtureForClient(fixture: any) {
  const home = fixture?.teams?.home;
  const away = fixture?.teams?.away;
  const fixtureMeta = fixture?.fixture ?? {};
  const crowd =
    fixture?.crowdPrediction ??
    fixture?._crowdPrediction ??
    null;
  return {
    apiMatchId: fixtureMeta.id,
    home: {
      name: home?.name ?? 'Home',
      logo: home?.logo ?? null,
      short: home?.name?.slice(0, 3)?.toUpperCase() ?? 'HOM',
    },
    away: {
      name: away?.name ?? 'Away',
      logo: away?.logo ?? null,
      short: away?.name?.slice(0, 3)?.toUpperCase() ?? 'AWY',
    },
    day: fixtureMeta.date ? String(fixtureMeta.date).slice(0, 10) : calendarTodayKey(),
    time: fixtureMeta.date ? String(fixtureMeta.date).slice(11, 16) : '',
    status: fixtureMeta.status?.short ?? 'NS',
    leagueName: fixture?.league?.name ?? null,
    result:
      fixtureMeta.status?.short === 'FT' ||
      fixtureMeta.status?.short === 'AET' ||
      fixtureMeta.status?.short === 'PEN'
        ? {
            home: fixture?.goals?.home ?? 0,
            away: fixture?.goals?.away ?? 0,
          }
        : undefined,
    crowdPrediction:
      crowd &&
      typeof crowd.homePercent === 'number' &&
      typeof crowd.drawPercent === 'number' &&
      typeof crowd.awayPercent === 'number'
        ? {
            homePercent: crowd.homePercent,
            drawPercent: crowd.drawPercent,
            awayPercent: crowd.awayPercent,
            totalVotes: typeof crowd.totalVotes === 'number' ? crowd.totalVotes : 0,
          }
        : null,
  };
}

export async function ensureDailyRound(dateString = calendarTodayKey()) {
  const existing = await prisma.groupRound.findUnique({ where: { date: dateString } });
  const { TEMP_FREEZE_GROUP_PREDICTION_MATCHES } = await import(
    '../config/temp-surface-freeze.config'
  );

  if (TEMP_FREEZE_GROUP_PREDICTION_MATCHES) {
    if (existing) return existing;
    logger.warn(`[GroupRound] TEMP freeze — creating empty round for ${dateString}`);
    return prisma.groupRound.create({
      data: {
        date: dateString,
        matchIds: [],
        status: 'OPEN',
      },
    });
  }

  const fixtures = await footballDataCacheService.getMatchesByDate(dateString);
  const top = pickTopFixtures(fixtures, ROUND_MATCH_LIMIT);
  const matchIds = top
    .map((f) => f?.fixture?.id)
    .filter((id): id is number => typeof id === 'number');

  if (matchIds.length === 0) {
    logger.warn(
      `[GroupRound] No upcoming fixtures for ${dateString} (pool=${fixtures.length})`,
    );
  } else {
    logger.info(
      `[GroupRound] Picked ${matchIds.length}/${ROUND_MATCH_LIMIT} top matches for ${dateString} from ${fixtures.length} fixtures`,
    );
  }

  // Refresh OPEN rounds when empty, wrong size, or picker set changed (better importance).
  if (existing) {
    const currentIds = Array.isArray(existing.matchIds)
      ? (existing.matchIds as unknown[]).filter((id): id is number => typeof id === 'number')
      : [];
    const shouldRefresh =
      existing.status === 'OPEN' &&
      matchIds.length > 0 &&
      (currentIds.length === 0 || !sameIdSet(currentIds, matchIds));
    if (shouldRefresh) {
      logger.info(
        `[GroupRound] Updating round ${dateString}: ${currentIds.length} → ${matchIds.length} matches`,
      );
      return prisma.groupRound.update({
        where: { id: existing.id },
        data: { matchIds },
      });
    }
    return existing;
  }

  return prisma.groupRound.create({
    data: {
      date: dateString,
      matchIds,
      status: 'OPEN',
    },
  });
}

export async function getCurrentRoundWithMatches(dateString = calendarTodayKey()) {
  const { TEMP_FREEZE_GROUP_PREDICTION_MATCHES } = await import(
    '../config/temp-surface-freeze.config'
  );
  const round = await ensureDailyRound(dateString);
  // Round number is the count of daily rounds up to this date.
  // This keeps "الجولة 1/2/3..." consistent across clients and days.
  const roundNumber = await prisma.groupRound.count({
    where: { date: { lte: dateString } },
  });

  if (TEMP_FREEZE_GROUP_PREDICTION_MATCHES) {
    logger.warn(`[GroupRound] TEMP freeze — serving 0 matches for ${dateString}`);
    return { round: { ...round, roundNumber }, matches: [] as any[] };
  }

  const matchIds = (round.matchIds as number[]) ?? [];
  const fixtures = await footballDataCacheService.getMatchesByDate(dateString);
  const byId = new Map(fixtures.map((f: any) => [f?.fixture?.id, f]));

  const raw = matchIds.map((id) => byId.get(id)).filter(Boolean);
  // Round is only ~ROUND_MATCH_LIMIT matches — enrich them explicitly so group cards
  // always get crowd % even if the big calendar list skipped these kickoffs.
  let enriched = raw;
  try {
    const { enrichFixturesWithCrowdPredictions } = await import(
      './scores365-crowd-prediction.service'
    );
    enriched = await enrichFixturesWithCrowdPredictions(raw);
  } catch (err) {
    logger.warn('[GroupRound] crowd enrich failed:', err);
  }

  const matches = enriched.map(formatFixtureForClient);

  return { round: { ...round, number: roundNumber }, matches };
}

export function isMatchLocked(status: string): boolean {
  return !['NS', 'TBD', ''].includes(status);
}
