/**
 * Enrich fixture lists with 365 community win/draw/away percentages.
 */

import { logger } from '../utils/logger';
import { redisCacheService } from './redis-cache.service';
import {
  fetchScores365GameById,
  getScores365GameIdForFixture,
  isScores365ExperimentEnabled,
  SCORES365_LEAGUE_ID_OFFSET,
} from './scores365-experiment.service';
import {
  extractScores365CrowdWinPrediction,
  type CrowdGameShape,
  type Scores365CrowdPrediction,
} from '../utils/scores365-crowd-prediction.util';

export type { Scores365CrowdPrediction } from '../utils/scores365-crowd-prediction.util';
export { extractScores365CrowdWinPrediction } from '../utils/scores365-crowd-prediction.util';

const crowdPredictionMemory = new Map<
  number,
  { prediction: Scores365CrowdPrediction; fetchedAt: number }
>();
const crowdPredictionInFlight = new Map<number, Promise<Scores365CrowdPrediction | null>>();

const CROWD_PRED_TTL_MS = Math.max(
  60_000,
  parseInt(process.env.SCORES365_CROWD_PRED_CACHE_MS || '1200000', 10) || 1_200_000,
);
const CROWD_PRED_MAX_PER_LIST = Math.max(
  8,
  parseInt(process.env.SCORES365_CROWD_PRED_MAX || '80', 10) || 80,
);
const CROWD_PRED_CONCURRENCY = 8;

function swapCrowdSides(
  prediction: Scores365CrowdPrediction | null,
  swapped: boolean,
): Scores365CrowdPrediction | null {
  if (!prediction || !swapped) return prediction;
  return {
    ...prediction,
    homePercent: prediction.awayPercent,
    awayPercent: prediction.homePercent,
  };
}

async function fetchCrowdPredictionForGameId(
  gameId: number,
  language?: string | null,
  swapped = false,
  cacheOnly = false,
): Promise<Scores365CrowdPrediction | null> {
  const mem = crowdPredictionMemory.get(gameId);
  if (mem && Date.now() - mem.fetchedAt < CROWD_PRED_TTL_MS) {
    return swapCrowdSides(mem.prediction, swapped);
  }

  // List endpoint: never wait on Redis/365 — memory hits only; background enrich fills cache.
  if (cacheOnly) {
    return null;
  }

  const pending = crowdPredictionInFlight.get(gameId);
  if (pending) {
    return swapCrowdSides(await pending, swapped);
  }

  const promise = (async () => {
    const game = await fetchScores365GameById(gameId, { language });
    const prediction = extractScores365CrowdWinPrediction(game as CrowdGameShape, {
      swapped: false,
    });
    if (prediction) {
      crowdPredictionMemory.set(gameId, { prediction, fetchedAt: Date.now() });
      void redisCacheService.set(`365:crowd-pred:${gameId}`, prediction, CROWD_PRED_TTL_MS);
    }
    return prediction;
  })().finally(() => {
    crowdPredictionInFlight.delete(gameId);
  });

  crowdPredictionInFlight.set(gameId, promise);
  return swapCrowdSides(await promise, swapped);
}

function resolveCrowdGameId(fixture: any): number | null {
  const fromField = fixture?._scores365GameId;
  if (typeof fromField === 'number' && fromField > 0) return fromField;

  const fixtureId = fixture?.fixture?.id;
  if (typeof fixtureId !== 'number' || fixtureId <= 0) return null;

  const mapped = getScores365GameIdForFixture(fixtureId);
  if (mapped) return mapped;

  // Synthetic 365 rows use gameId as fixtureId (and leagueId >= 7_000_000).
  const leagueId = fixture?.league?.id;
  if (typeof leagueId === 'number' && leagueId >= SCORES365_LEAGUE_ID_OFFSET) {
    return fixtureId;
  }
  // Common synthetic fixture id range used across 365 experiment paths.
  if (fixtureId >= 4_000_000) return fixtureId;

  return null;
}

function isUpcomingCrowdStatus(short?: string): boolean {
  const s = (short ?? '').toUpperCase();
  return s === 'NS' || s === 'TBD' || s === 'PST' || s === '' || s === 'NSY';
}

/** Attach 365 community win/draw/away % onto upcoming fixtures (cached, capped). */
export async function enrichFixturesWithCrowdPredictions(
  fixtures: any[],
  language?: string | null,
  options?: { cacheOnly?: boolean },
): Promise<any[]> {
  if (!isScores365ExperimentEnabled() || !Array.isArray(fixtures) || fixtures.length === 0) {
    return fixtures;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const targets = fixtures
    .map((f, index) => ({ f, index, gameId: resolveCrowdGameId(f) }))
    .filter(
      (row) =>
        row.gameId != null &&
        !(row.f as { _crowdPrediction?: unknown })?._crowdPrediction &&
        isUpcomingCrowdStatus(row.f?.fixture?.status?.short),
    )
    // Prefer kickoffs closest to now so evening Predictions-tab matches aren't starved.
    .sort((a, b) => {
      const da = Math.abs((a.f?.fixture?.timestamp ?? 0) - nowSec);
      const db = Math.abs((b.f?.fixture?.timestamp ?? 0) - nowSec);
      return da - db;
    })
    .slice(0, CROWD_PRED_MAX_PER_LIST);

  if (targets.length === 0) {
    logger.debug(
      `[CrowdPred] no enrich targets (fixtures=${fixtures.length}) — missing gameIds or all have crowd already`,
    );
    return fixtures;
  }

  logger.info(`[CrowdPred] enriching ${targets.length}/${fixtures.length} upcoming fixtures`);

  const out = fixtures.slice();
  let attached = 0;
  for (let i = 0; i < targets.length; i += CROWD_PRED_CONCURRENCY) {
    const batch = targets.slice(i, i + CROWD_PRED_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ f, index, gameId }) => {
        const swapped = Boolean((f as { _scores365TeamsSwapped?: boolean })?._scores365TeamsSwapped);
        const prediction = await fetchCrowdPredictionForGameId(
          gameId!,
          language,
          swapped,
          options?.cacheOnly === true,
        );
        if (!prediction) return;
        attached += 1;
        // Expose both underscore + plain key so clients can't miss it.
        out[index] = {
          ...out[index],
          _crowdPrediction: prediction,
          crowdPrediction: prediction,
        };
      }),
    );
  }

  logger.info(`[CrowdPred] attached ${attached}/${targets.length} crowd strips`);
  return out;
}
