/**
 * Authoritative fixture snapshot for prediction settlement.
 * Re-read inside the settle lock — never trust caller-provided scores.
 */

import prisma from '../lib/prisma';
import { footballService } from './football.service';
import { isNative365FixtureId } from '../utils/native-365-fixture-id';
import {
  extractPenaltyFromFullData,
  snapshotFromApiFootballFixture,
  type SettlementFixtureInput,
} from './prediction-settlement-gate';
import { logger } from '../utils/logger';

function fromCacheRow(row: {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  fullData: unknown;
}): SettlementFixtureInput {
  const fullData = row.fullData as {
    goals?: { home?: number | null; away?: number | null };
    score?: { penalty?: { home?: number | null; away?: number | null } };
  } | null;
  const pen = extractPenaltyFromFullData(fullData);
  const home =
    row.homeScore != null
      ? row.homeScore
      : fullData?.goals?.home != null
        ? fullData.goals.home
        : null;
  const away =
    row.awayScore != null
      ? row.awayScore
      : fullData?.goals?.away != null
        ? fullData.goals.away
        : null;
  return {
    status: row.status,
    homeScore: home,
    awayScore: away,
    penaltyHome: pen.home ?? fullData?.score?.penalty?.home ?? null,
    penaltyAway: pen.away ?? fullData?.score?.penalty?.away ?? null,
  };
}

async function from365Game(matchId: number): Promise<SettlementFixtureInput | null> {
  try {
    const { fetchScores365GameById } = await import('./scores365-experiment.service');
    const game = await fetchScores365GameById(matchId, { language: 'en' });
    if (!game) return null;

    const statusGroup = game.statusGroup;
    // Do not map unfinished / unknown groups to FT.
    let status: string | null = null;
    if (statusGroup === 4) {
      status = 'FT';
      const st = String(
        (game as { shortStatusText?: string }).shortStatusText ?? game.statusText ?? '',
      ).toUpperCase();
      if (st.includes('PEN') || st === 'P' || /\bP\b/.test(st)) status = 'PEN';
      else if (st.includes('AET') || st.includes('ET')) status = 'AET';
    } else if (statusGroup === 3) {
      status = 'LIVE';
    } else {
      status = 'NS';
    }

    const homeRaw = game.homeCompetitor?.score;
    const awayRaw = game.awayCompetitor?.score;
    // Preserve -1 so the gate rejects SCORE_INVALID (365 upstream lag).
    const homeScore = typeof homeRaw === 'number' ? homeRaw : null;
    const awayScore = typeof awayRaw === 'number' ? awayRaw : null;

    const penHome = game.homeCompetitor?.penaltyScore;
    const penAway = game.awayCompetitor?.penaltyScore;

    return {
      status,
      homeScore,
      awayScore,
      penaltyHome: typeof penHome === 'number' ? penHome : null,
      penaltyAway: typeof penAway === 'number' ? penAway : null,
    };
  } catch (err: any) {
    logger.debug(`[SettleSnapshot] 365 fetch failed for ${matchId}:`, err?.message);
    return null;
  }
}

/**
 * Load the fixture used for settlement. Prefer live API-Football for
 * non-365 ids; fall back to cached_fixtures then 365.
 */
export async function loadAuthoritativeSettlementFixture(
  apiMatchId: number,
): Promise<SettlementFixtureInput | null> {
  if (!isNative365FixtureId(apiMatchId)) {
    try {
      const data = await footballService.fetchFromApi<any[]>(
        '/fixtures',
        { id: apiMatchId },
        { source: 'job' },
      );
      if (data?.length) {
        return snapshotFromApiFootballFixture(data[0]);
      }
    } catch {
      // fall through
    }
  }

  const cached = await prisma.cachedFixture.findUnique({
    where: { fixtureId: apiMatchId },
    select: { status: true, homeScore: true, awayScore: true, fullData: true },
  });
  if (cached?.status) {
    return fromCacheRow(cached);
  }

  return from365Game(apiMatchId);
}
