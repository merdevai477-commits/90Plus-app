/**
 * Seed + resolve the Top Scorers Five pool for a league (default: laliga).
 *
 *   npx tsx scripts/seed-top-scorers-five.ts [leagueKey] [--force]
 *
 * Idempotent: upserts by (league, Arabic name), then links unresolved names to
 * 365Scores athlete ids. `--force` re-resolves every entry.
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { resolveTopScorersFivePool, seedTopScorersFivePool } from '../src/services/top-scorers-five-pool.service';
import type { TsfLeagueKey } from '../src/services/top-scorers-five-scoring';

async function main() {
  const leagueKey = (process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 'laliga') as TsfLeagueKey;
  const force = process.argv.includes('--force');

  const { upserted } = await seedTopScorersFivePool(leagueKey);
  console.log(`seeded ${upserted} ${leagueKey} player(s)`);

  const outcomes = await resolveTopScorersFivePool(leagueKey, { force });
  for (const o of outcomes) {
    console.log(
      `${o.status.padEnd(10)} ${o.nameAr} -> ${o.externalPlayerId ?? '-'} ${o.matchedName ?? ''}${o.note ? `  [${o.note}]` : ''}`,
    );
  }
  const unresolved = await prisma.topScorersFivePlayer.count({ where: { leagueKey, externalPlayerId: null } });
  console.log(`unresolved remaining: ${unresolved}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
  });
