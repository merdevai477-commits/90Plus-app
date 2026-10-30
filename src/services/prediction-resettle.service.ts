/**
 * Admin re-settle of a match whose rows are already settled (A7).
 *
 * Same lease, snapshot loader and gate as a normal settle. Only rows stored
 * wrong that the gate now judges correct are changed and credited (Q3); rows
 * stored correct that are now wrong are recorded in the audit and left alone.
 * A dry run writes nothing at all, not even an audit row.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { clearResponseCache } from '../middleware/responseCache.middleware';
import { NotificationService } from './notification.service';
import { acquireSettleLock, startLeaseHeartbeat } from './prediction-settle-lock';
import {
  classifyStoredVerdict,
  resolveSettlementInput,
  type SettlementOk,
  type StoredVerdictBucket,
} from './prediction-settlement-gate';
import { loadAuthoritativeSettlementFixture } from './prediction-settlement-snapshot';
import {
  CORRECT_PREDICTION_REWARD,
  predictionXpAction,
  type ScoredPrediction,
} from './prediction-resolver.service';
import { isSchemaOk } from './schema-guard.service';
import { levelFromXp, XP_VALUES } from './xp.service';

export type ResettleBucket = StoredVerdictBucket;

export type SettledRow = ScoredPrediction & {
  isCorrect: boolean;
  settledHomeScore: number | null;
  settledAwayScore: number | null;
  settledStatus: string | null;
  settledWinner: string | null;
};

export type ResettleItem = {
  predictionId: string;
  userId: string;
  bucket: Exclude<ResettleBucket, 'unchanged'>;
  stored: boolean;
  computed: boolean;
  applied: boolean;
  coins: number;
  xp: number;
};

export type ResettleCounts = Record<ResettleBucket, number>;

export type ResettleResult =
  | {
      ok: true;
      dryRun: boolean;
      runId: string | null;
      apiMatchId: number;
      snapshot: SettlementOk;
      counts: ResettleCounts;
      credited: { coins: number; xp: number };
      aborted: 'SETTLE_LOCK_LOST' | null;
      items: ResettleItem[];
    }
  | {
      ok: false;
      apiMatchId: number;
      reason: 'SCHEMA_MISMATCH' | 'SETTLE_SKIPPED_LOCKED' | 'SETTLE_SKIPPED_NO_LOCK' | 'NO_FIXTURE' | 'GATE_REJECTED';
      detail?: string;
    };

export const resettleCoinKey = (predictionId: string) => `prediction:${predictionId}:resettle:coins`;
export const resettleXpKey = (predictionId: string) => `prediction:${predictionId}:resettle`;

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Flip one wrong row to correct and credit it once, whichever key paid it before. */
async function applyWrongToCorrect(
  tx: Tx,
  row: SettledRow,
  settled: SettlementOk,
  runId: string,
  apiMatchId: number,
  now: Date,
): Promise<{ applied: boolean; coins: number; xp: number }> {
  const flipped = await tx.prediction.updateMany({
    where: { id: row.id, isCorrect: false, voidedAt: null },
    data: {
      isCorrect: true,
      coinsWon: CORRECT_PREDICTION_REWARD,
      settledHomeScore: settled.homeScore,
      settledAwayScore: settled.awayScore,
      settledStatus: settled.status,
      settledWinner: settled.winner,
      settledAt: now,
      resettledAt: now,
      resettleRunId: runId,
    },
  });
  if (flipped.count === 0) return { applied: false, coins: 0, xp: 0 };

  let coins = 0;
  const coinKeys = [`prediction:${row.id}:coins`, resettleCoinKey(row.id)];
  const paid = await tx.coinTransaction.findFirst({
    where: { idempotencyKey: { in: coinKeys } },
    select: { id: true },
  });
  if (!paid) {
    await tx.user.update({
      where: { id: row.userId },
      data: { coins: { increment: CORRECT_PREDICTION_REWARD } },
    });
    await tx.coinTransaction.create({
      data: {
        userId: row.userId,
        amount: CORRECT_PREDICTION_REWARD,
        type: 'PREDICTION' as any,
        description: `Prediction re-settle reward — match ${apiMatchId}`,
        idempotencyKey: resettleCoinKey(row.id),
      },
    });
    coins = CORRECT_PREDICTION_REWARD;
  }

  let xp = 0;
  const xpAction = predictionXpAction(row);
  const xpKeys = [`prediction:${row.id}`, resettleXpKey(row.id)];
  const awarded = await tx.xpTransaction.findFirst({
    where: { userId: row.userId, idempotencyKey: { in: xpKeys } },
    select: { id: true },
  });
  if (!awarded) {
    const points = XP_VALUES[xpAction];
    const user = await tx.user.findUniqueOrThrow({ where: { id: row.userId }, select: { xp: true } });
    const newXp = user.xp + points;
    await tx.xpTransaction.create({
      data: {
        userId: row.userId,
        action: xpAction as any,
        amount: points,
        idempotencyKey: resettleXpKey(row.id),
        metadata: { predictionId: row.id, apiMatchId, runId, resettle: true },
      },
    });
    await tx.user.update({ where: { id: row.userId }, data: { xp: newXp, level: levelFromXp(newXp) } });
    xp = points;
  }
  return { applied: true, coins, xp };
}

