import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function run() {
  const reels = await prisma.reel.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { id: true, videoUrl: true, rawVideoUrl: true, status: true }
  });
  
  for (const reel of reels) {
    console.log(`Reel ID: ${reel.id}`);
    console.log(`Status: ${reel.status}`);
    console.log(`Video URL: ${reel.videoUrl}`);
    console.log(`Raw Video URL: ${reel.rawVideoUrl}`);
    
    if (reel.videoUrl) {
      try {
        const res = await fetch(reel.videoUrl, { method: 'HEAD' });
        console.log(`HEAD ${reel.videoUrl.substring(0, 50)}... -> Status: ${res.status}`);
      } catch (e: any) {
        console.log(`HEAD failed: ${e.message}`);
      }
    }
    console.log('---');
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
