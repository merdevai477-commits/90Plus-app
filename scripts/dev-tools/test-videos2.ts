import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const reels = await prisma.reel.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { id: true, videoUrl: true, processedVideoUrl: true, status: true }
  });
  console.log(JSON.stringify(reels, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
