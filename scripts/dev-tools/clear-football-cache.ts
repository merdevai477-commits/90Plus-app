/**
 * Clear stale football/match Redis keys without wiping Bull queues or Socket.IO state.
 *
 * Usage:
 *   REDIS_URL=... npx ts-node --transpile-only scripts/dev-tools/clear-football-cache.ts
 *   REDIS_URL=... npx ts-node --transpile-only scripts/dev-tools/clear-football-cache.ts --today
 */

import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import { calendarTodayKey } from '../../src/utils/calendar-day-bounds.util';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;
const todayOnly = process.argv.includes('--today');

const FOOTBALL_PATTERNS = [
  'match:by_date_*',
  'football:live_matches*',
  'football:live_fixture:*',
  'football:fixture_terminal:*',
  'football:date_api:*',
  'events:*',
  'lineups:*',
  'statistics:*',
  'momentum:*',
  'details:*',
];

async function scanDelete(redis: Redis, pattern: string): Promise<number> {
  let cursor = '0';
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = nextCursor;
    if (!keys.length) continue;

    const toDelete =
      todayOnly && pattern === 'match:by_date_*'
        ? keys.filter((key) => key.endsWith(calendarTodayKey()))
        : keys;

    if (toDelete.length) {
      const pipeline = redis.pipeline();
      for (const key of toDelete) pipeline.del(key);
      await pipeline.exec();
      deleted += toDelete.length;
    }
  } while (cursor !== '0');

  return deleted;
}

async function main(): Promise<void> {
  if (!REDIS_URL) {
    console.error('REDIS_URL is required (env or .env)');
    process.exit(1);
  }

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10_000,
  });

  try {
    console.log('PING', await redis.ping());
    console.log(todayOnly ? 'Clearing today football cache keys…' : 'Clearing football cache keys…');

    let total = 0;
    for (const pattern of FOOTBALL_PATTERNS) {
      const count = await scanDelete(redis, pattern);
      if (count > 0) {
        console.log(`  ${pattern}: ${count}`);
        total += count;
      }
    }

    console.log(`Done — deleted ${total} keys.`);
  } finally {
    await redis.quit();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
