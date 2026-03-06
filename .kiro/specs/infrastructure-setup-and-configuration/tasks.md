# Implementation Plan: Infrastructure Setup and Configuration

## Overview

This implementation plan covers the activation and configuration of critical infrastructure systems for the 90Plus application. The work is organized into six major phases: Sentry error tracking activation (Frontend & Backend), Firebase Analytics integration (Frontend), TypeScript error resolution (Frontend & Backend), API keys and environment variables audit (Frontend & Backend), integration testing, and monitoring setup. Each task builds incrementally, with checkpoints to ensure stability before proceeding.

## Tasks

- [ ] 1. Backend Sentry Error Tracking Setup
  - [x] 1.1 Install Sentry packages for Backend
    - Install @sentry/node and @sentry/profiling-node packages
    - Verify package versions are compatible with Node.js 18+
    - _Requirements: 1.2_

  - [x] 1.2 Create Sentry configuration module for Backend
    - Create Backend/src/config/sentry.config.ts with initializeSentry function
    - Implement DSN validation and environment detection
    - Configure sample rates (100% dev, 20% prod for traces, 10% prod for profiling)
    - Implement beforeSend hook to filter sensitive data (Authorization headers, cookies, password/token/secret fields)
    - Configure ignoreErrors for expected errors (NetworkError, AbortError, Unauthorized, Not found)
    - Add Express integration with request and tracing handlers
    - Export helper functions: getSentryErrorHandler, captureException, setUser, clearUser
    - _Requirements: 1.4, 1.6, 1.7, 1.8, 1.9_

  - [x] 1.3 Integrate Sentry into Backend application startup
    - Modify Backend/src/main.ts to call initializeSentry after app creation
    - Add Sentry request handler as first middleware
    - Add Sentry tracing handler after request handler
    - Add Sentry error handler as last middleware (after all routes)
    - Add success log message on initialization
    - _Requirements: 1.4, 1.12, 5.14_

  - [x] 1.4 Integrate Sentry with Winston logger
    - Modify Backend/src/utils/logger.ts to create custom SentryTransport class
    - Forward error-level logs to Sentry.captureException
    - Forward warn-level logs to Sentry.captureMessage
    - Add Sentry transport only in production with valid DSN
    - _Requirements: 6.14_

  - [x] 1.5 Write property test for Backend Sentry sensitive data filtering
    - **Property 1: Sensitive Data Filtering**
    - **Validates: Requirements 1.8, 6.12**
    - Generate random error events with sensitive headers and data fields
    - Verify Authorization headers, cookies, password/token/secret fields are filtered
    - Run 100 iterations with fast-check

  - [x] 1.6 Write unit tests for Backend Sentry configuration
    - Test Sentry initialization with valid DSN
    - Test Sentry initialization without DSN (should log warning and skip)
    - Test beforeSend hook filters sensitive data correctly
    - Test Express middleware integration
    - Test user context setting and clearing
    - _Requirements: 1.4, 1.6, 1.8, 1.13, 1.14_

- [ ] 2. Frontend Sentry Error Tracking Setup
  - [x] 2.1 Install Sentry package for Frontend
    - Install @sentry/react-native package compatible with Expo SDK 52
    - Verify compatibility with React Native 0.76.9
    - _Requirements: 1.1_

  - [x] 2.2 Create or update Sentry service for Frontend
    - Create/update front/services/sentry.service.ts with initSentry function
    - Implement DSN validation and environment detection
    - Configure sample rates (100% dev, 20% prod)
    - Implement beforeSend hook to filter sensitive data
    - Configure ignoreErrors for expected errors
    - Add release version and build number from Constants
    - Export functions: captureException, captureMessage, setUser, clearUser, addBreadcrumb, setTag, setContext, measureAsync
    - _Requirements: 1.3, 1.5, 1.7, 1.8, 1.9_

  - [x] 2.3 Integrate Sentry into Frontend application initialization
    - Modify front/app/_layout.tsx to call initSentry before app rendering
    - Add React error boundary integration with Sentry
    - Add success log message on initialization
    - Handle initialization failures gracefully (log warning, continue startup)
    - _Requirements: 1.3, 1.11, 5.5, 5.15_

  - [x] 2.4 Integrate Sentry with user authentication flow
    - Modify authentication service to call setUser on login/signup
    - Call clearUser on logout
    - Include user ID, username, and email in context
    - _Requirements: 1.13, 1.14_

  - [x] 2.5 Add Sentry breadcrumbs for navigation and API calls
    - Add breadcrumb capture in navigation events (screen changes)
    - Add breadcrumb capture in API client for all requests (endpoint, method)
    - Add breadcrumb capture for user actions (button clicks, form submissions)
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.6 Write property test for Frontend Sentry exception capture
    - **Property 2: Exception Capture Completeness**
    - **Validates: Requirements 1.10**
    - Generate random exceptions with stack traces
    - Verify Sentry captures exception with filename, function, line numbers
    - Run 100 iterations with fast-check

  - [x] 2.7 Write property test for Frontend Sentry user context
    - **Property 3: User Context Setting on Authentication**
    - **Validates: Requirements 1.13**
    - Generate random user authentication events
    - Verify Sentry sets user context with ID, username, email
    - Run 100 iterations with fast-check

  - [x] 2.8 Write unit tests for Frontend Sentry service
    - Test Sentry initialization with valid DSN
    - Test Sentry initialization without DSN (should skip)
    - Test error boundary integration
    - Test user context setting and clearing
    - Test breadcrumb capture
    - Test graceful failure handling
    - _Requirements: 1.3, 1.5, 1.11, 1.13, 1.14, 5.5_

