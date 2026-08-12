/**
 * Populate team_player from API-Football squads for cached clubs (quiz entity dataset).
 *
 * Usage:
 *   npm run seed:quiz-rosters
 *   npx ts-node scripts/seed-quiz-team-players.ts --limit=30
 *   npx ts-node scripts/seed-quiz-team-players.ts --force   # ignore the 30-day TTL
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
  const force = process.argv.includes('--force');
  console.log(
    `Seeding quiz rosters from up to ${limit} CachedTeam row(s)${force ? ' (forced — ignoring 30-day TTL)' : ''}...`,
  );

  const { synced, fresh, empty, total, quotaBlocked } = await syncQuizRostersFromCachedTeams(
    limit,
    { force },
  );
  const teamPlayerCount = await prisma.teamPlayer.count();

  // A reseed changes what generation can build from, so the "today failed"
  // back-off must not outlive it.
  const { clearQuestionsGenerationBackoff } = await import(
    '../src/services/questions-challenges.service'
  );
  await clearQuestionsGenerationBackoff();

  const dataset = await buildQuizEntityDataset();

  if (quotaBlocked) {
    console.warn(
      'API-Football is unavailable (daily quota exhausted or account suspended) — ' +
        'the run stopped early. Rerun after the quota resets (00:00 UTC).',
    );
  }
  console.log(`Teams that gained players: ${synced}/${total}`);
  console.log(`Teams still inside the 30-day roster TTL (no API call): ${fresh}`);
  console.log(`Teams the API reported with no squad: ${empty}`);
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
