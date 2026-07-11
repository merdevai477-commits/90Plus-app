/**
 * Enrich fixture lists with 365 community win/draw/away percentages.
 */

import { redisCacheService } from './redis-cache.service';
import {
  fetchScores365GameById,
  getScores365GameIdForFixture,
  isScores365ExperimentEnabled,
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
  parseInt(process.env.SCORES365_CROWD_PRED_MAX || '36', 10) || 36,
);
const CROWD_PRED_CONCURRENCY = 6;

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
): Promise<Scores365CrowdPrediction | null> {
  const mem = crowdPredictionMemory.get(gameId);
  if (mem && Date.now() - mem.fetchedAt < CROWD_PRED_TTL_MS) {
    return swapCrowdSides(mem.prediction, swapped);
  }

  try {
    const redisHit = await redisCacheService.get<Scores365CrowdPrediction>(
      `365:crowd-pred:${gameId}`,
    );
    if (redisHit && typeof redisHit.homePercent === 'number') {
      crowdPredictionMemory.set(gameId, { prediction: redisHit, fetchedAt: Date.now() });
      return swapCrowdSides(redisHit, swapped);
    }
  } catch {
    /* non-fatal */
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
  return getScores365GameIdForFixture(fixtureId);
}

function isUpcomingCrowdStatus(short?: string): boolean {
  const s = (short ?? '').toUpperCase();
  return s === 'NS' || s === 'TBD' || s === 'PST' || s === '';
}

/** Attach 365 community win/draw/away % onto upcoming fixtures (cached, capped). */
export async function enrichFixturesWithCrowdPredictions(
  fixtures: any[],
  language?: string | null,
): Promise<any[]> {
  if (!isScores365ExperimentEnabled() || !Array.isArray(fixtures) || fixtures.length === 0) {
    return fixtures;
  }

  const targets = fixtures
    .map((f, index) => ({ f, index, gameId: resolveCrowdGameId(f) }))
    .filter(
      (row) =>
        row.gameId != null &&
        !(row.f as { _crowdPrediction?: unknown })?._crowdPrediction &&
        isUpcomingCrowdStatus(row.f?.fixture?.status?.short),
    )
    .sort((a, b) => (a.f?.fixture?.timestamp ?? 0) - (b.f?.fixture?.timestamp ?? 0))
    .slice(0, CROWD_PRED_MAX_PER_LIST);

  if (targets.length === 0) return fixtures;

  const out = fixtures.slice();
  for (let i = 0; i < targets.length; i += CROWD_PRED_CONCURRENCY) {
    const batch = targets.slice(i, i + CROWD_PRED_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ f, index, gameId }) => {
        const swapped = Boolean((f as { _scores365TeamsSwapped?: boolean })?._scores365TeamsSwapped);
        const prediction = await fetchCrowdPredictionForGameId(gameId!, language, swapped);
        if (!prediction) return;
        out[index] = { ...out[index], _crowdPrediction: prediction };
      }),
    );
  }
  return out;
}