- [ ] 3. Checkpoint - Verify Sentry Integration
  - Ensure all tests pass, manually verify Sentry dashboards show test errors from both Frontend and Backend, ask the user if questions arise.

- [ ] 4. Firebase Analytics Integration (Frontend)
  - [~] 4.1 Install Firebase Analytics packages
    - Install @react-native-firebase/app and @react-native-firebase/analytics packages
    - Verify compatibility with Expo SDK 52 and React Native 0.76.9
    - _Requirements: 2.1_

  - [~] 4.2 Configure Firebase for Android and iOS
    - Add google-services.json configuration for Android platform
    - Add GoogleService-Info.plist configuration for iOS platform
    - Update app.json/app.config.js with Firebase plugin configuration
    - _Requirements: 2.2, 2.3_

  - [~] 4.3 Create or update Analytics service
    - Create/update front/services/analytics.service.ts
    - Define AnalyticsEvent enum with all event types (APP_OPEN, SESSION_START, SIGN_UP, LOGIN, LOGOUT, VIDEO_PLAY, VIDEO_PAUSE, VIDEO_COMPLETE, VIDEO_UPLOAD, LIKE, COMMENT, FOLLOW, UNFOLLOW, COINS_EARNED, COINS_SPENT, LEVEL_UP, ACHIEVEMENT_UNLOCKED, PREDICTION_MADE, PREDICTION_WON, PREDICTION_LOST, QUIZ_START, QUIZ_COMPLETE, QUIZ_ANSWER)
    - Define UserProperty enum (USER_LEVEL, FAVORITE_TEAM, LANGUAGE, TOTAL_COINS, TOTAL_PREDICTIONS, TOTAL_VIDEOS)
    - Implement initialize function with graceful failure handling
    - Implement logEvent function with type-safe event names
    - Implement logScreenView function
    - Implement setUserId, setUserProperty, setUserProperties functions
    - Implement setEnabled function
    - Disable analytics in development environment
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.16, 2.18_

  - [~] 4.4 Integrate Analytics into application initialization
    - Modify front/app/_layout.tsx to call analytics.initialize
    - Handle initialization failures gracefully (log warning, continue)
    - Add success log message on initialization
    - _Requirements: 2.4, 2.18, 5.6, 5.15_

  - [~] 4.5 Add authentication event tracking
    - Track sign_up event on user registration
    - Track login event on user login
    - Track logout event on user logout
    - Set user ID and properties on authentication
    - _Requirements: 2.9, 2.15_

  - [~] 4.6 Add content event tracking
    - Track video_play event with video ID and duration
    - Track video_pause event
    - Track video_complete event
    - Track video_upload event
    - _Requirements: 2.10_

  - [~] 4.7 Add social event tracking
    - Track like event with target user ID and content type
    - Track comment event
    - Track follow event with target user ID
    - Track unfollow event
    - _Requirements: 2.11_

  - [~] 4.8 Add gamification event tracking
    - Track coins_earned event with coins amount
    - Track coins_spent event with coins amount
    - Track level_up event with new level
    - Track achievement_unlocked event with achievement ID
    - _Requirements: 2.12_

  - [~] 4.9 Add prediction and quiz event tracking
    - Track prediction_made event with match ID, coins spent, prediction type
    - Track prediction_won and prediction_lost events
    - Track quiz_start event with category ID
    - Track quiz_complete event with score and correct answers
    - Track quiz_answer event
    - _Requirements: 2.13, 2.14_

  - [~] 4.10 Write property test for Analytics screen view logging
    - **Property 4: Screen View Event Logging**
    - **Validates: Requirements 2.7**
    - Generate random screen navigation events
    - Verify Analytics logs screen_view with screen name
    - Run 100 iterations with fast-check

  - [~] 4.11 Write property test for Analytics user context
    - **Property 5: Analytics User Context Setting**
    - **Validates: Requirements 2.15**
    - Generate random user authentication events
    - Verify Analytics sets user ID and properties (level, favorite_team, language)
    - Run 100 iterations with fast-check

  - [~] 4.12 Write property test for Analytics graceful failure
    - **Property 6: Analytics Graceful Failure**
    - **Validates: Requirements 2.18, 5.6**
    - Simulate Firebase initialization failures
    - Verify Frontend continues functioning without crashes
    - Run 100 iterations with fast-check

  - [~] 4.13 Write unit tests for Analytics service
    - Test Firebase initialization with valid configuration
    - Test Firebase initialization without configuration (should skip)
    - Test analytics disabled in development
    - Test all event types log correctly with parameters
    - Test user ID and properties setting
    - Test graceful failure handling
    - _Requirements: 2.4, 2.7, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.18_

