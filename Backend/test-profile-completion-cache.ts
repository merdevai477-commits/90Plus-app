/**
 * Test script for Profile Completion Cache optimization
 * 
 * Usage:
 * npx ts-node test-profile-completion-cache.ts
 */

import { ProfileCompletionService } from './src/services/profile-completion.service';
import { ProfileCompletionCacheHelper } from './src/services/cache-helpers.service';
import { logger } from './src/utils/logger';

async function testProfileCompletionCache() {
  console.log('🧪 Testing Profile Completion Cache...\n');

  // Test user ID (replace with a real user ID from your database)
  const testUserId = 'user_test123';

  try {
    // Test 1: First request (cache miss)
    console.log('Test 1: First request (should be cache MISS)');
    const start1 = Date.now();
    const status1 = await ProfileCompletionService.getCompletionStatus(testUserId);
    const time1 = Date.now() - start1;
    console.log(`✅ Completion: ${status1.percentage}% in ${time1}ms`);
    console.log(`   Steps: ${status1.completedSteps}/${status1.totalSteps}`);
    console.log(`   Can upload video: ${status1.canUploadVideo}`);
    console.log('');

    // Test 2: Second request (cache hit)
    console.log('Test 2: Second request (should be cache HIT)');
    const start2 = Date.now();
    const status2 = await ProfileCompletionService.getCompletionStatus(testUserId);
    const time2 = Date.now() - start2;
    console.log(`✅ Completion: ${status2.percentage}% in ${time2}ms`);
    console.log(`   Performance improvement: ${Math.round(time1 / time2)}x faster`);
    console.log('');

    // Test 3: Multiple requests (cache hits)
    console.log('Test 3: 10 consecutive requests (all should be cache HITs)');
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await ProfileCompletionService.getCompletionStatus(testUserId);
      times.push(Date.now() - start);
    }
    const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    console.log(`✅ Average time: ${avgTime}ms`);
    console.log(`   Min: ${Math.min(...times)}ms, Max: ${Math.max(...times)}ms`);
    console.log('');

    // Test 4: Cache invalidation
    console.log('Test 4: Cache invalidation');
    await ProfileCompletionService.invalidateCache(testUserId);
    console.log('✅ Cache invalidated');
    console.log('');

    // Test 5: Request after invalidation (cache miss)
    console.log('Test 5: Request after invalidation (should be cache MISS)');
    const start5 = Date.now();
    const status5 = await ProfileCompletionService.getCompletionStatus(testUserId);
    const time5 = Date.now() - start5;
    console.log(`✅ Completion: ${status5.percentage}% in ${time5}ms`);
    console.log('');

    // Test 6: Force recalculation
    console.log('Test 6: Force recalculation (bypasses cache)');
    const start6 = Date.now();
    const status6 = await ProfileCompletionService.getCompletionStatus(testUserId, true);
    const time6 = Date.now() - start6;
    console.log(`✅ Completion: ${status6.percentage}% in ${time6}ms`);
    console.log('');

    // Test 7: Recalculate method
    console.log('Test 7: Recalculate method (invalidates + recalculates)');
    const start7 = Date.now();
    const status7 = await ProfileCompletionService.recalculate(testUserId);
    const time7 = Date.now() - start7;
    console.log(`✅ Completion: ${status7.percentage}% in ${time7}ms`);
    console.log('');

    // Test 8: Cache statistics
    console.log('Test 8: Cache statistics');
    const cacheCount = await ProfileCompletionCacheHelper.count();
    const cacheKeys = await ProfileCompletionCacheHelper.getAll();
    console.log(`✅ Cached entries: ${cacheCount}`);
    console.log(`   Keys: ${cacheKeys.slice(0, 5).join(', ')}${cacheKeys.length > 5 ? '...' : ''}`);
    console.log('');

    // Test 9: Load test (100 requests)
    console.log('Test 9: Load test (100 requests)');
    const loadTestStart = Date.now();
    const loadTestTimes: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await ProfileCompletionService.getCompletionStatus(testUserId);
      loadTestTimes.push(Date.now() - start);
    }
    
    const loadTestTotal = Date.now() - loadTestStart;
    const loadTestAvg = Math.round(loadTestTimes.reduce((a, b) => a + b, 0) / loadTestTimes.length);
    const loadTestP50 = loadTestTimes.sort((a, b) => a - b)[Math.floor(loadTestTimes.length * 0.5)];
    const loadTestP95 = loadTestTimes.sort((a, b) => a - b)[Math.floor(loadTestTimes.length * 0.95)];
    const loadTestP99 = loadTestTimes.sort((a, b) => a - b)[Math.floor(loadTestTimes.length * 0.99)];
    
    console.log(`✅ 100 requests completed in ${loadTestTotal}ms`);
    console.log(`   Average: ${loadTestAvg}ms`);
    console.log(`   P50: ${loadTestP50}ms`);
    console.log(`   P95: ${loadTestP95}ms`);
    console.log(`   P99: ${loadTestP99}ms`);
    console.log('');

    // Performance summary
    console.log('📊 Performance Summary:');
    console.log(`   First request (cache miss): ${time1}ms`);
    console.log(`   Second request (cache hit): ${time2}ms`);
    console.log(`   Performance improvement: ${Math.round(time1 / time2)}x faster`);
    console.log(`   Average cache hit time: ${avgTime}ms`);
    console.log(`   Load test average: ${loadTestAvg}ms`);
    console.log('');

    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run tests
testProfileCompletionCache()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    logger.error('Test error:', error);
    process.exit(1);
  });
