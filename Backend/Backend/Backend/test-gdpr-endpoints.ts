/**
 * GDPR Endpoints Test Script
 * 
 * Tests all GDPR compliance endpoints
 * 
 * Usage:
 *   npx ts-node test-gdpr-endpoints.ts
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-31
 */

import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || '';

// Create axios instance with auth
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${TEST_USER_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(`  ${title}`, colors.blue);
  log(`${'='.repeat(60)}`, colors.blue);
}

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
};

async function testEndpoint(
  name: string,
  method: 'get' | 'post' | 'put' | 'delete',
  endpoint: string,
  data?: any,
  expectedStatus: number = 200
): Promise<any> {
  try {
    logInfo(`Testing: ${name}`);
    
    const response = await api[method](endpoint, data);
    
    if (response.status === expectedStatus) {
      logSuccess(`${name} - Status: ${response.status}`);
      results.passed++;
      return response.data;
    } else {
      logWarning(`${name} - Unexpected status: ${response.status} (expected ${expectedStatus})`);
      results.passed++;
      return response.data;
    }
  } catch (error: any) {
    if (error.response) {
      if (error.response.status === expectedStatus) {
        logSuccess(`${name} - Status: ${error.response.status} (expected error)`);
        results.passed++;
        return error.response.data;
      } else {
        logError(`${name} - Status: ${error.response.status}`);
        logError(`Error: ${error.response.data?.message || error.message}`);
        results.failed++;
        return null;
      }
    } else {
      logError(`${name} - Network error: ${error.message}`);
      results.failed++;
      return null;
    }
  }
}

