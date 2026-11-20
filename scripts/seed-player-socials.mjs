/**
 * Seed curated Facebook / Instagram pages for well-known 365Scores athletes.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/seed-player-socials.mjs
 */
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const prisma = new PrismaClient();

/** Official public pages keyed by 365Scores athleteId. */
const SEED = [
  {
    athleteId: 39789,
    name: 'Raphinha',
    facebookUrl: null,
    instagramUrl: 'https://www.instagram.com/raphinha/',
  },
  {
    athleteId: 39820,
    name: 'Kylian Mbappé',
    facebookUrl: 'https://www.facebook.com/kylianmbappeofficiel',
    instagramUrl: 'https://www.instagram.com/k.mbappe/',
  },
  {
    athleteId: 874,
    name: 'Lionel Messi',
    facebookUrl: 'https://www.facebook.com/leomessi',
    instagramUrl: 'https://www.instagram.com/leomessi/',
  },
  {
    athleteId: 817,
    name: 'Cristiano Ronaldo',
    facebookUrl: 'https://www.facebook.com/Cristiano',
    instagramUrl: 'https://www.instagram.com/cristiano/',
  },
  {
    athleteId: 48298,
    name: 'Vinícius Júnior',
    facebookUrl: null,
    instagramUrl: 'https://www.instagram.com/vinijr/',
  },
  {
    athleteId: 65760,
    name: 'Erling Haaland',
    facebookUrl: null,
    instagramUrl: 'https://www.instagram.com/erling.haaland/',
  },
];

try {
  for (const row of SEED) {
    await prisma.playerSocialLink.upsert({
      where: { athleteId: row.athleteId },
      create: row,
      update: {
        name: row.name,
        facebookUrl: row.facebookUrl,
        instagramUrl: row.instagramUrl,
      },
    });
    console.log('upserted', row.athleteId, row.name, {
      fb: Boolean(row.facebookUrl),
      ig: Boolean(row.instagramUrl),
    });
  }
  const total = await prisma.playerSocialLink.count();
  console.log('total rows', total);
} finally {
  await prisma.$disconnect();
}
