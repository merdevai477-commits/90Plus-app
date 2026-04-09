/**
 * Test script for Full-Text Search optimization
 * 
 * Usage:
 * npx ts-node test-search-fts.ts
 */

import { UserSearchService } from './src/services/user-search.service';
import { logger } from './src/utils/logger';

async function testSearch() {
  console.log('🔍 Testing Full-Text Search...\n');

  // Test 1: English search
  console.log('Test 1: English search for "mohamed"');
  const start1 = Date.now();
  const results1 = await UserSearchService.searchUsers({
    query: 'mohamed',
    limit: 10,
  });
  const time1 = Date.now() - start1;
  console.log(`✅ Found ${results1.length} results in ${time1}ms`);
  console.log('Top 3 results:', results1.slice(0, 3).map(u => ({
    username: u.username,
    displayName: u.displayName,
    isVerified: u.isVerified,
    level: u.level,
  })));
  console.log('');

  // Test 2: Arabic search
  console.log('Test 2: Arabic search for "محمد"');
  const start2 = Date.now();
  const results2 = await UserSearchService.searchUsers({
    query: 'محمد',
    limit: 10,
  });
  const time2 = Date.now() - start2;
  console.log(`✅ Found ${results2.length} results in ${time2}ms`);
  console.log('');

  // Test 3: Partial match
  console.log('Test 3: Partial match for "moh"');
  const start3 = Date.now();
  const results3 = await UserSearchService.searchUsers({
    query: 'moh',
    limit: 10,
  });
  const time3 = Date.now() - start3;
  console.log(`✅ Found ${results3.length} results in ${time3}ms`);
  console.log('');

  // Test 4: Autocomplete
  console.log('Test 4: Autocomplete for "ah"');
  const start4 = Date.now();
  const results4 = await UserSearchService.autocomplete('ah');
  const time4 = Date.now() - start4;
  console.log(`✅ Found ${results4.length} autocomplete suggestions in ${time4}ms`);
  console.log('Suggestions:', results4.map(u => u.username));
  console.log('');

  // Test 5: Search stats
  console.log('Test 5: Search stats for "mohamed"');
  const start5 = Date.now();
  const stats = await UserSearchService.getSearchStats('mohamed');
  const time5 = Date.now() - start5;
  console.log(`✅ Stats retrieved in ${time5}ms`);
  console.log('Stats:', stats);
  console.log('');

  // Test 6: Pagination
  console.log('Test 6: Pagination (offset=10)');
  const start6 = Date.now();
  const results6 = await UserSearchService.searchUsers({
    query: 'ahmed',
    limit: 10,
    offset: 10,
  });
  const time6 = Date.now() - start6;
  console.log(`✅ Found ${results6.length} results in ${time6}ms`);
  console.log('');

  // Performance summary
  console.log('📊 Performance Summary:');
  console.log(`Average query time: ${Math.round((time1 + time2 + time3 + time4 + time5 + time6) / 6)}ms`);
  console.log('');

  console.log('✅ All tests completed successfully!');
}

// Run tests
testSearch()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    logger.error('Test error:', error);
    process.exit(1);
  });
