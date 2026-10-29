import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { CK_SLOT_POSITIONS } from '../src/services/coach-king-scoring';

async function main() {
  const haaland = await prisma.coachKingPlayer.findMany({
    where: {
      active: true,
      OR: [
        { nameAr: { contains: 'هالاند', mode: 'insensitive' } },
        { nameEn: { contains: 'Haaland', mode: 'insensitive' } },
        { nameAr: { contains: 'Haaland', mode: 'insensitive' } },
      ],
    },
    select: {
      nameAr: true,
      nameEn: true,
      position: true,
      line: true,
      priceMilli: true,
      leagueKey: true,
      clubNameEn: true,
      teamId: true,
    },
  });

  const topFwd = await prisma.coachKingPlayer.findMany({
    where: { active: true, line: 'FWD', priceMilli: 130 },
    take: 40,
    orderBy: [{ nameEn: 'asc' }],
    select: { nameAr: true, nameEn: true, position: true, priceMilli: true, clubNameEn: true, leagueKey: true },
  });

  const cheapStars = await prisma.coachKingPlayer.findMany({
    where: {
      active: true,
      line: 'FWD',
      priceMilli: { lt: 130 },
      OR: [
        { nameEn: { contains: 'Haaland', mode: 'insensitive' } },
        { nameEn: { contains: 'Mbappe', mode: 'insensitive' } },
        { nameEn: { contains: 'Salah', mode: 'insensitive' } },
        { nameEn: { contains: 'Kane', mode: 'insensitive' } },
        { nameEn: { contains: 'Vinicius', mode: 'insensitive' } },
        { nameEn: { contains: 'Yamal', mode: 'insensitive' } },
        { nameEn: { contains: 'Saka', mode: 'insensitive' } },
        { nameEn: { contains: 'Palmer', mode: 'insensitive' } },
      ],
    },
    select: { nameEn: true, nameAr: true, position: true, priceMilli: true, clubNameEn: true },
  });

  const posCounts = await prisma.coachKingPlayer.groupBy({
    by: ['position'],
    where: { active: true, line: 'FWD' },
    _count: true,
    orderBy: { position: 'asc' },
  });

  const slotCounts: Record<string, number> = {};
  for (const [slot, positions] of Object.entries(CK_SLOT_POSITIONS)) {
    if (!['lw', 'st', 'rw'].includes(slot)) continue;
    slotCounts[slot] = await prisma.coachKingPlayer.count({
      where: { active: true, line: 'FWD', position: { in: [...positions] } },
    });
  }

  const weak13 = await prisma.coachKingPlayer.findMany({
    where: { active: true, priceMilli: 130 },
    take: 50,
    orderBy: { nameEn: 'asc' },
    select: { nameEn: true, nameAr: true, line: true, position: true, clubNameEn: true, leagueKey: true },
  });

  console.log(JSON.stringify({ haaland, cheapStars, slotCounts, posCounts, topFwdCount: topFwd.length, topFwd: topFwd.slice(0, 25), weak13: weak13.slice(0, 40) }, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