- [ ] 5. Checkpoint - Verify Firebase Analytics Integration
  - Ensure all tests pass, manually verify Firebase Console shows test events, ask the user if questions arise.

- [ ] 6. Backend Environment Variables Audit and Validation
  - [~] 6.1 Create environment validation service for Backend
    - Create Backend/src/config/env.config.ts
    - Define RequiredEnvVars interface (DATABASE_URL, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, CLERK_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, FOOTBALL_API_KEY)
    - Define OptionalEnvVars interface (SENTRY_DSN, REDIS_URL, ENABLE_ANALYTICS, ENABLE_ERROR_TRACKING)
    - Implement EnvironmentValidator class with validate method
    - Validate required variables are present
    - Validate DATABASE_URL starts with "postgresql://"
    - Validate SUPABASE_URL starts with "https://"
    - Validate CLERK_SECRET_KEY starts with "sk_"
    - Validate CLERK_PUBLISHABLE_KEY starts with "pk_"
    - Log warnings for missing optional variables
    - Log errors and exit with code 1 for missing/invalid required variables
    - Export validateEnvironment function
    - _Requirements: 4.7, 4.8, 4.11, 4.13, 4.14, 4.15, 4.16_

  - [~] 6.2 Integrate environment validation into Backend startup
    - Modify Backend/src/main.ts to call validateEnvironment before any initialization
    - Ensure validation runs before database connection, Sentry, or any other services
    - _Requirements: 4.7, 5.8_

  - [~] 6.3 Update Backend .env.example file
    - Document all required environment variables with descriptions
    - Document all optional environment variables with descriptions
    - Provide example values for non-sensitive variables
    - Use placeholder values for sensitive variables
    - Organize variables by category (Database, Authentication, Storage, Media, Sports Data, Monitoring, Feature Flags)
    - Document where to obtain each API key
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 4.10, 4.15, 4.16, 4.19, 4.20_

  - [~] 6.4 Write property test for Backend environment validation failure
    - **Property 7: Environment Variable Validation Failure**
    - **Validates: Requirements 4.7, 4.8**
    - Generate random missing required variables
    - Verify application logs error and exits with non-zero code
    - Run 100 iterations with fast-check

  - [~] 6.5 Write property test for DATABASE_URL format validation
    - **Property 8: Database URL Format Validation**
    - **Validates: Requirements 4.13**
    - Generate random invalid DATABASE_URL values (not starting with "postgresql://")
    - Verify validation fails with appropriate error
    - Run 100 iterations with fast-check

  - [~] 6.6 Write unit tests for Backend environment validation
    - Test validation passes with all required variables
    - Test validation fails with missing DATABASE_URL
    - Test validation fails with invalid DATABASE_URL format
    - Test validation fails with invalid CLERK_SECRET_KEY prefix
    - Test validation warns for missing SENTRY_DSN
    - Test validation warns for missing REDIS_URL
    - _Requirements: 4.7, 4.8, 4.11, 4.13_

