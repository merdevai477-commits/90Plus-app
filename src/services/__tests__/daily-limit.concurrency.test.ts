/**
 * B3 — 15 parallel creates for one user yield exactly 10 rows.
 *
 * Runs only against a throwaway Postgres: KING_CONCURRENCY_DB_URL=postgres://...
 * The test creates and drops its own schema; never point it at production.
 */

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { PrismaClient } from '@prisma/client';
import { claimDailySlot } from '../king-prediction.service';
import { cairoDayKey } from '../king-prediction-rules';

const url = process.env.KING_CONCURRENCY_DB_URL;
const maybe = url ? describe : describe.skip;
const SCHEMA = `king_b3_${process.pid}`;

maybe('daily limit under concurrency (B3)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const u = new URL(url!);
    u.searchParams.set('schema', SCHEMA);
    u.searchParams.set('connection_limit', '20');
    prisma = new PrismaClient({ datasourceUrl: u.toString() });
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${SCHEMA}"."predictions" ("id" serial PRIMARY KEY, "userId" text NOT NULL, "apiMatchId" int NOT NULL, "createdAt" timestamp(3) NOT NULL DEFAULT now())`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${SCHEMA}"."prediction_daily_counters" ("userId" text NOT NULL, "cairoDay" date NOT NULL, "count" int NOT NULL DEFAULT 0, "updatedAt" timestamp(3) NOT NULL DEFAULT now(), PRIMARY KEY ("userId","cairoDay"))`,
    );
  }, 60_000);

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await prisma.$disconnect();
  }, 60_000);

  it('15 parallel creates yield exactly 10', async () => {
    const day = cairoDayKey();
    const errors: string[] = [];
    const attempts = Array.from({ length: 15 }, (_, i) =>
      prisma
        .$transaction(
          async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${SCHEMA}"`);
            const used = await claimDailySlot(tx as any, 'u1', day, 10);
            if (used == null) return false;
            await tx.$executeRawUnsafe(
              `INSERT INTO "${SCHEMA}"."predictions" ("userId", "apiMatchId") VALUES ('u1', ${4_800_000 + i})`,
            );
            return true;
          },
          { timeout: 30_000, maxWait: 30_000 },
        )
        .catch((err) => {
          errors.push(String(err?.message ?? err).slice(0, 200));
          return false;
        }),
    );
    const results = await Promise.all(attempts);
    const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int n FROM "${SCHEMA}"."predictions" WHERE "userId" = 'u1'`,
    );
    expect(errors).toEqual([]);
    expect(results.filter(Boolean)).toHaveLength(10);
    expect(rows[0].n).toBe(10);
  }, 120_000);

  it('seeds the counter from rows created before it existed', async () => {
    const day = cairoDayKey();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${SCHEMA}"."predictions" ("userId", "apiMatchId") SELECT 'u2', g FROM generate_series(1, 9) g`,
    );
    const first = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${SCHEMA}"`);
      return claimDailySlot(tx as any, 'u2', day, 10);
    });
    const second = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${SCHEMA}"`);
      return claimDailySlot(tx as any, 'u2', day, 10);
    });
    expect(first).toBe(10);
    expect(second).toBeNull();
  }, 60_000);
});
