/**
 * Bug Condition Exploration Test: Hardcoded Credentials Security Vulnerability
 * 
 * **CRITICAL - This is a Bug Condition Exploration Test**:
 * - This test MUST FAIL on unfixed code (failure confirms the bug exists)
 * - DO NOT try to fix the test or code when it fails
 * - The test encodes the expected behavior - it will verify the fix when it passes after implementation
 * - Goal: Show counterexamples that prove the vulnerability exists
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * This test explores the bug condition where:
 * - Function `globalState.login()` exists and accepts hardcoded credentials
 * - Calling `globalState.login('mahmoud_essam', 'password')` grants full access with 'diamond' user type
 * - Searching for 'mahmoud_essam' and 'password' in the code finds results
 */

/// <reference types="jest" />

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Import the globalState to test
// Note: We need to reset the module between tests to avoid state pollution
let globalState: any;

beforeEach(() => {
  // Clear module cache to get fresh instance
  jest.resetModules();
  // Re-import globalState
  globalState = require('./globalState').globalState;
});

describe('Bug Condition Exploration: Hardcoded Credentials Vulnerability', () => {
  
  /**
   * Test 1: Verify that login() function exists and accepts hardcoded credentials
   * 
   * Bug Condition: isBugCondition_HardcodedCredentials(input) where
   *   input.username == 'mahmoud_essam' AND input.password == 'password'
   *   AND globalState.login() exists
   * 
   * Expected on UNFIXED code: Test FAILS (login function exists)
   * Expected on FIXED code: Test PASSES (login function removed/disabled)
   */
  test('Property 1.1: login() function should NOT exist in globalState', () => {
    // This test will FAIL on unfixed code because login() exists
    // It will PASS on fixed code when login() is removed
    expect(globalState.login).toBeUndefined();
  });

  /**
   * Test 2: Verify that calling login() with hardcoded credentials grants access
   * 
   * Bug Condition: Calling globalState.login('mahmoud_essam', 'password')
   *   grants full access with 'diamond' user type
   * 
   * Expected on UNFIXED code: Test FAILS (login succeeds with hardcoded credentials)
   * Expected on FIXED code: Test PASSES (login function doesn't exist or fails)
   */
  test('Property 1.2: Hardcoded credentials should NOT grant access', () => {
    // Skip this test if login() doesn't exist (already fixed)
    if (typeof globalState.login !== 'function') {
      return; // Test passes - login() doesn't exist
    }

    // This will FAIL on unfixed code because login() accepts hardcoded credentials
    const loginResult = globalState.login('mahmoud_essam', 'password');
    
    // On unfixed code: loginResult will be true, userType will be 'diamond'
    // On fixed code: login() won't exist, so we won't reach here
    expect(loginResult).toBe(false); // Should NOT succeed
    expect(globalState.userType).not.toBe('diamond'); // Should NOT be diamond
    expect(globalState.isLoggedIn).toBe(false); // Should NOT be logged in
  });

  /**
   * Test 3: Property-based test - No hardcoded credentials should work
   * 
   * Uses scoped PBT approach: Tests the specific failing case to ensure reproducibility
   * 
   * Expected on UNFIXED code: Test FAILS (finds counterexample with hardcoded credentials)
   * Expected on FIXED code: Test PASSES (no credentials work)
   */
  test('Property 1.3: No username/password combination should grant access via login()', () => {
    // Skip if login() doesn't exist
    if (typeof globalState.login !== 'function') {
      return; // Test passes - login() doesn't exist
    }

    // Scoped PBT: Test the specific hardcoded credentials that are the bug
    fc.assert(
      fc.property(
        fc.constantFrom(
          { username: 'mahmoud_essam', password: 'password' }, // The actual hardcoded credentials
          { username: 'mahmoud_essam', password: 'wrong' },    // Variations
          { username: 'wrong', password: 'password' },
          { username: 'admin', password: 'admin' },
          { username: '', password: '' }
        ),
        (credentials) => {
          // Reset state before each test
          globalState.userType = 'guest';
          globalState.isLoggedIn = false;
          globalState.username = '';

          const result = globalState.login(credentials.username, credentials.password);

          // On unfixed code: The hardcoded credentials will succeed
          // On fixed code: All credentials should fail
          return result === false && 
                 globalState.userType === 'guest' && 
                 globalState.isLoggedIn === false;
        }
      ),
      { numRuns: 10 } // Run 10 times to catch the bug
    );
  });

  /**
   * Test 4: Search for hardcoded credentials in the codebase
   * 
   * Bug Condition: Searching for 'mahmoud_essam' and 'password' in the code finds results
   * 
   * Expected on UNFIXED code: Test FAILS (finds hardcoded credentials in globalState.ts)
   * Expected on FIXED code: Test PASSES (no hardcoded credentials found, except in test files)
   */
  test('Property 1.4: Hardcoded credentials should NOT exist in source code', () => {
    const globalStatePath = path.join(__dirname, 'globalState.ts');
    
    // Read the globalState.ts file
    const fileContent = fs.readFileSync(globalStatePath, 'utf-8');
    
    // Search for hardcoded username
    const hasHardcodedUsername = fileContent.includes("'mahmoud_essam'") || 
                                  fileContent.includes('"mahmoud_essam"');
    
    // Search for hardcoded password in login context
    // We look for the pattern: password === 'password' or similar
    const hasHardcodedPassword = /password\s*===?\s*['"]password['"]/.test(fileContent);
    
    // On unfixed code: These will be found (test FAILS)
    // On fixed code: These should not be found (test PASSES)
    expect(hasHardcodedUsername).toBe(false);
    expect(hasHardcodedPassword).toBe(false);
  });

  /**
   * Test 5: Verify setUserType() doesn't set hardcoded username
   * 
   * Bug Condition: setUserType() sets username to 'mahmoud_essam' automatically
   * 
   * Expected on UNFIXED code: Test FAILS (setUserType sets hardcoded username)
   * Expected on FIXED code: Test PASSES (setUserType doesn't set username)
   */
  test('Property 1.5: setUserType() should NOT set hardcoded username', () => {
    // Reset state
    globalState.userType = 'guest';
    globalState.username = '';
    globalState.isLoggedIn = false;

    // Call setUserType with 'diamond'
    globalState.setUserType('diamond');

    // On unfixed code: username will be set to 'mahmoud_essam' (test FAILS)
    // On fixed code: username should remain empty or be set properly via Clerk (test PASSES)
    expect(globalState.username).not.toBe('mahmoud_essam');
  });

  /**
   * Test 6: Verify that login() function signature doesn't exist
   * 
   * This is a code structure test to ensure the vulnerability is completely removed
   * 
   * Expected on UNFIXED code: Test FAILS (login function exists with username/password params)
   * Expected on FIXED code: Test PASSES (login function removed)
   */
  test('Property 1.6: login() function with username/password signature should NOT exist', () => {
    // Check if login exists
    if (typeof globalState.login === 'function') {
      // Check the function signature by examining its length (number of parameters)
      // The vulnerable login() has 2 parameters: username and password
      const loginFunctionLength = globalState.login.length;
      
      // On unfixed code: login exists with 2 parameters (test FAILS)
      // On fixed code: login doesn't exist (test PASSES)
      expect(loginFunctionLength).not.toBe(2);
    }
    
    // If we reach here and login doesn't exist, test passes
    expect(globalState.login).toBeUndefined();
  });
});

/**
 * Expected Test Results:
 * 
 * ON UNFIXED CODE (Current State):
 * - All tests should FAIL
 * - This confirms the vulnerability exists
 * - Counterexamples found:
 *   1. login() function exists in globalState
 *   2. login('mahmoud_essam', 'password') returns true and grants diamond access
 *   3. Hardcoded credentials found in globalState.ts
 *   4. setUserType('diamond') sets username to 'mahmoud_essam'
 * 
 * ON FIXED CODE (After Implementation):
 * - All tests should PASS
 * - This confirms the vulnerability is fixed
 * - No hardcoded credentials exist
 * - No login() function with username/password
 * - Authentication uses Clerk only
 */
