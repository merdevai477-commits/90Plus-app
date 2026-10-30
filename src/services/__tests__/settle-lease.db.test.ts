/**
 * A5 / A6 — the settle lease against a real Postgres.
 *
 * Runs only against a throwaway Postgres: KING_CONCURRENCY_DB_URL=postgres://...
 * Creates `settle_leases` if missing and drops it afterwards; never point it
 * at production.
 */

import { PrismaClient } from '@prisma/client';

let mockClient: PrismaClient;
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  get default() {
    return mockClient;
  },
}));

import { acquireSettleLock } from '../prediction-settle-lock';

const url = process.env.KING_CONCURRENCY_DB_URL;
const maybe = url ? describe : describe.skip;
const MATCH = 4_999_001;

maybe('settle lease on Postgres (A5)', () => {
  let createdTable = false;

  beforeAll(async () => {
    const u = new URL(url!);
    u.searchParams.set('connection_limit', '20');
    mockClient = new PrismaClient({ datasourceUrl: u.toString() });
    const existing = await mockClient.$queryRawUnsafe<Array<{ t: string | null }>>(
      `SELECT to_regclass('public.settle_leases')::text AS t`,
    );
    if (!existing[0]?.t) {
      await mockClient.$executeRawUnsafe(
        `CREATE TABLE settle_leases ("apiMatchId" INTEGER PRIMARY KEY, "owner" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      );
      createdTable = true;
    }
    await mockClient.$executeRawUnsafe(`DELETE FROM settle_leases WHERE "apiMatchId" = ${MATCH}`);
  }, 60_000);

  afterAll(async () => {
    if (createdTable) await mockClient.$executeRawUnsafe(`DROP TABLE IF EXISTS settle_leases`);
    else await mockClient.$executeRawUnsafe(`DELETE FROM settle_leases WHERE "apiMatchId" = ${MATCH}`);
    await mockClient.$disconnect();
  }, 60_000);

  it('10 parallel acquires → exactly one holder', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => acquireSettleLock(MATCH)));
    const winners = results.filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === 'SETTLE_SKIPPED_LOCKED')).toHaveLength(9);
    if (winners[0].ok) await winners[0].handle.release();
  }, 60_000);

  it('release frees the lease for the next settler', async () => {
    const a = await acquireSettleLock(MATCH);
    expect(a.ok).toBe(true);
    if (a.ok) await a.handle.release();
    const b = await acquireSettleLock(MATCH);
    expect(b.ok).toBe(true);
    if (b.ok) await b.handle.release();
  }, 60_000);

  it('extend pushes expiry forward for the owner', async () => {
    const a = await acquireSettleLock(MATCH);
    if (!a.ok) throw new Error('expected lock');
    await mockClient.$executeRawUnsafe(
      `UPDATE settle_leases SET "expiresAt" = now() + interval '5 seconds' WHERE "apiMatchId" = ${MATCH}`,
    );
    await expect(a.handle.extend()).resolves.toBe(true);
    const rows = await mockClient.$queryRawUnsafe<Array<{ secs: number }>>(
      `SELECT EXTRACT(EPOCH FROM ("expiresAt" - now()))::float AS secs FROM settle_leases WHERE "apiMatchId" = ${MATCH}`,
    );
    expect(rows[0].secs).toBeGreaterThan(50);
    await a.handle.release();
  }, 60_000);

  it('an expired lease is taken over; the old owner cannot extend or release it', async () => {
    const stale = await acquireSettleLock(MATCH);
    if (!stale.ok) throw new Error('expected lock');
    await mockClient.$executeRawUnsafe(
      `UPDATE settle_leases SET "expiresAt" = now() - interval '1 second' WHERE "apiMatchId" = ${MATCH}`,
    );
    const fresh = await acquireSettleLock(MATCH);
    expect(fresh.ok).toBe(true);
    await expect(stale.handle.extend()).resolves.toBe(false);
    await stale.handle.release();
    const third = await acquireSettleLock(MATCH);
    expect(third).toMatchObject({ ok: false, reason: 'SETTLE_SKIPPED_LOCKED' });
    if (fresh.ok) await fresh.handle.release();
  }, 60_000);
});
