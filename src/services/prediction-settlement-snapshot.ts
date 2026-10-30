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

type CacheRow = {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  fullData: unknown;
};

export function fromCacheRow(row: CacheRow): SettlementFixtureInput {
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

const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN']);

const isScore = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * True when the snapshot already carries everything settlement needs, so a
 * provider round-trip cannot change the outcome. PEN without a decisive
 * shootout tally is incomplete (A10).
 */
export function isCompleteFinalSnapshot(snap: SettlementFixtureInput): boolean {
  if (!isScore(snap.homeScore) || !isScore(snap.awayScore)) return false;
  const hasPens = isScore(snap.penaltyHome) && isScore(snap.penaltyAway);
  if (snap.status === 'FT' || snap.status === 'AET') return !hasPens;
  if (snap.status === 'PEN') return hasPens && snap.penaltyHome !== snap.penaltyAway;
  return false;
}

function mapped365GameId(apiMatchId: number, fullData: unknown): number | null {
  if (isNative365FixtureId(apiMatchId)) return apiMatchId;
  const raw = (fullData as { _scores365GameId?: unknown } | null)?._scores365GameId;
  const id = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function from365(
  apiMatchId: number,
  gameId: number,
): Promise<SettlementFixtureInput | null> {
  try {
    const { fetchScores365GameById, settlementSnapshotFrom365Game } = await import(
      './scores365-experiment.service'
    );
    const game = await fetchScores365GameById(gameId, { language: 'en' });
    if (!game) return null;
    return await settlementSnapshotFrom365Game(game, apiMatchId);
  } catch (err: any) {
    logger.debug(`[SettleSnapshot] 365 fetch failed for ${apiMatchId}:`, err?.message);
    return null;
  }
}

/**
 * Load the fixture used for settlement:
 * 1. API-Football (non-365 ids) when it returns a complete final.
 * 2. cached_fixtures when complete.
 * 3. 365 via the shared classifier + team alignment (native id, or the
 *    `_scores365GameId` mapping) — never by passing an API-Football id to 365.
 * 4. Whatever incomplete snapshot we have (the gate keeps it pending).
 */
export async function loadAuthoritativeSettlementFixture(
  apiMatchId: number,
): Promise<SettlementFixtureInput | null> {
  let fallback: SettlementFixtureInput | null = null;

  if (!isNative365FixtureId(apiMatchId)) {
    try {
      const data = await footballService.fetchFromApi<any[]>(
        '/fixtures',
        { id: apiMatchId },
        { source: 'job' },
      );
      if (data?.length) {
        const snap = snapshotFromApiFootballFixture(data[0]);
        if (isCompleteFinalSnapshot(snap)) return snap;
        fallback = snap;
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
    const snap = fromCacheRow(cached);
    if (isCompleteFinalSnapshot(snap)) return snap;
    fallback = fallback ?? snap;
  }

  const gameId = mapped365GameId(apiMatchId, cached?.fullData ?? null);
  if (gameId != null) {
    const snap = await from365(apiMatchId, gameId);
    if (snap) {
      if (isCompleteFinalSnapshot(snap) || !fallback) return snap;
      // A stale non-final cache row (e.g. NS) loses to 365's current status.
      if (!FINAL_STATUSES.has(String(fallback.status))) return snap;
    }
  }

  return fallback;
}