- [ ] 7. Frontend Environment Variables Audit and Validation
  - [~] 7.1 Create environment configuration service for Frontend
    - Create front/config/env.config.ts
    - Define EnvironmentConfig interface (apiUrl, wsUrl, clerkPublishableKey, sportmonksToken, sentryDsn?, firebaseApiKey?, firebaseProjectId?, firebaseAppId?, enableAnalytics, enableErrorTracking, enableDebugLogs)
    - Implement EnvironmentConfigService class with loadAndValidate method
    - Validate required variables (EXPO_PUBLIC_API_URL, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_SPORTMONKS_TOKEN)
    - Validate EXPO_PUBLIC_API_URL is valid HTTP/HTTPS URL
    - Parse boolean feature flags
    - Log warnings for missing optional variables
    - Log errors for missing/invalid required variables
    - Export singleton instance
    - _Requirements: 4.7, 4.8, 4.12, 4.17, 4.18_

  - [~] 7.2 Integrate environment validation into Frontend startup
    - Modify front/app/_layout.tsx to validate environment before initialization
    - Display error screen if validation fails (instead of crashing)
    - _Requirements: 4.7, 4.17, 4.18_

  - [~] 7.3 Update Frontend .env.example file
    - Document all required environment variables with descriptions
    - Document all optional environment variables with descriptions
    - Provide example values for non-sensitive variables
    - Use placeholder values for sensitive variables
    - Organize variables by category (API, Authentication, Sports Data, Monitoring, Feature Flags, Development)
    - Document where to obtain each API key
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 4.10, 4.15, 4.17, 4.18, 4.19, 4.20_

  - [~] 7.4 Write property test for Frontend API URL validation
    - **Property 9: API URL Format Validation**
    - **Validates: Requirements 4.17**
    - Generate random invalid EXPO_PUBLIC_API_URL values (not valid HTTP/HTTPS URLs)
    - Verify validation fails with appropriate error
    - Run 100 iterations with fast-check

  - [~] 7.5 Write unit tests for Frontend environment validation
    - Test validation passes with all required variables
    - Test validation fails with missing EXPO_PUBLIC_API_URL
    - Test validation fails with invalid EXPO_PUBLIC_API_URL format
    - Test validation fails with missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
    - Test validation fails with missing EXPO_PUBLIC_SPORTMONKS_TOKEN
    - Test boolean feature flags parse correctly
    - _Requirements: 4.7, 4.8, 4.12, 4.17, 4.18_

- [ ] 8. Verify No Hardcoded Secrets in Codebase
  - [~] 8.1 Search codebase for hardcoded API keys and secrets
    - Use grep/ripgrep to search for patterns: long alphanumeric strings, "key", "secret", "token" followed by assignment
    - Search Frontend and Backend directories
    - Exclude .env.example, node_modules, dist, build directories
    - Document any findings and replace with environment variables
    - _Requirements: 4.6_

  - [~] 8.2 Update .gitignore files
    - Verify Frontend .gitignore contains .env, .env.local, .env.*.local
    - Verify Backend .gitignore contains .env, .env.local, .env.*.local
    - _Requirements: 4.22_

  - [~] 8.3 Write unit test to verify no hardcoded secrets
    - **Example Test 20: No Hardcoded Secrets**
    - **Validates: Requirements 4.6**
    - Search codebase for patterns matching API keys or secrets
    - Verify no hardcoded credentials found outside .env.example files

- [ ] 9. Checkpoint - Verify Environment Configuration
  - Ensure all tests pass, manually verify applications start with valid .env and fail gracefully with missing variables, ask the user if questions arise.

- [ ] 10. TypeScript Error Resolution - Backend
  - [~] 10.1 Run TypeScript compiler on Backend and identify errors
    - Run `npm run build` or `tsc --noEmit` in Backend directory
    - Document all TypeScript errors with file paths and line numbers
    - Categorize errors (type mismatches, missing types, import errors, etc.)
    - _Requirements: 3.1_

  - [~] 10.2 Fix Backend TypeScript errors systematically
    - Fix import path errors and missing module declarations
    - Add explicit types for function parameters and return values
    - Define interfaces for API response shapes
    - Install missing @types packages for third-party libraries
    - Replace 'any' types with proper type definitions (add justification comments where necessary)
    - Fix type mismatches and null/undefined handling
    - _Requirements: 3.1, 3.6, 3.7, 3.9, 3.11, 3.12_

  - [~] 10.3 Verify Backend TypeScript strict mode configuration
    - Check Backend/tsconfig.json has "strict": true
    - Check "noImplicitReturns": true
    - Check "noFallthroughCasesInSwitch": true
    - Add if missing
    - _Requirements: 3.3, 3.4, 3.5_

  - [~] 10.4 Verify Backend compiles successfully
    - Run `npm run build` to ensure zero TypeScript errors
    - Verify build process fails if errors exist
    - _Requirements: 3.1, 3.13_

  - [~] 10.5 Write unit test for Backend TypeScript compilation
    - **Example Test 13: Backend TypeScript Compilation**
    - **Validates: Requirements 3.1**
    - Run tsc programmatically and verify zero errors
    - Verify JavaScript output generated in dist/ directory

