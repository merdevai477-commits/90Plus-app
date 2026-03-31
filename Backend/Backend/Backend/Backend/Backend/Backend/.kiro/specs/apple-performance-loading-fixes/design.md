# Apple Performance & Loading Fixes - Bugfix Design

## Overview

The 90Plus app experiences critical performance and loading failures on iPad devices during Apple Review, manifesting as 500 API errors, database connection pool exhaustion, cache failures, and UI freezing. The root causes include: (1) database connection pool limits being exceeded under load, (2) missing graceful error handling for cache misses and external service failures, (3) frontend timeout configurations too aggressive for production latency, (4) lack of circuit breaker patterns for failing services, and (5) insufficient error recovery mechanisms. The fix strategy involves implementing robust connection pooling with queue management, adding comprehensive error boundaries with retry logic, optimizing cache fallback strategies, implementing user-friendly error messages with recovery actions, and adding performance monitoring to detect issues proactively.

## Glossary

- **Bug_Condition (C)**: The condition that triggers performance/loading failures - when API requests fail with 500 errors, database connections are exhausted, cache misses occur without fallback, or UI freezes during loading
- **Property (P)**: The desired behavior - API requests complete successfully within 2 seconds, database queries execute with proper connection management, cache misses gracefully fall back to source data, and UI remains responsive during all operations
- **Preservation**: Existing functionality that works correctly (successful API calls, proper authentication, working features on iPhone, stable WebSocket connections) must remain unchanged
- **Connection Pool**: Limited set of database connections (default 5 on Railway/Neon free tier) shared across all requests
- **Connection Pool Exhaustion**: When all available database connections are in use, causing new requests to fail with P2037 or "too many clients" errors
- **Cache Miss**: When requested data is not found in Redis cache, requiring fallback to source (database or external API)
- **Circuit Breaker**: Pattern that prevents cascading failures by temporarily blocking requests to failing services
- **Graceful Degradation**: System continues functioning with reduced capability when components fail
- **Retry with Exponential Backoff**: Retry failed operations with increasing delays (500ms, 1s, 2s, etc.)
- **Request Timeout**: Maximum time to wait for API response before considering it failed (currently 30s)
- **Keep-Alive**: Mechanism to maintain database connections and prevent idle disconnections

## Bug Details

### Fault Condition

The bug manifests when users access core features (matches, profiles, reels) on iPad devices, particularly under moderate load or when external services experience latency. The system fails due to multiple interconnected issues: database connection pool exhaustion (P2037 errors), Redis cache failures without fallback, aggressive frontend timeouts causing premature request cancellation, missing error boundaries allowing crashes to propagate, and lack of retry logic for transient failures.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type APIRequest | DatabaseQuery | CacheOperation
  OUTPUT: boolean
  
  RETURN (input.type == 'API_REQUEST' AND input.statusCode == 500)
         OR (input.type == 'DB_QUERY' AND input.error.code IN ['P2037', 'P1001', 'P1002'])
         OR (input.type == 'DB_QUERY' AND input.error.message CONTAINS 'too many clients')
         OR (input.type == 'CACHE_OPERATION' AND input.cacheMiss == true AND input.fallbackFailed == true)
         OR (input.type == 'API_REQUEST' AND input.responseTime > 2000)
         OR (input.type == 'UI_OPERATION' AND input.freezing == true)
         OR (input.type == 'API_REQUEST' AND input.timedOut == true)
