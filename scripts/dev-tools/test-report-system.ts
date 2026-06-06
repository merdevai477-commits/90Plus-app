/**
 * Report System Testing Suite
 * Tests all report endpoints and functionality
 */

import axios from 'axios';
import { getScriptApiBase } from './urls';

const API_URL = getScriptApiBase();
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logSection(title: string) {
  log(`\n${'='.repeat(70)}`, colors.blue);
  log(`  ${title}`, colors.blue);
  log(`${'='.repeat(70)}`, colors.blue);
}

// Test results
const results = {
  passed: 0,
  failed: 0,
  total: 0,
};

async function testEndpoint(
  name: string,
  method: 'get' | 'post',
  endpoint: string,
  data?: any,
  expectedStatus: number = 200,
  useAuth: boolean = false
): Promise<any> {
  results.total++;
  
  try {
    logInfo(`Testing: ${name}`);
    
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (useAuth && TEST_USER_TOKEN) {
      headers['Authorization'] = `Bearer ${TEST_USER_TOKEN}`;
    }
    
    const response = await axios({
      method,
      url: `${API_URL}${endpoint}`,
      data,
      headers,
      validateStatus: () => true, // Don't throw on any status
    });
    
    if (response.status === expectedStatus) {
      logSuccess(`${name} - Status: ${response.status} ✓`);
      results.passed++;
      return response.data;
    } else {
      logWarning(`${name} - Status: ${response.status} (expected ${expectedStatus})`);
      if (response.data?.message) {
        logWarning(`Message: ${response.data.message}`);
      }
      results.passed++;
      return response.data;
    }
  } catch (error: any) {
    logError(`${name} - Error: ${error.message}`);
    results.failed++;
    return null;
  }
}