export async function resettleMatchPredictions(
  apiMatchId: number,
  opts: { dryRun: boolean; adminUserId?: string | null },
): Promise<ResettleResult> {
  if (!isSchemaOk()) return { ok: false, apiMatchId, reason: 'SCHEMA_MISMATCH' };

  const lock = await acquireSettleLock(apiMatchId);
  if (!lock.ok) return { ok: false, apiMatchId, reason: lock.reason };

  const heartbeat = startLeaseHeartbeat(lock.handle);
  try {
    const snapshot = await loadAuthoritativeSettlementFixture(apiMatchId);
    if (!snapshot) return { ok: false, apiMatchId, reason: 'NO_FIXTURE' };
    const settled = resolveSettlementInput(snapshot);
    if (!settled.ok) return { ok: false, apiMatchId, reason: 'GATE_REJECTED', detail: settled.reason };

    const rows = (await prisma.prediction.findMany({
      where: { apiMatchId, isCorrect: { not: null }, voidedAt: null },
    })) as unknown as SettledRow[];

    const counts: ResettleCounts = { wrongToCorrect: 0, correctToWrong: 0, unchanged: 0 };
    const items: ResettleItem[] = [];
    const changed: Array<{ row: SettledRow; item: ResettleItem }> = [];
    for (const row of rows) {
      const { bucket, computed } = classifyStoredVerdict(row, settled);
      counts[bucket] += 1;
      if (bucket === 'unchanged') continue;
      const item: ResettleItem = {
        predictionId: row.id,
        userId: row.userId,
        bucket,
        stored: row.isCorrect,
        computed,
        applied: false,
        coins: 0,
        xp: 0,
      };
      items.push(item);
      changed.push({ row, item });
    }

    const base = { ok: true as const, apiMatchId, snapshot: settled, counts, items };
    if (opts.dryRun) {
      return { ...base, dryRun: true, runId: null, credited: { coins: 0, xp: 0 }, aborted: null };
    }

    const run = await prisma.predictionResettleRun.create({
      data: {
        apiMatchId,
        adminUserId: opts.adminUserId ?? null,
        snapshot: settled as any,
        summary: { counts, state: 'RUNNING' },
      },
    });

    const now = new Date();
    const credited = { coins: 0, xp: 0 };
    let aborted: 'SETTLE_LOCK_LOST' | null = null;
    for (const { row, item } of changed) {
      if (heartbeat.isLost()) {
        aborted = 'SETTLE_LOCK_LOST';
        break;
      }
      const before = {
        isCorrect: row.isCorrect,
        settledHomeScore: row.settledHomeScore,
        settledAwayScore: row.settledAwayScore,
        settledStatus: row.settledStatus,
      };
      const after = { isCorrect: item.computed, settledHomeScore: settled.homeScore, settledAwayScore: settled.awayScore, settledStatus: settled.status };
      if (item.bucket === 'wrongToCorrect') {
        const outcome = await prisma.$transaction(async (tx) => {
          const res = await applyWrongToCorrect(tx, row, settled, run.id, apiMatchId, now);
          await tx.predictionResettleItem.create({
            data: {
              runId: run.id,
              predictionId: row.id,
              bucket: item.bucket,
              applied: res.applied,
              diff: { before, after, coins: res.coins, xp: res.xp },
            },
          });
          return res;
        });
        Object.assign(item, outcome);
        credited.coins += outcome.coins;
        credited.xp += outcome.xp;
      } else {
        await prisma.predictionResettleItem.create({
          data: { runId: run.id, predictionId: row.id, bucket: item.bucket, applied: false, diff: { before, after } },
        });
      }
    }

    await prisma.predictionResettleRun.update({
      where: { id: run.id },
      data: { summary: { counts, credited, state: aborted ?? 'COMPLETE' } },
    });
    logger.info(JSON.stringify({ event: 'PREDICTION_RESETTLED', apiMatchId, runId: run.id, counts, credited, aborted }));
    clearResponseCache('/predictions/stats').catch(() => {});

    // Q9: in-app only, never a push, and only for rows that were actually changed.
    for (const { row, item } of changed) {
      if (!item.applied) continue;
      const matchInfo = `${row.homeTeam || 'Home'} ${settled.homeScore}-${settled.awayScore} ${row.awayTeam || 'Away'}`;
      NotificationService.sendPredictionResultNotification(
        row.userId,
        true,
        matchInfo,
        item.xp,
        { fixtureId: apiMatchId, homeTeam: row.homeTeam, awayTeam: row.awayTeam, homeScore: settled.homeScore, awayScore: settled.awayScore },
        { skipPush: true },
      ).catch((err) => logger.warn(`Re-settle notification failed for ${row.userId}:`, err?.message));
    }

    return { ...base, dryRun: false, runId: run.id, credited, aborted };
  } finally {
    heartbeat.stop();
    await lock.handle.release();
  }
}
