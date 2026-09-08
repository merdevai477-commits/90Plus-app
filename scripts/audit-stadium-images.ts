/**
 * Flag stadium_images rows that look like a bad Wikipedia match.
 * Missing coordinates on found=true is the same pattern as the Bernabéu person photo.
 *
 *   npx ts-node --project tsconfig.scripts.json scripts/audit-stadium-images.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.stadiumImage.findMany({
    where: {
      found: true,
      OR: [{ latitude: null }, { longitude: null }],
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      stadiumNameNormalized: true,
      originalName: true,
      imageUrl: true,
      source: true,
      found: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log(`found=true rows missing coordinates: ${rows.length}`);
  for (const row of rows) {
    console.log(
      JSON.stringify({
        id: row.id,
        stadiumNameNormalized: row.stadiumNameNormalized,
        originalName: row.originalName,
        imageUrl: row.imageUrl,
        source: row.source,
        latitude: row.latitude,
        longitude: row.longitude,
        updatedAt: row.updatedAt,
      }),
    );
  }

  const placeholderPersisted = await prisma.stadiumImage.findMany({
    where: {
      found: true,
      OR: [
        { imageUrl: { contains: 'stadium-placeholder.svg' } },
        { imageUrl: { contains: 'Football_pitch_pv' } },
      ],
    },
    select: { id: true, stadiumNameNormalized: true, imageUrl: true, found: true },
  });
  console.log(`found=true rows with a placeholder URL: ${placeholderPersisted.length}`);
  for (const row of placeholderPersisted) {
    console.log(JSON.stringify(row));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