END FUNCTION
```

### Examples

- **Matches Screen 500 Error**: User opens matches tab → API call to `/api/football/fixtures` → Database query for user predictions → Connection pool exhausted (5/5 connections in use) → Query fails with P2037 → Controller catches error but returns generic 500 → Frontend displays "API_ERROR: API request failed: 500 API returned errors"

- **Profile Loading Failure**: User navigates to profile → API call to `/api/profile/username` → Redis cache miss → Fallback to database → Database connection timeout (20s) → No retry logic → Returns 500 error → Frontend shows loading spinner indefinitely

- **Reels Freezing**: User scrolls reels → Multiple concurrent API calls for video metadata → Each call holds database connection → Connection pool exhausted → New requests queue up → Frontend timeout (30s) triggers → Requests cancelled → UI freezes waiting for responses → User sees blank screen

- **Cache Miss Cascade**: Popular match data expires from Redis → 50 concurrent users request same match → All 50 requests hit database simultaneously → Connection pool (5 connections) exhausted immediately → 45 requests fail with "too many clients" → Frontend receives 500 errors → Users see error messages

- **iPad Specific Issue**: iPad Air with faster network → Sends requests more aggressively → Multiple tabs/features loaded simultaneously → Backend overwhelmed with concurrent connections → Connection pool exhausted → Subsequent requests fail → App appears broken

### Examples

- **Matches Screen 500 Error**: User opens matches tab → Frontend calls `/api/football/fixtures` → Backend queries database for user predictions → All 5 database connections in use → New query waits in queue → 10-second pool timeout expires → Query fails with P2037 "too many clients" → Controller's generic error handler catches exception → Returns `{ error: 'E010', message: 'Internal server error' }` with 500 status → Frontend displays "API_ERROR: API request failed: 500 API returned errors"

- **Profile Loading Failure**: User taps profile → Frontend calls `/api/profile/johndoe` → Backend checks Redis cache → Cache miss (data expired) → Attempts database query → Database connection takes 15s to establish (network latency) → Connection timeout (20s) not reached but query slow → No retry logic → Returns data after 18s → Frontend timeout (30s) still waiting → Eventually succeeds but user already navigated away → Appears as loading failure

- **Reels Freezing**: User scrolls reels feed → Frontend loads 10 reels simultaneously → Each reel triggers API call to `/api/reels/{id}` → Each call opens database connection for likes/comments count → 10 connections requested, only 5 available → 5 requests succeed, 5 wait in queue → Queue timeout (10s) expires for waiting requests → 5 requests fail with connection errors → Frontend receives mix of success/failure → React state update causes re-render loop → UI freezes

- **Cache Miss Cascade**: Match data for popular game expires from Redis at 3:00 PM → 50 users refresh matches screen at 3:01 PM → All 50 requests hit `/api/football/fixtures` simultaneously → All check Redis, all get cache miss → All 50 attempt database query → Connection pool has 5 connections → First 5 queries execute, remaining 45 queue → Pool timeout (10s) expires → 45 requests fail with P2037 → Only 5 users see data, 45 see errors → Cache not repopulated due to failures → Next wave of requests repeats the problem

- **iPad Performance Issue**: iPad Air M3 with 5G connection → User opens app → Home screen loads 4 sections simultaneously (matches, reels, quiz, notifications) → Each section makes 2-3 API calls → Total 10 concurrent requests → Each request needs database connection → Connection pool (5) exhausted immediately → Half of requests fail → UI shows partial data with error messages → User taps retry → Another 10 requests → Same failure pattern → App appears completely broken

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Successful API calls to working endpoints must continue to return correct data with proper formatting
- Authentication and authorization via Clerk middleware must continue to validate requests correctly
- Features that work properly on iPhone devices must continue to perform well
- WebSocket connections for real-time updates must remain stable
- Cache hits for valid cached data must continue to serve content efficiently
- Database queries for working features must continue to return accurate results
- User data persistence (saves, updates, deletes) must continue to work correctly
- Navigation between screens that work properly must continue to provide smooth transitions
- Error handling that works correctly in other parts of the app must continue to function
- Rate limiting and security middleware must continue to protect endpoints

**Scope:**
All inputs that do NOT involve the specific failure conditions (connection pool exhaustion, cache miss without fallback, timeout issues, error propagation) should be completely unaffected by this fix. This includes:
- Successful requests with available database connections
- Cache hits that return data immediately
- API calls that complete within timeout limits
- Features that don't require database access
- Static content and client-side operations
- Authentication flows that work correctly
- WebSocket real-time updates
- File uploads and media operations that function properly

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Database Connection Pool Exhaustion**
   - Railway/Neon free tier limits connections to 5 concurrent connections
   - Current implementation: `CONNECTION_POOL_SIZE = 5` in `prisma.ts`
   - Under load, multiple API requests hold connections simultaneously
   - No request queuing or connection release optimization
   - Long-running queries (joins, aggregations) hold connections too long
   - Retry middleware in Prisma can amplify the problem (3 retries × 5 connections = 15 potential holds)
   - Evidence: P2037 errors and "too many clients" messages in logs

2. **Missing Graceful Cache Fallback**
   - Redis cache misses trigger direct database queries without coordination
   - No cache stampede prevention (multiple requests for same expired data)
   - Cache failures (Redis down) cause immediate API failures instead of degrading gracefully
   - No in-memory fallback cache for critical data
   - Evidence: Errors occur when Redis is unavailable or data expires

3. **Aggressive Frontend Timeouts**
   - Current timeout: 30 seconds (from `api.config.ts`)
   - Production API latency can exceed this under load (database slow, external API delays)
   - No distinction between critical and non-critical requests
   - Timeout triggers request cancellation but backend continues processing
   - Evidence: Requests fail on frontend but backend logs show success

4. **Insufficient Error Handling and Recovery**
   - Generic error responses don't distinguish between transient and permanent failures
   - No retry logic for transient errors (connection timeouts, temporary unavailability)
   - Error messages expose technical details to users ("P2037", "500 API returned errors")
   - No circuit breaker to prevent cascading failures
   - Frontend error boundaries missing or incomplete
   - Evidence: Users see technical error codes instead of actionable messages

5. **Lack of Request Prioritization and Throttling**
   - All requests treated equally regardless of importance
   - No request deduplication for identical concurrent requests
   - No client-side request throttling or debouncing
   - Background operations compete with user-initiated requests for connections
   - Evidence: iPad with fast connection overwhelms backend with concurrent requests

6. **Suboptimal Database Query Patterns**
   - N+1 query problems in some endpoints (e.g., fetching user predictions for each match)
   - Missing database indexes on frequently queried fields
   - Inefficient joins and aggregations
   - No query result caching at application level
   - Evidence: Slow query times contribute to connection pool exhaustion

7. **Keep-Alive and Connection Management Issues**
   - Keep-alive runs every 4 minutes but connections may close sooner under load
   - No connection health checks before query execution
   - Stale connections not detected and recycled
   - Evidence: Intermittent connection failures after idle periods

## Correctness Properties

Property 1: Fault Condition - API Requests Complete Successfully

_For any_ API request where the bug condition holds (500 errors, connection failures, cache misses, timeouts), the fixed system SHALL handle the request gracefully by: (1) retrying transient failures with exponential backoff, (2) falling back to alternative data sources when cache misses occur, (3) returning user-friendly error messages with recovery actions when all retries fail, (4) maintaining UI responsiveness without freezing, and (5) completing requests within 2 seconds for 95th percentile or providing loading feedback.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

Property 2: Preservation - Existing Functionality Unchanged

_For any_ request that does NOT trigger the bug condition (successful API calls, cache hits, requests within timeout, features that work correctly), the fixed system SHALL produce exactly the same behavior as the original system, preserving all existing functionality including authentication, authorization, data accuracy, WebSocket stability, and performance on working features.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `Backend/src/lib/prisma.ts`

**Function**: Database connection management

**Specific Changes**:
1. **Increase Connection Pool Size**: Change `CONNECTION_POOL_SIZE` from 5 to 10 (verify Railway/Neon plan supports this)
   - Add environment variable `DATABASE_CONNECTION_POOL_SIZE` for flexibility
   - Document connection limits in README for different hosting tiers

2. **Implement Connection Queue with Timeout**: Add request queuing when pool is full
   - Queue requests instead of immediate failure
   - Set queue timeout to 5 seconds (fail fast if queue too long)
   - Log queue depth for monitoring

3. **Optimize Connection Release**: Ensure connections released immediately after query
   - Use Prisma `$transaction` with explicit timeout
   - Avoid holding connections during external API calls
   - Add connection release logging in development

4. **Add Connection Health Checks**: Verify connection health before use
   - Ping connection before executing query
   - Recycle stale connections automatically
   - Reduce keep-alive interval to 2 minutes

**File**: `Backend/src/middleware/error-handler.middleware.ts` (NEW)

**Function**: Centralized error handling

**Specific Changes**:
1. **Create Error Classification System**: Distinguish error types
   - Transient errors (connection timeouts, temporary unavailability) → Retry
   - Permanent errors (validation failures, not found) → Return immediately
   - External service errors (API failures) → Fallback or circuit breaker

2. **Implement User-Friendly Error Messages**: Map technical errors to user messages
   - P2037 / "too many clients" → "Service is busy, please try again"
   - Cache miss + DB failure → "Unable to load data, please check your connection"
   - Timeout → "Request is taking longer than expected, please wait"
   - Generic 500 → "Something went wrong, please try again"

3. **Add Error Recovery Actions**: Include retry/refresh options in error responses
   - Return `{ error: 'E009', message: 'Service busy', action: 'retry', retryAfter: 3000 }`
   - Frontend can automatically retry or show retry button

4. **Implement Error Logging with Context**: Log errors with request details
   - Include user ID, endpoint, request ID, timestamp
   - Log connection pool status at time of error
   - Send critical errors to monitoring service

**File**: `Backend/src/services/cache-fallback.service.ts` (NEW)

**Function**: Cache miss handling with fallback

**Specific Changes**:
1. **Implement Cache Stampede Prevention**: Coordinate concurrent requests for same data
   - Use Redis lock or in-memory lock for cache key
   - First request fetches data, others wait for result
   - Timeout lock after 5 seconds to prevent deadlock

2. **Add In-Memory Fallback Cache**: Secondary cache when Redis fails
   - Use `node-cache` or `lru-cache` for critical data
   - Store last 100 matches, 50 profiles, 200 reels in memory
   - TTL of 5 minutes for in-memory cache

3. **Implement Graceful Degradation**: Return stale data when fresh data unavailable
   - Keep expired cache data for 1 hour as backup
   - Return stale data with `stale: true` flag
   - Frontend shows "Data may be outdated" message

4. **Add Cache Warming**: Preload critical data into cache
   - Warm cache for popular matches on startup
   - Refresh cache for trending content every 2 minutes
   - Background job to keep cache fresh

**File**: `Backend/src/middleware/circuit-breaker.middleware.ts` (NEW)

**Function**: Prevent cascading failures

**Specific Changes**:
1. **Implement Circuit Breaker Pattern**: Track failure rates per endpoint
   - Open circuit after 5 consecutive failures or 50% failure rate in 1 minute
   - Half-open after 30 seconds to test recovery
   - Close circuit after 3 consecutive successes

2. **Add Request Deduplication**: Prevent duplicate concurrent requests
   - Hash request parameters to create unique key
   - Return cached promise for identical in-flight requests
   - Clear after request completes

3. **Implement Request Prioritization**: Critical requests get priority
   - User-initiated requests > Background jobs
   - Real-time data > Historical data
   - Authenticated users > Anonymous users

**File**: `Backend/src/controllers/football.controller.ts`

**Function**: `getFixtures`, `getOptimizedFixtures`, and other endpoints

**Specific Changes**:
1. **Optimize Database Queries**: Reduce connection hold time
   - Use `select` to fetch only needed fields
   - Batch user prediction queries instead of N+1
   - Add database indexes on `userId`, `fixtureId`, `createdAt`

2. **Implement Query Result Caching**: Cache at application level
   - Cache user predictions for 30 seconds
   - Cache match data for 1 minute
   - Invalidate cache on data mutation

3. **Add Timeout to Database Operations**: Prevent long-running queries
   - Set query timeout to 5 seconds
   - Return partial results if timeout exceeded
   - Log slow queries for optimization

4. **Wrap in Try-Catch with Specific Error Handling**: Handle each error type
   - Connection errors → Retry with backoff
   - Timeout errors → Return cached data or error
   - Validation errors → Return 400 with details

**File**: `Backend/src/controllers/profile.controller.ts`

**Function**: `getMyProfile`, `getProfileByUsername`

**Specific Changes**:
1. **Add Redis Caching**: Cache profile data
   - Cache key: `profile:${userId}` or `profile:username:${username}`
   - TTL: 5 minutes
   - Invalidate on profile update

2. **Optimize User Queries**: Reduce data fetched
   - Use `select` to exclude sensitive fields
   - Fetch related data (followers, following) only when needed
   - Use `include` with `select` to limit joined data

3. **Implement Fallback for Cache Miss**: Graceful degradation
   - Try Redis → Try in-memory cache → Try database → Return error
   - Log cache miss rate for monitoring

**File**: `front/config/api.config.ts`

**Function**: API configuration

**Specific Changes**:
1. **Increase Timeout for Production**: Change from 30s to 60s
   - Critical requests: 60s timeout
   - Non-critical requests: 30s timeout
   - Upload requests: 15 minutes (already correct)

2. **Add Retry Configuration**: Configure retry behavior
   - Retry transient errors (5xx, network errors) up to 3 times
   - Exponential backoff: 1s, 2s, 4s
   - Don't retry client errors (4xx)

3. **Add Request Interceptor**: Handle errors before they reach components
   - Detect 500 errors and retry automatically
   - Show toast notification for retries
   - Cancel retries if user navigates away

**File**: `front/services/api-client.ts` (NEW or UPDATE existing)

**Function**: Centralized API client with error handling

**Specific Changes**:
1. **Implement Retry Logic**: Automatic retry for failed requests
   - Use `axios-retry` or custom retry logic
   - Retry on network errors and 5xx errors
   - Exponential backoff with jitter

2. **Add Request Deduplication**: Prevent duplicate requests
   - Track in-flight requests by URL + params
   - Return existing promise for duplicate requests
   - Clear after request completes

3. **Implement Error Transformation**: Convert API errors to user-friendly messages
   - Map error codes (E001-E010) to localized messages
   - Extract `action` field from error response
   - Provide default messages for unknown errors

4. **Add Loading State Management**: Centralized loading indicators
   - Track loading state per request
   - Debounce loading indicators (show after 300ms)
   - Cancel loading on unmount

**File**: `front/components/common/ErrorBoundary.tsx` (NEW)

**Function**: Catch and handle React errors

**Specific Changes**:
1. **Create Error Boundary Component**: Wrap app sections
   - Catch errors in component tree
   - Display user-friendly error UI
   - Provide "Try Again" button to reset state

2. **Add Error Reporting**: Send errors to monitoring
   - Log error details to console in development
   - Send to error tracking service in production
   - Include component stack trace

3. **Implement Partial Recovery**: Allow app to continue functioning
   - Only affected section shows error
   - Other sections continue working
   - User can retry failed section

**File**: `front/app/(tabs)/Home.tsx` and other screens

**Function**: Screen-level error handling

**Specific Changes**:
1. **Add Error States**: Handle loading, error, empty states
   - Show skeleton loaders during loading
   - Show error message with retry button on failure
   - Show empty state when no data

2. **Implement Pull-to-Refresh**: Allow manual retry
   - Add `RefreshControl` to scrollable views
   - Trigger data refetch on pull
   - Show loading indicator during refresh

3. **Add Offline Detection**: Handle network unavailability
   - Use `@react-native-community/netinfo`
   - Show offline banner when disconnected
   - Queue requests for when connection restored

4. **Optimize Concurrent Requests**: Reduce simultaneous API calls
   - Load sections sequentially instead of parallel
   - Prioritize above-the-fold content
   - Lazy load below-the-fold content

**File**: `Backend/src/utils/query-optimizer.ts` (NEW)

**Function**: Database query optimization utilities

**Specific Changes**:
1. **Create Query Batching Utility**: Batch multiple queries
   - Use DataLoader pattern for batching
   - Combine multiple user prediction queries into one
   - Reduce database round trips

2. **Add Query Caching**: Cache query results
   - In-memory cache for frequently accessed data
   - TTL-based expiration
   - Invalidation on data mutation

3. **Implement Query Monitoring**: Track slow queries
   - Log queries taking > 1 second
   - Include query parameters and execution time
   - Alert on queries taking > 5 seconds

## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach: (1) exploratory testing to surface counterexamples on unfixed code and confirm root causes, (2) fix verification to ensure all bug conditions are resolved, and (3) preservation testing to guarantee existing functionality remains unchanged. Testing will use a combination of unit tests, integration tests, load tests, and property-based tests to validate behavior across the input domain.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate high-load scenarios, cache failures, and connection exhaustion. Run these tests on the UNFIXED code to observe failures and understand the root causes. Use load testing tools (Artillery, k6) to generate concurrent requests and monitor connection pool status.

**Test Cases**:
1. **Connection Pool Exhaustion Test**: Send 20 concurrent requests to `/api/football/fixtures` (will fail on unfixed code)
   - Expected: 5 requests succeed, 15 fail with P2037 or timeout
   - Confirms: Connection pool limit is the bottleneck

2. **Cache Miss Cascade Test**: Clear Redis cache, send 50 concurrent requests for same match data (will fail on unfixed code)
   - Expected: All 50 requests hit database, connection pool exhausted, most requests fail
   - Confirms: No cache stampede prevention

3. **Frontend Timeout Test**: Simulate slow backend (add 35s delay), make API request from frontend (will fail on unfixed code)
   - Expected: Frontend timeout (30s) triggers before backend responds
   - Confirms: Timeout configuration too aggressive

4. **Redis Failure Test**: Stop Redis service, make API requests that depend on cache (will fail on unfixed code)
   - Expected: Requests fail immediately with cache errors, no fallback to database
   - Confirms: Missing graceful degradation

5. **iPad Load Test**: Simulate iPad behavior by sending 10 concurrent requests on app launch (will fail on unfixed code)
   - Expected: Some requests fail, UI shows partial data with errors
   - Confirms: No request prioritization or throttling

6. **Long Query Test**: Execute slow database query (e.g., complex join), monitor connection hold time (will show issue on unfixed code)
   - Expected: Connection held for 10+ seconds, blocking other requests
   - Confirms: Inefficient queries contribute to exhaustion

**Expected Counterexamples**:
- P2037 "too many clients" errors when concurrent requests exceed 5
- 500 errors when Redis cache misses and database is slow
- Frontend timeout errors when backend takes > 30 seconds
- UI freezing when multiple requests fail simultaneously
- Partial data loading when some requests succeed and others fail

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed system produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleRequest_fixed(input)
  ASSERT result.success == true OR result.hasUserFriendlyError == true
  ASSERT result.responseTime < 2000 OR result.hasLoadingFeedback == true
  ASSERT result.uiResponsive == true
  ASSERT result.errorMessage NOT CONTAINS ['P2037', '500', 'too many clients']
END FOR
```

