import 'dotenv/config';
import prisma from '../src/lib/prisma';

async function main() {
  const [gameweeks, squads, slots, performances, wallets, tiers, coaches] = await Promise.all([
    prisma.coachKingGameweek.findMany({ select: { weekKey: true, status: true, startAt: true, endAt: true } }),
    prisma.coachKingSquad.count(),
    prisma.coachKingSquadSlot.count(),
    prisma.coachKingPerformance.count(),
    prisma.coachKingWallet.findMany({ select: { balanceMilli: true } }),
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
  ]);
  console.log(JSON.stringify({
    gameweeks,
    squads,
    slots,
    performances,
    wallets: wallets.map((w) => `${w.balanceMilli / 10}M`),
    playerTiers: tiers.map((row) => ({ price: `${row.priceMilli / 10}M`, count: row._count })),
    coachTiers: coaches.map((row) => ({ price: `${row.priceMilli / 10}M`, count: row._count })),
  }, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
