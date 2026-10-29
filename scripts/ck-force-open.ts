import 'dotenv/config';
import prisma from '../src/lib/prisma';

async function main() {
  const weeks = await prisma.coachKingGameweek.findMany();
  for (const week of weeks) {
    await prisma.coachKingGameweek.update({
      where: { id: week.id },
      data: {
        status: 'OPEN',
        settledAt: null,
        completedAt: null,
        lockAt: week.endAt,
      },
    });
  }
  console.log(JSON.stringify(
    await prisma.coachKingGameweek.findMany({
      select: { weekKey: true, status: true, lockAt: true, endAt: true },
    }),
    null,
    2,
  ));
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