- [ ] 11. TypeScript Error Resolution - Frontend
  - [~] 11.1 Run TypeScript compiler on Frontend and identify errors
    - Run `npx tsc --noEmit` in front directory
    - Document all TypeScript errors with file paths and line numbers
    - Categorize errors (type mismatches, missing types, import errors, React component props, etc.)
    - _Requirements: 3.2_

  - [~] 11.2 Fix Frontend TypeScript errors systematically
    - Fix import path errors and missing module declarations
    - Add explicit types for function parameters and return values
    - Define interfaces for all component props
    - Define interfaces for API response shapes
    - Install missing @types packages for third-party libraries
    - Replace 'any' types with proper type definitions (add justification comments where necessary)
    - Fix type mismatches and null/undefined handling
    - _Requirements: 3.2, 3.6, 3.7, 3.9, 3.10, 3.11, 3.12_

  - [~] 11.3 Verify Frontend TypeScript strict mode configuration
    - Check front/tsconfig.json has "strict": true
    - Check "noImplicitReturns": true
    - Check "noFallthroughCasesInSwitch": true
    - Add if missing
    - _Requirements: 3.3, 3.4, 3.5_

  - [~] 11.4 Verify Frontend compiles successfully
    - Run `npx tsc --noEmit` to ensure zero TypeScript errors
    - Verify build process fails if errors exist
    - _Requirements: 3.2, 3.13_

  - [~] 11.5 Write unit test for Frontend TypeScript compilation
    - **Example Test 14: Frontend TypeScript Compilation**
    - **Validates: Requirements 3.2**
    - Run tsc programmatically and verify zero errors

- [ ] 12. Checkpoint - Verify TypeScript Compilation
  - Ensure all TypeScript errors are resolved, both Frontend and Backend compile successfully, ask the user if questions arise.

- [ ] 13. Integration Testing and Documentation
  - [~] 13.1 Test Backend production build
    - Run `npm run build` in Backend directory
    - Verify build completes without TypeScript errors
    - Verify dist/ directory contains compiled JavaScript
    - _Requirements: 5.2_

  - [~] 13.2 Test Frontend production build
    - Run build command for Frontend (Expo build or similar)
    - Verify build completes without TypeScript errors
    - _Requirements: 5.1_

  - [~] 13.3 Test Sentry error capture in production-like environment
    - Trigger test error in Backend and verify it appears in Sentry dashboard within 5 seconds
    - Trigger test error in Frontend and verify it appears in Sentry dashboard within 5 seconds
    - Verify user context is included in error reports
    - Verify breadcrumbs are included
    - Verify sensitive data is filtered
    - _Requirements: 5.3_

  - [~] 13.4 Test Firebase Analytics event logging
    - Trigger test events in Frontend (login, video play, etc.)
    - Verify events appear in Firebase Console within 2 seconds (or DebugView for immediate verification)
    - Verify event parameters are correct
    - _Requirements: 5.4_

  - [~] 13.5 Create developer documentation for Sentry setup
    - Document how to obtain Sentry DSN (create project on sentry.io)
    - Document how to add DSN to .env files
    - Document how to verify Sentry is working
    - Add troubleshooting guide for common issues
    - _Requirements: 5.9, 5.11_

  - [~] 13.6 Create developer documentation for Firebase Analytics setup
    - Document how to create Firebase project
    - Document how to download google-services.json and GoogleService-Info.plist
    - Document how to add configuration files to project
    - Document how to verify Analytics is working
    - Add troubleshooting guide for common issues
    - _Requirements: 5.10, 5.11_

  - [~] 13.7 Add code examples for Sentry usage
    - Add example of manual error capture in critical code paths
    - Add example of performance measurement with measureAsync
    - Add example of adding custom context and tags
    - _Requirements: 5.12_

  - [~] 13.8 Add code examples for Analytics usage
    - Add example of logging custom events
    - Add example of setting user properties
    - Add example of tracking screen views
    - _Requirements: 5.13_

