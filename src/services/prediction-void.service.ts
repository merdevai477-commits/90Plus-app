/**
 * VOID for matches that will never produce a result (E11 / Q2).
 * Off unless PREDICTION_VOID_ENABLED=true; while off, candidates are only
 * logged (VOID_CANDIDATE) as a dry run. No refunds — the row just leaves the
 * pending set. Called under the per-match settle lease.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export const VOID_STATUSES = new Set(['CANC', 'ABD', 'PST', 'AWD', 'WO']);
export const VOID_AFTER_MS = 48 * 60 * 60 * 1000;

const loggedCandidates = new Set<number>();

export function isVoidEnabled(): boolean {
  return process.env.PREDICTION_VOID_ENABLED === 'true';
}

async function resolveKickoff(apiMatchId: number): Promise<Date | null> {
  const cached = await prisma.cachedFixture.findUnique({
    where: { fixtureId: apiMatchId },
    select: { matchDate: true },
  });
  if (cached?.matchDate) return cached.matchDate;
  const earliest = await prisma.prediction.findFirst({
    where: { apiMatchId, matchDate: { not: null } },
    orderBy: { matchDate: 'asc' },
    select: { matchDate: true },
  });
  return earliest?.matchDate ?? null;
}

/** Returns the number of rows voided (0 when not eligible or flag off). */
export async function maybeVoidMatchPredictions(
  apiMatchId: number,
  status: string | null | undefined,
  source: string,
  now: Date = new Date(),
): Promise<number> {
  if (!status || !VOID_STATUSES.has(status)) return 0;
  const kickoff = await resolveKickoff(apiMatchId);
  // A postponed match that was rescheduled carries its new (future) kickoff.
  if (!kickoff || now.getTime() - kickoff.getTime() < VOID_AFTER_MS) return 0;

  const where = { apiMatchId, isCorrect: null, voidedAt: null };
  if (!isVoidEnabled()) {
    if (!loggedCandidates.has(apiMatchId)) {
      loggedCandidates.add(apiMatchId);
      const pending = await prisma.prediction.count({ where });
      if (pending > 0) {
        logger.info(
          JSON.stringify({
            event: 'VOID_CANDIDATE',
            apiMatchId,
            status,
            pending,
            kickoff: kickoff.toISOString(),
          }),
        );
      }
    }
    return 0;
  }

  const result = await prisma.prediction.updateMany({
    where,
    data: { voidedAt: now, voidReason: status },
  });
  if (result.count > 0) {
    logger.info(
      JSON.stringify({ event: 'PREDICTION_VOIDED', apiMatchId, status, count: result.count, source }),
    );
  }
  return result.count;
}

export function __resetVoidLogForTests(): void {
  loggedCandidates.clear();
}
