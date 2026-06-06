/**
 * Populate cached leagues from API-Football into PostgreSQL.
 * Usage: DATABASE_URL="..." npx tsx scripts/warm-league-cache.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const { leagueCacheService } = await import('../src/services/league-cache.service');
  const leagues = await leagueCacheService.getAllLeagues();
  console.log(`League cache warmed: ${leagues.length} leagues`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
