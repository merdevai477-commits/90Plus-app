/**
 * Full King of Coaches restart against the configured DATABASE_URL.
 *
 *   npx tsx scripts/reset-coach-king.ts
 */

import 'dotenv/config';
import { resetCoachKingCompetition } from '../src/services/coach-king.service';
import { CK_PLAYER_CAP_MILLI, CK_PRICE_TIERS_MILLI } from '../src/services/coach-king-pricing';
import prisma from '../src/lib/prisma';

async function main() {
  console.log(`[CoachKing] resetting competition… cap=${CK_PLAYER_CAP_MILLI / 10}M tiers=${CK_PRICE_TIERS_MILLI.map((t) => `${t / 10}M`).join('/')}`);
  const result = await resetCoachKingCompetition();

  const [tierCounts, coaches, maxPrice, wallets] = await Promise.all([
    prisma.coachKingPlayer.groupBy({
      by: ['priceMilli'],
      where: { active: true },
      _count: true,
      orderBy: { priceMilli: 'asc' },
    }),
    prisma.coachKingCoach.groupBy({
      by: ['priceMilli'],
      where: { active: true },
      _count: true,
    }),
    prisma.coachKingPlayer.aggregate({ where: { active: true }, _max: { priceMilli: true } }),
    prisma.coachKingWallet.aggregate({ _min: { balanceMilli: true }, _max: { balanceMilli: true }, _count: true }),
  ]);

  console.log(JSON.stringify({
    result,
    playerTiers: tierCounts.map((row) => ({ price: `${row.priceMilli / 10}M`, count: row._count })),
    coachTiers: coaches.map((row) => ({ price: `${row.priceMilli / 10}M`, count: row._count })),
    maxPlayerPrice: `${(maxPrice._max.priceMilli ?? 0) / 10}M`,
    wallets: {
      count: wallets._count,
      min: `${(wallets._min.balanceMilli ?? 0) / 10}M`,
      max: `${(wallets._max.balanceMilli ?? 0) / 10}M`,
    },
  }, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[CoachKing] reset failed', error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
