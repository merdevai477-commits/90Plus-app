import { PrismaClient } from '@prisma/client';
import { getRedisClient } from '../src/lib/redis';

const prisma = new PrismaClient();

async function run() {
  console.log('--- RESET DAILY QUIZ SCRIPT ---');

  if (process.env.CONFIRM_RESET_DAILY_QUIZ !== 'true') {
    console.error('Error: You must set CONFIRM_RESET_DAILY_QUIZ=true to run this script.');
    process.exit(1);
  }

  // Use date passed from CLI (e.g. 2026-05-23), otherwise use current UTC date
  let dateStr = process.argv[2];
  if (!dateStr) {
    const today = new Date();
    dateStr = today.toISOString().split('T')[0];
  }

  console.log(`Resetting Quiz data for date: ${dateStr}`);

  try {
    const parsedDate = new Date(dateStr);
    
    // Delete user sessions for this pack date
    const sessionRes = await prisma.userDailyQuizSession.deleteMany({
      where: {
        packDate: parsedDate
      }
    });
    console.log(`✅ Deleted ${sessionRes.count} UserDailyQuizSession records.`);

    // Delete the generated daily packs
    const packRes = await prisma.dailyQuizPack.deleteMany({
      where: {
        packDate: parsedDate
      }
    });
    console.log(`✅ Deleted ${packRes.count} DailyQuizPack records.`);

    // Delete from Redis
    const redis = getRedisClient();
    if (redis) {
      const keys = [`quiz:daily:${dateStr}:ar`, `quiz:daily:${dateStr}:en`];
      const deletedCount = await redis.del(...keys);
      console.log(`✅ Deleted ${deletedCount} Redis cache keys (${keys.join(', ')}).`);
    } else {
      console.warn('⚠️ Redis client not available to clear cache.');
    }

    console.log('🎉 Reset complete. Run warmup again to regenerate cleanly.');
  } catch (error) {
    console.error('❌ Error during reset:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

run();