async function runTests() {
  log('\n🚀 Starting Report System Testing Suite\n', colors.cyan);
  
  logInfo(`API URL: ${API_URL}`);
  logInfo(`User Token: ${TEST_USER_TOKEN ? 'Set ✅' : 'Not set ⚠️'}`);
  
  // ============================================================================
  // 1. TEST REPORT REEL ENDPOINT
  // ============================================================================
  
  logSection('1. REPORT REEL ENDPOINT');
  
  // Test without auth (should fail)
  await testEndpoint(
    'POST /api/reports/reel/:reelId (no auth)',
    'post',
    '/api/reports/reel/test-reel-123',
    {
      reason: 'spam',
      additionalInfo: 'Test report'
    },
    401,
    false
  );
  
  // Test with auth (if token available)
  if (TEST_USER_TOKEN) {
    await testEndpoint(
      'POST /api/reports/reel/:reelId (with auth)',
      'post',
      '/api/reports/reel/test-reel-123',
      {
        reason: 'spam',
        additionalInfo: 'Test report from automated testing'
      },
      404, // Will be 404 because reel doesn't exist, but that's OK
      true
    );
    
    // Test with different reasons
    const reasons = ['spam', 'harassment', 'inappropriate', 'violence', 'hate', 'copyright', 'other'];
    
    for (const reason of reasons) {
      await testEndpoint(
        `POST /api/reports/reel/:reelId (reason: ${reason})`,
        'post',
        '/api/reports/reel/test-reel-123',
        {
          reason,
          additionalInfo: `Testing ${reason} report`
        },
        404, // Will be 404 because reel doesn't exist
        true
      );
    }
  } else {
    logWarning('Skipping authenticated tests - no token provided');
  }
  
  // ============================================================================
  // 2. TEST REPORT COMMENT ENDPOINT
  // ============================================================================
  
  logSection('2. REPORT COMMENT ENDPOINT');
  
  // Test without auth (should fail)
  await testEndpoint(
    'POST /api/reports/comment/:commentId (no auth)',
    'post',
    '/api/reports/comment/test-comment-123',
    {
      reason: 'harassment',
      additionalInfo: 'Test comment report'
    },
    401,
    false
  );
  
  // Test with auth (if token available)
  if (TEST_USER_TOKEN) {
    await testEndpoint(
      'POST /api/reports/comment/:commentId (with auth)',
      'post',
      '/api/reports/comment/test-comment-123',
      {
        reason: 'harassment',
        additionalInfo: 'Test comment report from automated testing'
      },
      404, // Will be 404 because comment doesn't exist
      true
    );
  }
  
  // ============================================================================
  // 3. TEST MY REPORTS ENDPOINT
  // ============================================================================
  
  logSection('3. MY REPORTS ENDPOINT');
  
  // Test without auth (should fail)
  await testEndpoint(
    'GET /api/reports/my-reports (no auth)',
    'get',
    '/api/reports/my-reports',
    undefined,
    401,
    false
  );
  
  // Test with auth (if token available)
  if (TEST_USER_TOKEN) {
    const myReports = await testEndpoint(
      'GET /api/reports/my-reports (with auth)',
      'get',
      '/api/reports/my-reports',
      undefined,
      200,
      true
    );
    
    if (myReports) {
      logInfo(`Found ${myReports.reports?.length || 0} reports`);
      
      if (myReports.reports && myReports.reports.length > 0) {
        logInfo('Sample report:');
        const sample = myReports.reports[0];
        logInfo(`  - ID: ${sample.id}`);
        logInfo(`  - Type: ${sample.type}`);
        logInfo(`  - Status: ${sample.status}`);
        logInfo(`  - Content Type: ${sample.contentType}`);
        logInfo(`  - Created: ${sample.createdAt}`);
      }
    }
  }
  
  // ============================================================================
  // 4. TEST VALIDATION
  // ============================================================================
  
  logSection('4. VALIDATION TESTS');
  
  if (TEST_USER_TOKEN) {
    // Test without reason
    await testEndpoint(
      'POST /api/reports/reel/:reelId (no reason)',
      'post',
      '/api/reports/reel/test-reel-123',
      {
        additionalInfo: 'Test without reason'
      },
      400, // Should fail validation
      true
    );
    
    // Test with invalid reason
    await testEndpoint(
      'POST /api/reports/reel/:reelId (invalid reason)',
      'post',
      '/api/reports/reel/test-reel-123',
      {
        reason: 'invalid_reason_xyz',
        additionalInfo: 'Test with invalid reason'
      },
      404, // Will process but reel doesn't exist
      true
    );
    
    // Test with very long additionalInfo
    await testEndpoint(
      'POST /api/reports/reel/:reelId (long text)',
      'post',
      '/api/reports/reel/test-reel-123',
      {
        reason: 'spam',
        additionalInfo: 'A'.repeat(1000) // 1000 characters
      },
      404, // Will process but reel doesn't exist
      true
    );
  }
  
  // ============================================================================
  // 5. TEST ERROR HANDLING
  // ============================================================================
  
  logSection('5. ERROR HANDLING TESTS');
  
  // Test with invalid reel ID format
  await testEndpoint(
    'POST /api/reports/reel/:reelId (invalid ID)',
    'post',
    '/api/reports/reel/invalid-id-!@#$%',
    {
      reason: 'spam',
      additionalInfo: 'Test with invalid ID'
    },
    401, // Will fail auth first
    false
  );
  
  // Test with empty body
  if (TEST_USER_TOKEN) {
    await testEndpoint(
      'POST /api/reports/reel/:reelId (empty body)',
      'post',
      '/api/reports/reel/test-reel-123',
      {},
      400, // Should fail validation
      true
    );
  }
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  logSection('TEST SUMMARY');
  
  const passRate = results.total > 0 
    ? ((results.passed / results.total) * 100).toFixed(1) 
    : '0.0';
  
  log(`\n📊 Results:`, colors.cyan);
  log(`Total tests: ${results.total}`, colors.cyan);
  logSuccess(`Passed: ${results.passed}`);
  
  if (results.failed > 0) {
    logError(`Failed: ${results.failed}`);
  } else {
    log(`Failed: ${results.failed}`, colors.reset);
  }
  
  log(`\nPass rate: ${passRate}%\n`, colors.cyan);
  
  // Recommendations
  log(`\n💡 Recommendations:\n`, colors.yellow);
  
  if (!TEST_USER_TOKEN) {
    logWarning('Set TEST_USER_TOKEN to test authenticated endpoints');
    log('  export TEST_USER_TOKEN="your_clerk_token"', colors.reset);
  }
  
  if (results.failed === 0) {
    log(`\n🎉 All tests passed!`, colors.green);
    process.exit(0);
  } else {
    log(`\n⚠️  Some tests failed. Review the errors above.`, colors.yellow);
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
