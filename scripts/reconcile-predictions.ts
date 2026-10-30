/**
 * READ-ONLY reconciliation of settled King predictions (A7). Never writes.
 *
 * 1. Verdict drift: stored isCorrect vs the settlement gate on the cached
 *    final (same rules as the admin re-settle, via classifyStoredVerdict).
 * 2. Ledger drift: correct rows with no coin credit, rows paid twice
 *    (original + re-settle key), wrong rows that hold a credit.
 *
 * One `RECONCILE_DRIFT` JSON line per match with verdict drift, then a summary.
 *
 * Usage:
 *   PREDICTION_SETTLE_DRY_RUN_ALLOW_RW=1 npx ts-node --project tsconfig.scripts.json scripts/reconcile-predictions.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  classifyStoredVerdict,
  extractPenaltyFromFullData,
  resolveSettlementInput,
  type StoredVerdictBucket,
} from '../src/services/prediction-settlement-gate';

function assertReadOnlyGuard(): void {
  const url = process.env.DATABASE_URL ?? '';
  const looksReadonly =
    /(?:^|[?&])(?:options|readonly)=[^&]*readonly/i.test(url) || process.env.DATABASE_READONLY === '1';
  if (!looksReadonly && process.env.PREDICTION_SETTLE_DRY_RUN_ALLOW_RW !== '1') {
    console.error('REFUSING TO RUN: use a read-only DATABASE_URL or PREDICTION_SETTLE_DRY_RUN_ALLOW_RW=1 (still no writes).');
    process.exit(2);
  }
}

type SettledRow = {
  id: string;
  apiMatchId: number;
  predictionType: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  isCorrect: boolean;
};

type FinalFixture = {
  fixtureId: number;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  /** Only `score.penalty` of fullData; the whole blob is large and repeated per row. */
  penalty: unknown;
};

async function main(): Promise<void> {
  assertReadOnlyGuard();
  const prisma = new PrismaClient();
  const out = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const fixtures = await tx.$queryRawUnsafe<FinalFixture[]>(
        `SELECT cf."fixtureId", cf.status, cf."homeScore", cf."awayScore", cf."fullData"->'score'->'penalty' AS penalty
           FROM cached_fixtures cf
          WHERE cf.status IN ('FT', 'AET', 'PEN')
            AND EXISTS (SELECT 1 FROM predictions p WHERE p."apiMatchId" = cf."fixtureId" AND p."isCorrect" IS NOT NULL)`,
      );
      const rows = await tx.$queryRawUnsafe<SettledRow[]>(
        `SELECT p.id, p."apiMatchId", p."predictionType", p."predictedHomeScore", p."predictedAwayScore", p."isCorrect"
           FROM predictions p
          WHERE p."isCorrect" IS NOT NULL AND p."voidedAt" IS NULL
            AND p."apiMatchId" = ANY($1::int[])`,
        fixtures.map((f) => f.fixtureId),
      );
      const ledger = await tx.$queryRawUnsafe<Array<{ kind: string; n: number; sample: string[] | null }>>(
        `WITH keyed AS (
           SELECT substring("idempotencyKey" FROM '^prediction:(.+?)(?::resettle)?:coins$') AS id,
                  bool_or("idempotencyKey" NOT LIKE '%:resettle:coins') AS original,
                  bool_or("idempotencyKey" LIKE '%:resettle:coins') AS resettle
             FROM coin_transactions
            WHERE "idempotencyKey" LIKE 'prediction:%:coins'
            GROUP BY 1
         ),
         credits AS (
           SELECT p.id, p."isCorrect", k.original, k.resettle
             FROM predictions p
             LEFT JOIN keyed k ON k.id = p.id
            WHERE p."isCorrect" IS NOT NULL
         )
         SELECT 'doubleCredit' AS kind, count(*)::int AS n, (array_agg(id))[1:5] AS sample FROM credits WHERE original AND resettle
         UNION ALL
         SELECT 'creditOnWrong', count(*)::int, (array_agg(id))[1:5] FROM credits WHERE NOT "isCorrect" AND (original OR resettle)
         UNION ALL
         SELECT 'correctWithoutKeyedCredit', count(*)::int, (array_agg(id))[1:5] FROM credits
          WHERE "isCorrect" AND original IS NOT TRUE AND resettle IS NOT TRUE`,
      );
      return { rows, ledger, fixtures };
    },
    { timeout: 120_000 },
  );
  const fixtureById = new Map(out.fixtures.map((f) => [f.fixtureId, f]));

  const counts: Record<StoredVerdictBucket | 'undeterminable', number> = {
    wrongToCorrect: 0,
    correctToWrong: 0,
    unchanged: 0,
    undeterminable: 0,
  };
  const byStatus: Record<string, Record<string, number>> = {};
  const byMode: Record<'winner' | 'exact', Record<string, number>> = { winner: {}, exact: {} };
  const byMatch = new Map<number, { status: string; wrongToCorrect: string[]; correctToWrong: string[] }>();

  for (const row of out.rows) {
    const fixture = fixtureById.get(row.apiMatchId)!;
    const pen = extractPenaltyFromFullData({ score: { penalty: fixture.penalty } });
    const gated = resolveSettlementInput({
      status: fixture.status,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      penaltyHome: pen.home,
      penaltyAway: pen.away,
    });
    const bucket = gated.ok ? classifyStoredVerdict(row, gated).bucket : 'undeterminable';
    counts[bucket] += 1;
    const mode = row.predictedHomeScore != null && row.predictedAwayScore != null ? 'exact' : 'winner';
    byMode[mode][bucket] = (byMode[mode][bucket] ?? 0) + 1;
    byStatus[fixture.status] ??= {};
    byStatus[fixture.status][bucket] = (byStatus[fixture.status][bucket] ?? 0) + 1;
    if (bucket === 'wrongToCorrect' || bucket === 'correctToWrong') {
      const entry = byMatch.get(row.apiMatchId) ?? { status: fixture.status, wrongToCorrect: [], correctToWrong: [] };
      entry[bucket].push(row.id);
      byMatch.set(row.apiMatchId, entry);
    }
  }

  for (const [apiMatchId, entry] of byMatch) {
    console.log(
      JSON.stringify({
        event: 'RECONCILE_DRIFT',
        apiMatchId,
        status: entry.status,
        wrongToCorrect: entry.wrongToCorrect.length,
        correctToWrong: entry.correctToWrong.length,
        predictionIds: [...entry.wrongToCorrect, ...entry.correctToWrong].slice(0, 10),
      }),
    );
  }

  console.log(
    JSON.stringify(
      {
        event: 'RECONCILE_SUMMARY',
        generatedAt: new Date().toISOString(),
        scanned: out.rows.length,
        counts,
        byMode,
        byStatus,
        driftMatches: byMatch.size,
        ledger: Object.fromEntries(out.ledger.map((l) => [l.kind, { n: l.n, sample: l.sample ?? [] }])),
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
