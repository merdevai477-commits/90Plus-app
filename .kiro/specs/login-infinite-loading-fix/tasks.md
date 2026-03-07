# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Sync Operation Timeout
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: backend responses >15 seconds or silent failures
  - Test that `syncUserWithBackend` times out after 15 seconds when backend is slow (>30s response) or fails silently
  - Test that loading screen is hidden and error message is shown after timeout
  - Test assertions match Expected Behavior: timeout fires within 16 seconds (15s + 1s margin), loading screen hidden, error message displayed
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: loading screen stays visible for 90+ seconds, no timeout error shown
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Successful Authentication Flow
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for successful login flows (email/password, OAuth with quick backend response <2s)
  - Observe: User navigates to home/onboarding screen, user data populated in globalState, loading screen hidden
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test that successful email/password login with quick sync (<2s) navigates correctly
  - Test that OAuth login (Google/Apple) with quick sync produces same user data population
  - Test that new user flow navigates to onboarding, existing user to home screen
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix for login infinite loading bug

  - [x] 3.1 Implement timeout mechanism in AuthService
    - Add overall 15-second timeout wrapper using Promise.race() in `syncUserWithBackend`
    - Create custom error classes: `SyncTimeoutError`, `SyncNetworkError`, `SyncServerError`
    - Improve error propagation: throw specific errors instead of returning null
    - Reduce retry delays from 1000ms to 500ms
    - Add timeout to debounce logic: skip debounce if close to timeout threshold
    - Add response data validation: check for required fields (id, username)
    - _Bug_Condition: isBugCondition(input) where (syncOperation.isPending() OR syncOperation.hasFailedSilently()) AND (currentTime - startTime) > 15000 AND loadingScreenIsVisible() AND NOT errorMessageShown()_
    - _Expected_Behavior: Timeout fires within 16 seconds, loading screen hidden, clear error message shown with retry option_
    - _Preservation: Successful authentication flows (email/password, OAuth) with quick backend response (<15s) must produce identical behavior to original implementation_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Update UI error handling in auth/index.tsx
    - Add try-catch with specific timeout error handling
    - Improve error messages based on error type (timeout, network, server)
    - Add finally block to ensure `setShowLoadingScreen(false)` always executes
    - Remove redundant local retry logic (let AuthService handle retries)
    - Add Arabic error messages: "انتهت مهلة الاتصال. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى."
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Sync Operation Timeout
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify timeout fires within 16 seconds for slow/failing backend responses
    - Verify loading screen is hidden and error message is shown
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Successful Authentication Flow
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm successful login flows still navigate correctly
    - Confirm user data population unchanged
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
