/**
 * READ-ONLY dry-run: recompute King settlement under P0 gate rules and
 * compare to stored isCorrect. Never writes.
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node --project tsconfig.scripts.json scripts/dry-run-prediction-settlement-audit.ts
 *
 * Guard: refuses to run unless DATABASE_URL looks read-only OR
 * PREDICTION_SETTLE_DRY_RUN_ALLOW_RW=1 is set (still performs zero writes).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  isExactPredictionCorrect,
  isWinnerPredictionCorrect,
  resolveSettlementInput,
  extractPenaltyFromFullData,
} from '../src/services/prediction-settlement-gate';

type Bucket = 'wrongToCorrect' | 'correctToWrong' | 'unchanged' | 'undeterminable';

type Example = {
  predictionId: string;
  apiMatchId: number;
  stored: boolean | null;
  computed: boolean | null;
  reason?: string;
  status?: string;
};

const EXAMPLES_LIMIT = 20;

function assertReadOnlyGuard(): void {
  const url = process.env.DATABASE_URL ?? '';
  const allowRw = process.env.PREDICTION_SETTLE_DRY_RUN_ALLOW_RW === '1';
  const looksReadonly =
    /(?:^|[?&])(?:options|readonly)=[^&]*readonly/i.test(url) ||
    /(?:^|[?&])application_name=readonly/i.test(url) ||
    process.env.DATABASE_READONLY === '1';

  if (!looksReadonly && !allowRw) {
    console.error(
      [
        'REFUSING TO RUN: DATABASE_URL does not look read-only.',
        'Use a read-only role / ?options=-c%20default_transaction_read_only%3Don',
        'or set PREDICTION_SETTLE_DRY_RUN_ALLOW_RW=1 (script still performs no writes).',
      ].join('\n'),
    );
    process.exit(2);
  }
}

async function enforceSessionReadOnly(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`SET default_transaction_read_only = on`);
  await prisma.$executeRawUnsafe(`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
}

function computeCorrect(row: {
  predictionType: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  fullData: unknown;
}): { correct: boolean | null; reason?: string; status?: string; winner?: string } {
  const pen = extractPenaltyFromFullData(row.fullData);
  const gated = resolveSettlementInput({
    status: row.status,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    penaltyHome: pen.home,
    penaltyAway: pen.away,
  });
  if (!gated.ok) {
    return { correct: null, reason: gated.reason, status: row.status };
  }
  const hasExact = row.predictedHomeScore != null && row.predictedAwayScore != null;
  const correct = hasExact
    ? isExactPredictionCorrect(
        row.predictedHomeScore!,
        row.predictedAwayScore!,
        gated.exactHomeScore,
        gated.exactAwayScore,
      )
    : isWinnerPredictionCorrect(row.predictionType, gated.winner, gated.status);
  return { correct, status: gated.status, winner: gated.winner };
}

async function main(): Promise<void> {
  assertReadOnlyGuard();
  const prisma = new PrismaClient();
  await enforceSessionReadOnly(prisma);

  const buckets: Record<Bucket, Example[]> = {
    wrongToCorrect: [],
    correctToWrong: [],
    unchanged: [],
    undeterminable: [],
  };
  const counts: Record<Bucket, number> = {
    wrongToCorrect: 0,
    correctToWrong: 0,
    unchanged: 0,
    undeterminable: 0,
  };

  // Coins/XP impact estimates (winner + exact both pay 10 coins / 1 XP when correct).
  let coinsWrongToCorrect = 0;
  let xpWrongToCorrect = 0;
  let coinsCorrectToWrong = 0;
  let xpCorrectToWrong = 0;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      apiMatchId: number;
      predictionType: string;
      predictedHomeScore: number | null;
      predictedAwayScore: number | null;
      isCorrect: boolean | null;
      coinsWon: number | null;
      status: string;
      homeScore: number | null;
      awayScore: number | null;
      fullData: unknown;
    }>
  >(
    `SELECT p.id, p."apiMatchId", p."predictionType", p."predictedHomeScore", p."predictedAwayScore",
            p."isCorrect", p."coinsWon", cf.status, cf."homeScore", cf."awayScore", cf."fullData"
     FROM predictions p
     INNER JOIN cached_fixtures cf ON cf."fixtureId" = p."apiMatchId"
     WHERE p."isCorrect" IS NOT NULL
       AND cf.status IN ('FT', 'AET', 'PEN')
     ORDER BY p."resolvedAt" DESC NULLS LAST
     LIMIT 50000`,
  );

  for (const row of rows) {
    const computed = computeCorrect(row);
    const stored = row.isCorrect;

    let bucket: Bucket;
    if (computed.correct === null) {
      bucket = 'undeterminable';
    } else if (stored === false && computed.correct === true) {
      bucket = 'wrongToCorrect';
      coinsWrongToCorrect += 10;
      xpWrongToCorrect += 1;
    } else if (stored === true && computed.correct === false) {
      bucket = 'correctToWrong';
      coinsCorrectToWrong += row.coinsWon ?? 10;
      xpCorrectToWrong += 1;
    } else {
      bucket = 'unchanged';
    }

    counts[bucket] += 1;
    if (buckets[bucket].length < EXAMPLES_LIMIT) {
      buckets[bucket].push({
        predictionId: row.id,
        apiMatchId: row.apiMatchId,
        stored,
        computed: computed.correct,
        reason: computed.reason,
        status: computed.status ?? row.status,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scanned: rows.length,
    counts,
    impact: {
      wrongToCorrect: { coins: coinsWrongToCorrect, xp: xpWrongToCorrect },
      correctToWrong: { coins: coinsCorrectToWrong, xp: xpCorrectToWrong },
      note:
        'correctToWrong clawback is a product decision — this script never reverses coins.',
    },
    examples: buckets,
    decisions: {
      penDrawPick: 'wrong',
      exactScoreLine: 'goals (FT=90, AET=after ET, PEN=pre-shootout) — unchanged',
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
