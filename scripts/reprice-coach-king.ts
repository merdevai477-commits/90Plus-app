/**
 * Reprice the King of Coaches pool without wiping squads.
 *
 *   npx tsx scripts/reprice-coach-king.ts
 */

import 'dotenv/config';
import { syncCoachKingPool } from '../src/services/coach-king-pool.service';
import { CK_PRICE_TIERS_MILLI } from '../src/services/coach-king-pricing';
import prisma from '../src/lib/prisma';

async function main() {
  const pool = await syncCoachKingPool();
  const tiers = await prisma.coachKingPlayer.groupBy({
    by: ['priceMilli'],
    where: { active: true },
    _count: true,
    orderBy: { priceMilli: 'asc' },
  });
  console.log(JSON.stringify({
    pool,
    expectedTiers: CK_PRICE_TIERS_MILLI.map((t) => `${t / 10}M`),
    playerTiers: tiers.map((row) => ({ price: `${row.priceMilli / 10}M`, count: row._count })),
  }, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[CoachKing] reprice failed', error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