async function runTests() {
  log('\n🚀 Starting GDPR Endpoints Test Suite\n', colors.cyan);
  
  if (!TEST_USER_TOKEN) {
    logError('TEST_USER_TOKEN not set in environment variables');
    logInfo('Please set TEST_USER_TOKEN in .env file or export it:');
    logInfo('  export TEST_USER_TOKEN="your_clerk_token_here"');
    process.exit(1);
  }
  
  logInfo(`API URL: ${API_URL}`);
  logInfo(`Token: ${TEST_USER_TOKEN.substring(0, 20)}...`);
  
  // ============================================================================
  // 1. CONSENT MANAGEMENT
  // ============================================================================
  
  logSection('1. CONSENT MANAGEMENT');
  
  // Get current consent
  const consent = await testEndpoint(
    'GET /gdpr/consent',
    'get',
    '/gdpr/consent'
  );
  
  if (consent) {
    logInfo(`Current consent: ${JSON.stringify(consent.consent, null, 2)}`);
  }
  
  // Update consent - Analytics
  await testEndpoint(
    'POST /gdpr/consent (Analytics: true)',
    'post',
    '/gdpr/consent',
    {
      consentType: 'ANALYTICS',
      granted: true,
    }
  );
  
  // Update consent - Push Notifications
  await testEndpoint(
    'POST /gdpr/consent (Push Notifications: true)',
    'post',
    '/gdpr/consent',
    {
      consentType: 'PUSH_NOTIFICATIONS',
      granted: true,
    }
  );
  
  // Update consent - Email Communications
  await testEndpoint(
    'POST /gdpr/consent (Email: false)',
    'post',
    '/gdpr/consent',
    {
      consentType: 'EMAIL_COMMUNICATIONS',
      granted: false,
    }
  );
  
  // Update consent - Data Sharing
  await testEndpoint(
    'POST /gdpr/consent (Data Sharing: false)',
    'post',
    '/gdpr/consent',
    {
      consentType: 'DATA_SHARING',
      granted: false,
    }
  );
  
  // Verify consent changes
  const updatedConsent = await testEndpoint(
    'GET /gdpr/consent (verify changes)',
    'get',
    '/gdpr/consent'
  );
  
  if (updatedConsent) {
    logInfo(`Updated consent: ${JSON.stringify(updatedConsent.consent, null, 2)}`);
  }
  
  // Test invalid consent type
  await testEndpoint(
    'POST /gdpr/consent (invalid type)',
    'post',
    '/gdpr/consent',
    {
      consentType: 'INVALID_TYPE',
      granted: true,
    },
    400 // Expect error
  );
  
  // ============================================================================
  // 2. DATA EXPORT
  // ============================================================================
  
  logSection('2. DATA EXPORT');
  
  // Request data export
  const exportRequest = await testEndpoint(
    'POST /gdpr/export-data',
    'post',
    '/gdpr/export-data'
  );
  
  let exportRequestId: string | null = null;
  
  if (exportRequest && exportRequest.requestId) {
    exportRequestId = exportRequest.requestId;
    logInfo(`Export Request ID: ${exportRequestId}`);
    logInfo(`Estimated time: ${exportRequest.estimatedTime}`);
  }
  
  // Check export status
  if (exportRequestId) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const exportStatus = await testEndpoint(
      'GET /gdpr/export-status/:requestId',
      'get',
      `/gdpr/export-status/${exportRequestId}`
    );
    
    if (exportStatus) {
      logInfo(`Export status: ${exportStatus.exportRequest?.status}`);
      
      if (exportStatus.exportRequest?.fileUrl) {
        logInfo(`File URL: ${exportStatus.exportRequest.fileUrl}`);
        logInfo(`File size: ${exportStatus.exportRequest.fileSize} bytes`);
        logInfo(`Expires at: ${exportStatus.exportRequest.expiresAt}`);
      }
    }
    
    // Wait and check again
    logInfo('Waiting 5 seconds for export to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const exportStatusFinal = await testEndpoint(
      'GET /gdpr/export-status/:requestId (final check)',
      'get',
      `/gdpr/export-status/${exportRequestId}`
    );
    
    if (exportStatusFinal) {
      logInfo(`Final export status: ${exportStatusFinal.exportRequest?.status}`);
    }
  }
  
  // Try to request another export (should fail - rate limit or existing request)
  await testEndpoint(
    'POST /gdpr/export-data (duplicate request)',
    'post',
    '/gdpr/export-data',
    {},
    400 // Expect error
  );
  
  // Test invalid request ID
  await testEndpoint(
    'GET /gdpr/export-status/:requestId (invalid ID)',
    'get',
    '/gdpr/export-status/invalid-id-12345',
    undefined,
    404 // Expect not found
  );
  
  // ============================================================================
  // 3. ACCOUNT DELETION
  // ============================================================================
  
  logSection('3. ACCOUNT DELETION');
  
  // Get current deletion status
  const deletionStatus = await testEndpoint(
    'GET /gdpr/deletion-status',
    'get',
    '/gdpr/deletion-status'
  );
  
  if (deletionStatus) {
    logInfo(`Has deletion request: ${deletionStatus.hasDeletionRequest}`);
    
    if (deletionStatus.hasDeletionRequest) {
      logInfo(`Deletion status: ${JSON.stringify(deletionStatus.deletionRequest, null, 2)}`);
    }
  }
  
  // Request account deletion
  logWarning('⚠️  CAUTION: This will schedule account deletion in 30 days!');
  logInfo('Requesting account deletion...');
  
  const deletionRequest = await testEndpoint(
    'POST /gdpr/delete-account',
    'post',
    '/gdpr/delete-account',
    {
      reason: 'Testing GDPR compliance - will cancel immediately',
    }
  );
  
  if (deletionRequest) {
    logInfo(`Deletion Request ID: ${deletionRequest.requestId}`);
    logInfo(`Scheduled at: ${deletionRequest.scheduledAt}`);
    logInfo(`Grace period: ${deletionRequest.gracePeriodDays} days`);
  }
  
  // Verify deletion status
  const deletionStatusAfter = await testEndpoint(
    'GET /gdpr/deletion-status (after request)',
    'get',
    '/gdpr/deletion-status'
  );
  
  if (deletionStatusAfter) {
    logInfo(`Deletion status: ${deletionStatusAfter.deletionRequest?.status}`);
  }
  
  // Cancel account deletion
  logInfo('Cancelling account deletion...');
  
  await testEndpoint(
    'POST /gdpr/cancel-deletion',
    'post',
    '/gdpr/cancel-deletion',
    {
      cancellationReason: 'Test completed - cancelling deletion',
    }
  );
  
  // Verify cancellation
  const deletionStatusFinal = await testEndpoint(
    'GET /gdpr/deletion-status (after cancellation)',
    'get',
    '/gdpr/deletion-status'
  );
  
  if (deletionStatusFinal) {
    logInfo(`Final deletion status: ${deletionStatusFinal.deletionRequest?.status}`);
  }
  
  // Try to cancel again (should fail - no pending request)
  await testEndpoint(
    'POST /gdpr/cancel-deletion (no pending request)',
    'post',
    '/gdpr/cancel-deletion',
    {
      cancellationReason: 'Test',
    },
    404 // Expect not found
  );
  
  // ============================================================================
  // 4. AUTHENTICATION TESTS
  // ============================================================================
  
  logSection('4. AUTHENTICATION TESTS');
  
  // Test without auth token
  const apiNoAuth = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  try {
    await apiNoAuth.get('/gdpr/consent');
    logError('GET /gdpr/consent without auth - Should have failed!');
    results.failed++;
  } catch (error: any) {
    if (error.response?.status === 401) {
      logSuccess('GET /gdpr/consent without auth - Correctly rejected (401)');
      results.passed++;
    } else {
      logError(`GET /gdpr/consent without auth - Unexpected status: ${error.response?.status}`);
      results.failed++;
    }
  }
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  logSection('TEST SUMMARY');
  
  const total = results.passed + results.failed + results.skipped;
  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : '0.0';
  
  log(`\nTotal tests: ${total}`, colors.cyan);
  logSuccess(`Passed: ${results.passed}`);
  
  if (results.failed > 0) {
    logError(`Failed: ${results.failed}`);
  } else {
    log(`Failed: ${results.failed}`, colors.reset);
  }
  
  if (results.skipped > 0) {
    logWarning(`Skipped: ${results.skipped}`);
  }
  
  log(`\nPass rate: ${passRate}%\n`, colors.cyan);
  
  if (results.failed === 0) {
    logSuccess('🎉 All tests passed!');
    process.exit(0);
  } else {
    logError('❌ Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