**Test Cases**:
1. **Connection Pool Exhaustion - Fixed**: Send 20 concurrent requests
   - Expected: All 20 requests succeed or queue gracefully, no P2037 errors
   - Verify: Connection pool size increased, queue implemented

2. **Cache Miss Cascade - Fixed**: Clear cache, send 50 concurrent requests
   - Expected: First request fetches data, others wait for result, all succeed
   - Verify: Cache stampede prevention working

3. **Frontend Timeout - Fixed**: Simulate 45s backend delay
   - Expected: Frontend waits up to 60s, shows loading feedback, eventually succeeds
   - Verify: Timeout increased, loading indicators shown

4. **Redis Failure - Fixed**: Stop Redis, make API requests
   - Expected: Requests fall back to in-memory cache or database, succeed with slight delay
   - Verify: Graceful degradation working

5. **iPad Load - Fixed**: Send 10 concurrent requests on app launch
   - Expected: All requests succeed, UI loads smoothly without errors
   - Verify: Request prioritization and throttling working

6. **Error Message - Fixed**: Trigger various error conditions
   - Expected: User sees friendly messages like "Service is busy, please try again"
   - Verify: Error transformation working

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed system produces the same result as the original system.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleRequest_original(input) == handleRequest_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for successful requests, then write property-based tests capturing that behavior. Verify that authentication, authorization, data accuracy, and performance remain unchanged.

