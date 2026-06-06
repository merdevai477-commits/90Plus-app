/**
 * Delete all reels except the most recently created one.
 * Usage: DATABASE_URL="..." npx tsx scripts/delete-all-reels-except-latest.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const total = await prisma.reel.count();
    console.log(`Total reels in DB: ${total}`);

    if (total === 0) {
      console.log('No reels to delete.');
      return;
    }

    const latest = await prisma.reel.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        caption: true,
        userId: true,
        status: true,
      },
    });

    if (!latest) {
      console.log('Could not resolve latest reel.');
      return;
    }

    console.log('Keeping latest reel:', latest);

    const deleted = await prisma.reel.deleteMany({
      where: { id: { not: latest.id } },
    });

    const remaining = await prisma.reel.count();
    console.log(`Deleted ${deleted.count} reel(s). Remaining: ${remaining}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
