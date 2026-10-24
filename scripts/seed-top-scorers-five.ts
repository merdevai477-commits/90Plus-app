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
import {
  getTsfLeagueConfig,
  TSF_EGYPT_POOL_KEY,
  type TsfLeagueKey,
} from '../src/services/top-scorers-five-scoring';

async function main() {
  const raw = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 'laliga';
  const force = process.argv.includes('--force');
  const leagueKey = raw as TsfLeagueKey | typeof TSF_EGYPT_POOL_KEY;
  const cfg = getTsfLeagueConfig(leagueKey);
  const poolKey =
    leagueKey === TSF_EGYPT_POOL_KEY || cfg?.tournament === 'egypt' ? TSF_EGYPT_POOL_KEY : leagueKey;

  const { upserted } = await seedTopScorersFivePool(leagueKey);
  console.log(`seeded ${upserted} ${poolKey} player(s)`);

  const outcomes = await resolveTopScorersFivePool(leagueKey, { force });
  for (const o of outcomes) {
    console.log(
      `${o.status.padEnd(10)} ${o.nameAr} -> ${o.externalPlayerId ?? '-'} ${o.matchedName ?? ''}${o.note ? `  [${o.note}]` : ''}`,
    );
  }
  const unresolved = await prisma.topScorersFivePlayer.count({
    where: { leagueKey: poolKey, externalPlayerId: null },
  });
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
