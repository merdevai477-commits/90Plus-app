/**
 * Delete confirmed-bad stadium_images rows so they re-resolve with venue validation.
 *
 *   npx ts-node --project tsconfig.scripts.json scripts/cleanup-bad-stadium-images.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/cleanup-bad-stadium-images.ts --resolve
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { normalizeStadiumName } from '../src/utils/stadium-name.util';

const prisma = new PrismaClient();

const BAD_IDS = ['7f36a68c-8d34-4d1c-a440-469dcfce79c5'];
const BAD_NAMES = ['santiago bernabeu', 'signal iduna park', 'signal iduna park (dortmund)'];

async function main() {
  const before = await prisma.stadiumImage.findMany({
    where: {
      OR: [
        { id: { in: BAD_IDS } },
        { stadiumNameNormalized: { in: BAD_NAMES }, imageUrl: { contains: 'Santiago_Bernabeu.jpg' } },
        { stadiumNameNormalized: { in: BAD_NAMES }, imageUrl: { contains: 'HV-Dammtor' } },
        { stadiumNameNormalized: { in: BAD_NAMES }, found: true, latitude: null },
      ],
    },
    select: {
      id: true,
      stadiumNameNormalized: true,
      originalName: true,
      imageUrl: true,
      found: true,
      latitude: true,
      longitude: true,
    },
  });
  console.log(`rows to delete: ${before.length}`);
  for (const row of before) {
    console.log(JSON.stringify(row));
  }

  if (before.length > 0) {
    const deleted = await prisma.stadiumImage.deleteMany({
      where: { id: { in: before.map((row) => row.id) } },
    });
    console.log(`deleted: ${deleted.count}`);
  }

  if (!process.argv.includes('--resolve')) return;

  const { getStadiumImage } = await import('../src/services/stadium-image.service');
  for (const name of ['Santiago Bernabéu', 'Signal Iduna Park', 'Signal Iduna Park (Dortmund)']) {
    const result = await getStadiumImage(name);
    const cached = await prisma.stadiumImage.findUnique({
      where: { stadiumNameNormalized: normalizeStadiumName(name).normalized },
    });
    console.log(
      JSON.stringify({
        name,
        lookup: result,
        cached: cached
          ? {
              id: cached.id,
              stadiumNameNormalized: cached.stadiumNameNormalized,
              imageUrl: cached.imageUrl,
              found: cached.found,
              latitude: cached.latitude,
              longitude: cached.longitude,
            }
          : null,
      }),
    );
  }

  const campNou = await prisma.stadiumImage.findMany({
    where: {
      stadiumNameNormalized: { contains: 'camp nou' },
    },
  });
  console.log('camp nou rows (untouched):', JSON.stringify(campNou.map((row) => ({
    id: row.id,
    stadiumNameNormalized: row.stadiumNameNormalized,
    imageUrl: row.imageUrl,
    found: row.found,
    latitude: row.latitude,
    longitude: row.longitude,
  }))));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    try {
      const { closeRedis } = await import('../src/lib/redis');
      await closeRedis();
    } catch {
      /* redis may never have loaded */
    }
    process.exit(process.exitCode ?? 0);
  });