**Test Cases**:
1. **Successful API Calls Preservation**: Make requests with available connections
   - Observe: Requests succeed with correct data on unfixed code
   - Test: Verify fixed code returns identical data with same performance

2. **Cache Hit Preservation**: Request data that exists in cache
   - Observe: Cache returns data immediately on unfixed code
   - Test: Verify fixed code has same cache hit behavior and performance

3. **Authentication Preservation**: Make authenticated requests
   - Observe: Clerk middleware validates tokens correctly on unfixed code
   - Test: Verify fixed code has identical authentication behavior

4. **iPhone Performance Preservation**: Run app on iPhone
   - Observe: App performs well on unfixed code
   - Test: Verify fixed code maintains same performance on iPhone

5. **WebSocket Preservation**: Establish WebSocket connection
   - Observe: Real-time updates work correctly on unfixed code
   - Test: Verify fixed code maintains stable WebSocket connections

6. **Data Mutation Preservation**: Create, update, delete operations
   - Observe: Data persists correctly on unfixed code
   - Test: Verify fixed code has identical data persistence behavior

### Unit Tests

- Test connection pool queue logic (enqueue, dequeue, timeout)
- Test cache stampede prevention (lock acquisition, release, timeout)
- Test error classification (transient vs permanent)
- Test error message transformation (technical to user-friendly)
- Test circuit breaker state transitions (closed → open → half-open → closed)
- Test request deduplication (identical requests return same promise)
- Test retry logic with exponential backoff
- Test query batching and optimization utilities

### Property-Based Tests

- Generate random API request patterns and verify all complete successfully or return user-friendly errors
- Generate random cache states (hit, miss, failure) and verify graceful handling
- Generate random connection pool states and verify no P2037 errors
- Generate random error conditions and verify user-friendly messages
- Test that response times meet SLA (95th percentile < 2s) across many scenarios
- Test that UI remains responsive under all load conditions

### Integration Tests

- Test full request flow: frontend → API → database → cache → response
- Test error recovery: trigger error → verify retry → verify success
- Test cache warming: start server → verify critical data preloaded
- Test graceful degradation: stop Redis → verify fallback to database
- Test connection pool under load: send 100 concurrent requests → verify all succeed
- Test iPad scenario: simulate iPad app launch → verify smooth loading
- Test monitoring: trigger errors → verify logs contain context
- Test circuit breaker: cause failures → verify circuit opens → verify recovery
