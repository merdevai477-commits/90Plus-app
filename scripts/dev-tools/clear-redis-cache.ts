/**
 * Clear Redis Cache Script
 * 
 * Clears all or specific Redis cache keys
 */

import Redis from 'ioredis';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error('❌ REDIS_URL not found in .env file');
  process.exit(1);
}

async function clearCache() {
  const redis = new Redis(REDIS_URL!, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
  });

  try {
    console.log('🔍 Connecting to Redis...');
    
    // Get all keys
    const keys = await redis.keys('*');
    console.log(`📊 Found ${keys.length} keys in Redis`);

    if (keys.length === 0) {
      console.log('✅ Redis is already empty');
      await redis.quit();
      return;
    }

    // Show key patterns
    const patterns = new Map<string, number>();
    keys.forEach(key => {
      const pattern = key.split(':')[0];
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });

    console.log('\n📋 Key patterns:');
    patterns.forEach((count, pattern) => {
      console.log(`  - ${pattern}: ${count} keys`);
    });

    // Ask for confirmation (in production, you'd want user input)
    console.log('\n🗑️  Clearing all keys...');
    
    // Delete all keys
    const pipeline = redis.pipeline();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();

    console.log(`✅ Successfully cleared ${keys.length} keys from Redis`);

    // Verify
    const remainingKeys = await redis.keys('*');
    console.log(`📊 Remaining keys: ${remainingKeys.length}`);

    await redis.quit();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    await redis.quit();
    process.exit(1);
  }
}

clearCache();