- [~] 13.9 Write integration test for Sentry error boundary
  - Test React error boundary captures component errors
  - Verify error is sent to Sentry
  - _Requirements: 1.11_

- [~] 13.10 Write integration test for Sentry Express middleware
  - Test Express middleware captures request errors
  - Verify error is sent to Sentry with request context
  - _Requirements: 1.12_

- [~] 13.11 Write integration test for environment validation
  - Test Backend fails to start with missing required variables
  - Test Frontend displays error with missing required variables
  - _Requirements: 4.8, 5.8_

- [ ] 14. Monitoring and Observability Setup
  - [~] 14.1 Enhance Sentry breadcrumb capture
    - Ensure breadcrumbs capture user actions with action type and timestamp
    - Ensure breadcrumbs capture navigation with screen name
    - Ensure breadcrumbs capture API calls with endpoint, method, and status
    - _Requirements: 6.1, 6.2, 6.3_

  - [~] 14.2 Add Sentry tags and context for debugging
    - Add tags for feature context (feature name, platform, screen)
    - Add context for device info (device model, OS version)
    - Add context for app version and build number
    - _Requirements: 6.4, 6.5_

  - [~] 14.3 Add Sentry performance spans for critical operations
    - Add performance span for API calls
    - Add performance span for database queries
    - Add performance span for file uploads
    - Track operation name, start time, and duration
    - _Requirements: 6.6_

  - [~] 14.4 Enhance network failure capture
    - Capture request details (URL, method, headers) on network failures
    - Capture response status code
    - _Requirements: 6.7_

  - [~] 14.5 Enhance database error capture
    - Capture query type (SELECT, INSERT, UPDATE, DELETE) on database errors
    - Capture error details and context
    - _Requirements: 6.8_

  - [~] 14.6 Add Analytics session and retention tracking
    - Track session_start and session_end events
    - Track app_open event
    - _Requirements: 6.9_

  - [~] 14.7 Add Analytics conversion tracking
    - Track prediction_made as conversion event with value
    - Track video_upload as conversion event with value
    - _Requirements: 6.10_

  - [~] 14.8 Set Analytics user properties for segmentation
    - Set user_level property
    - Set favorite_team property
    - Set language property
    - _Requirements: 6.11_

  - [~] 14.9 Configure Sentry error severity classification
    - Classify errors by severity (fatal, error, warning, info, debug)
    - Set appropriate severity based on error type and impact
    - _Requirements: 6.13_

  - [~] 14.10 Write property test for breadcrumb capture
    - **Property 10: Breadcrumb Capture for Events**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Generate random user actions, navigation events, API calls
    - Verify Sentry captures breadcrumb with event type, timestamp, context
    - Run 100 iterations with fast-check

  - [~] 14.11 Write property test for context and tag setting
    - **Property 11: Context and Tag Setting**
    - **Validates: Requirements 6.4, 6.5**
    - Generate random errors with context
    - Verify tags (feature, platform, screen) and context (device, app version) are attached
    - Run 100 iterations with fast-check

  - [~] 14.12 Write property test for performance span tracking
    - **Property 12: Performance Span Tracking**
    - **Validates: Requirements 6.6**
    - Generate random critical operations
    - Verify Sentry creates performance span with name, start time, duration
    - Run 100 iterations with fast-check

  - [~] 14.13 Write property test for network failure capture
    - **Property 13: Network Failure Capture**
    - **Validates: Requirements 6.7**
    - Generate random network failures
    - Verify Sentry captures request details and response status
    - Run 100 iterations with fast-check

  - [~] 14.14 Write property test for database error capture
    - **Property 14: Database Error Capture**
    - **Validates: Requirements 6.8**
    - Generate random database errors
    - Verify Backend Sentry captures query type and error details
    - Run 100 iterations with fast-check

  - [~] 14.15 Write property test for error severity classification
    - **Property 15: Error Severity Classification**
    - **Validates: Requirements 6.13**
    - Generate random errors of different types
    - Verify appropriate severity level assigned (fatal, error, warning, info, debug)
    - Run 100 iterations with fast-check

- [ ] 15. Final Checkpoint and Verification
  - Ensure all tests pass (unit, property, integration), manually verify Sentry and Firebase dashboards, verify TypeScript compilation, verify environment validation, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties with 100 iterations
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end functionality
- All infrastructure changes must not disrupt existing functionality (zero-downtime)
- Monitoring services (Sentry, Firebase) must fail gracefully without crashing the app
- TypeScript strict mode ensures type safety across the codebase
- Environment validation prevents deployment with missing/invalid configuration
