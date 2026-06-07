/**
 * Manual test harness for the player-stats feature.
 *
 * Usage:
 *   ts-node scripts/testPlayerStats.ts "<name>" [stat] [--detect-only] [--no-cache]
 *
 * Examples:
 *   ts-node scripts/testPlayerStats.ts "محمد صلاح" goals
 *   ts-node scripts/testPlayerStats.ts "Salah" --detect-only
 *   ts-node scripts/testPlayerStats.ts "صلح" goals --no-cache
 *
 * Flags:
 *   --detect-only   Only run name resolution (no API / cache calls).
 *   --no-cache      Bypass the Postgres cache (always hits the API).
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { footballService } from '../src/services/football.service';
import { resolvePlayerName } from '../src/services/player-name-resolver.service';
import { getCachedOrFetch } from '../src/services/player-stats-cache.service';
import { fetchPlayerStatsRow } from '../src/services/chat-football-tools.service';

function currentSeason(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? year : year - 1;
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const positional = argv.filter((a) => !a.startsWith('--'));

  const name = positional[0];
  const statType = positional[1] ?? 'general';
  const detectOnly = flags.has('--detect-only');
  const noCache = flags.has('--no-cache');

  if (!name) {
    console.error('Usage: ts-node scripts/testPlayerStats.ts "<name>" [stat] [--detect-only] [--no-cache]');
    process.exit(1);
  }

  console.log('═'.repeat(60));
  console.log(`Query        : "${name}"`);
  console.log(`Stat type    : ${statType}`);
  console.log(`Detect only  : ${detectOnly}`);
  console.log(`No cache     : ${noCache}`);
  console.log(`API config'd : ${footballService.isConfigured()}`);
  console.log('═'.repeat(60));

  // ─── 1. Name resolution ─────────────────────────────────────────────────────
  const resolved = await resolvePlayerName(name);
  console.log('\n▶ Resolution:');
  if (resolved) {
    console.log(`   english     : ${resolved.english}`);
    console.log(`   arabic      : ${resolved.arabic ?? '—'}`);
    console.log(`   apiPlayerId : ${resolved.apiPlayerId ?? '—'}`);
    console.log(`   source      : ${resolved.source}`);
  } else {
    console.log('   (no resolution — not a usable name)');
  }

  if (detectOnly) {
    return;
  }

  // ─── 2. Stats fetch (through cache unless --no-cache) ───────────────────────
  const t0 = Date.now();
  const result = await getCachedOrFetch({
    playerName: resolved?.english ?? name,
    statType,
    competition: null,
    season: String(currentSeason()),
    questionAsked: `${name} ${statType}`,
    noCache,
    fetcher: () => fetchPlayerStatsRow(name),
  });
  const elapsed = Date.now() - t0;

  console.log('\n▶ Cache / fetch:');
  if (!result) {
    console.log('   (no stats found)');
    return;
  }
  console.log(`   cached      : ${result.cached}`);
  console.log(`   apiPlayerId : ${result.apiPlayerId ?? '—'}`);
  console.log(`   expiresAt   : ${result.expiresAt.toISOString()}`);
  console.log(`   elapsed     : ${elapsed}ms`);

  console.log('\n▶ Injected context preview:');
  console.log('─'.repeat(60));
  console.log(result.aiResponse);
  console.log('─'.repeat(60));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    // Redis + keep-alive timers keep the event loop alive; exit explicitly.
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ testPlayerStats failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
