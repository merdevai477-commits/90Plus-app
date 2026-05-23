import { PrismaClient } from '@prisma/client';
import { getRedisClient } from '../src/lib/redis';

const prisma = new PrismaClient();

const DATE_ARG_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parsePackDate(dateStr: string): Date {
  if (!DATE_ARG_PATTERN.test(dateStr)) {
    throw new Error(`Invalid date format "${dateStr}". Use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date "${dateStr}".`);
  }
  return parsed;
}

async function run() {
  console.log('--- RESET DAILY QUIZ SCRIPT ---');

  if (process.env.CONFIRM_RESET_DAILY_QUIZ !== 'true') {
    console.error('Error: You must set CONFIRM_RESET_DAILY_QUIZ=true to run this script.');
    process.exit(1);
  }

  let dateStr = process.argv[2];
  if (!dateStr) {
    dateStr = new Date().toISOString().split('T')[0];
  }

  console.log(`Resetting Quiz data for date: ${dateStr}`);

  try {
    const parsedDate = parsePackDate(dateStr);

    const sessionRes = await prisma.userDailyQuizSession.deleteMany({
      where: {
        packDate: parsedDate,
      },
    });
    console.log(`Deleted ${sessionRes.count} UserDailyQuizSession records.`);

    const packRes = await prisma.dailyQuizPack.deleteMany({
      where: {
        packDate: parsedDate,
      },
    });
    console.log(`Deleted ${packRes.count} DailyQuizPack records.`);

    const redis = getRedisClient();
    if (redis) {
      try {
        const keys = [`quiz:daily:${dateStr}:ar`, `quiz:daily:${dateStr}:en`];
        const deletedCount = await redis.del(...keys);
        console.log(`Deleted ${deletedCount} Redis cache keys (${keys.join(', ')}).`);
      } catch (redisErr) {
        console.warn('Redis cache clear failed (DB reset still applied):', redisErr);
      }
    } else {
      console.warn('Redis client not available to clear cache.');
    }

    console.log('Reset complete. Run warmup again to regenerate cleanly.');
  } catch (error) {
    console.error('Error during reset:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

run();
