/**
 * Populate team_player from API-Football squads for cached clubs (quiz entity dataset).
 *
 * Usage:
 *   npm run seed:quiz-rosters
 *   npx ts-node scripts/seed-quiz-team-players.ts --limit=30
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { syncQuizRostersFromCachedTeams } from '../src/services/quiz-team-roster-sync.service';
import { buildQuizEntityDataset } from '../src/services/quiz-entity-dataset.service';

function parseLimit(): number {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  if (!arg) return 25;
  const n = Number(arg.split('=')[1]);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 80) : 25;
}

async function main() {
  const limit = parseLimit();
  console.log(`Seeding quiz rosters from up to ${limit} CachedTeam row(s)...`);

  const { synced, total } = await syncQuizRostersFromCachedTeams(limit);
  const teamPlayerCount = await prisma.teamPlayer.count();
  const dataset = await buildQuizEntityDataset();

  console.log(`Teams processed: ${synced}/${total}`);
  console.log(`TeamPlayer rows: ${teamPlayerCount}`);
  if (dataset.ok) {
    console.log(
      `Dataset OK — players=${dataset.dataset.players.length} clubs=${dataset.dataset.clubs.length} stadiums=${dataset.dataset.stadiums.length}`,
    );
  } else {
    console.warn(
      `Dataset still insufficient — players=${dataset.counts.players} clubs=${dataset.counts.clubs} stadiums=${dataset.counts.stadiums}`,
    );
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRedis();
    await prisma.$disconnect();
  });
