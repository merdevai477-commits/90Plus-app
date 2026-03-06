# Design Document: Infrastructure Setup and Configuration

## Overview

This design document outlines the technical implementation for activating and configuring critical infrastructure systems in the 90Plus application. The feature encompasses four major components:

1. **Sentry Error Tracking**: Full activation of error monitoring and performance tracking for both Frontend (React Native/Expo) and Backend (Node.js/Express)
2. **Firebase Analytics Integration**: Implementation of comprehensive user behavior tracking and analytics in the Frontend mobile application
3. **TypeScript Error Resolution**: Systematic resolution of all TypeScript compilation errors across the codebase with strict type safety enforcement
4. **Environment Variables Audit**: Complete documentation and validation of all API keys and configuration variables

The infrastructure improvements will provide production-grade monitoring, analytics insights, type safety guarantees, and secure configuration management. The implementation follows a phased approach: package installation → configuration → integration → validation → documentation.

### Key Design Goals

- Zero-downtime deployment: All infrastructure changes must not disrupt existing functionality
- Graceful degradation: Analytics and monitoring failures should not crash the application
- Security-first: All sensitive data must be filtered from error reports and properly managed in environment variables
- Developer experience: Clear documentation and validation messages for configuration issues
- Production-ready: Appropriate sampling rates and feature flags for different environments

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         90Plus Application                       │
├──────────────────────────┬──────────────────────────────────────┤
│                          │                                      │
│   Frontend (Expo/RN)     │      Backend (Node.js/Express)      │
│                          │                                      │
│  ┌────────────────────┐  │   ┌────────────────────────────┐   │
│  │  Sentry Service    │  │   │   Sentry Integration       │   │
│  │  - Error tracking  │  │   │   - Error middleware       │   │
│  │  - Performance     │  │   │   - Performance spans      │   │
│  │  - Breadcrumbs     │  │   │   - Winston integration    │   │
│  │  - User context    │  │   │   - Request tracking       │   │
│  └────────────────────┘  │   └────────────────────────────┘   │
│           │              │                │                    │
│           ├──────────────┼────────────────┤                    │
│           │              │                │                    │
│           ▼              │                ▼                    │
│    Sentry.io Cloud       │         Sentry.io Cloud            │
│                          │                                      │
│  ┌────────────────────┐  │                                      │
│  │ Firebase Analytics │  │                                      │
│  │  - Event tracking  │  │                                      │
│  │  - Screen views    │  │                                      │
│  │  - User properties │  │                                      │
│  │  - Conversions     │  │                                      │
│  └────────────────────┘  │                                      │
│           │              │                                      │
│           ▼              │                                      │
│   Firebase Console       │                                      │
│                          │                                      │
│  ┌────────────────────┐  │   ┌────────────────────────────┐   │
│  │ TypeScript Config  │  │   │   TypeScript Config        │   │
│  │  - Strict mode     │  │   │   - Strict mode            │   │
│  │  - Type checking   │  │   │   - Type checking          │   │
│  └────────────────────┘  │   └────────────────────────────┘   │
│                          │                                      │
│  ┌────────────────────┐  │   ┌────────────────────────────┐   │
│  │ Environment Config │  │   │   Environment Config       │   │
│  │  - .env validation │  │   │   - .env validation        │   │
│  │  - API keys        │  │   │   - API keys               │   │
│  │  - Feature flags   │  │   │   - Feature flags          │   │
│  └────────────────────┘  │   └────────────────────────────┘   │
│                          │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

### Integration Points

1. **Application Initialization**: Sentry and Firebase Analytics initialize before app rendering
2. **Error Boundaries**: React error boundaries integrate with Sentry for component error capture
3. **Express Middleware**: Sentry middleware captures request errors and performance data
4. **Logger Integration**: Winston logger forwards errors to Sentry in Backend
5. **Build Process**: TypeScript compilation runs before deployment with strict validation
6. **Startup Validation**: Environment variables validated at application startup

### Data Flow

#### Error Tracking Flow
```
User Action → Error Occurs → Error Boundary/Try-Catch → Sentry Service
  → Filter Sensitive Data → Add Context/Breadcrumbs → Send to Sentry.io
  → Alert/Dashboard → Developer Investigation
```

#### Analytics Flow
```
User Action → Event Trigger → Analytics Service → Firebase Analytics SDK
  → Event Validation → Add Parameters → Send to Firebase → Firebase Console
  → Reports/Insights → Product Decisions
```

#### Environment Validation Flow
```
App Startup → Load .env → Validate Required Variables → Check Format
  → Missing/Invalid? → Log Error + Exit : Continue Startup
```

## Components and Interfaces

### Frontend Components

#### 1. Sentry Service (`front/services/sentry.service.ts`)

**Purpose**: Centralized error tracking and performance monitoring for the mobile application.

**Key Functions**:
- `initSentry()`: Initialize Sentry with DSN and configuration
- `captureException(error, context)`: Capture errors with additional context
- `captureMessage(message, level, context)`: Log messages to Sentry
- `setUser(user)`: Set user context for error tracking
- `clearUser()`: Clear user context on logout
- `addBreadcrumb(message, category, level, data)`: Add breadcrumb for debugging
- `setTag(key, value)`: Add tags for filtering
- `setContext(name, context)`: Add structured context data
- `measureAsync(name, operation)`: Measure async operation performance

**Configuration**:
```typescript
{
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enabled: !__DEV__,
  release: Constants.expoConfig?.version,
  dist: buildNumber,
  beforeSend: filterSensitiveData,
  ignoreErrors: ['Network request failed', 'AbortError', 'Unauthorized']
}
```

**Integration Points**:
- App initialization in `app/_layout.tsx`
- Error boundaries for React components
- API client error handlers
- Navigation tracking
- User authentication flow

#### 2. Firebase Analytics Service (`front/services/analytics.service.ts`)

**Purpose**: Track user behavior, engagement, and conversion events.

**Key Functions**:
- `initialize()`: Initialize Firebase Analytics
- `logEvent(eventName, params)`: Log custom events
- `logScreenView(screenName, screenClass)`: Track screen navigation
- `setUserId(userId)`: Set user identifier
- `setUserProperty(name, value)`: Set user properties for segmentation
- `setUserProperties(properties)`: Batch set user properties
- `setEnabled(enabled)`: Enable/disable analytics collection

**Event Types** (via `AnalyticsEvent` enum):
- App lifecycle: `APP_OPEN`, `SESSION_START`, `SESSION_END`
- Authentication: `SIGN_UP`, `LOGIN`, `LOGOUT`
- Content: `VIDEO_PLAY`, `VIDEO_PAUSE`, `VIDEO_COMPLETE`, `VIDEO_UPLOAD`
- Social: `LIKE`, `COMMENT`, `FOLLOW`, `UNFOLLOW`
- Predictions: `PREDICTION_MADE`, `PREDICTION_WON`, `PREDICTION_LOST`
- Quiz: `QUIZ_START`, `QUIZ_COMPLETE`, `QUIZ_ANSWER`
- Gamification: `COINS_EARNED`, `COINS_SPENT`, `LEVEL_UP`, `ACHIEVEMENT_UNLOCKED`

**User Properties** (via `UserProperty` enum):
- `USER_LEVEL`: Current user level
- `FAVORITE_TEAM`: User's favorite football team
- `LANGUAGE`: App language preference
- `TOTAL_COINS`: Total coins accumulated
- `TOTAL_PREDICTIONS`: Number of predictions made
- `TOTAL_VIDEOS`: Number of videos uploaded

**Configuration**:
```typescript
{
  enabled: !__DEV__, // Disabled in development
  analyticsCollectionEnabled: true
}
```

#### 3. Environment Configuration Service (`front/config/env.config.ts`)

**Purpose**: Validate and provide type-safe access to environment variables.

**New Implementation**:
```typescript
interface EnvironmentConfig {
  // API Configuration
  apiUrl: string;
  wsUrl: string;
  
  // Authentication
  clerkPublishableKey: string;
  
  // Sports Data
  sportmonksToken: string;
  
  // Monitoring (Optional)
  sentryDsn?: string;
  firebaseApiKey?: string;
  firebaseProjectId?: string;
  firebaseAppId?: string;
  
  // Feature Flags
  enableAnalytics: boolean;
  enableErrorTracking: boolean;
  enableDebugLogs: boolean;
}

class EnvironmentConfigService {
  private config: EnvironmentConfig;
  
  constructor() {
    this.config = this.loadAndValidate();
  }
  
  private loadAndValidate(): EnvironmentConfig {
    // Load from process.env
    // Validate required variables
    // Parse boolean flags
    // Return typed config
  }
  
  public get(): EnvironmentConfig {
    return this.config;
  }
  
  public validate(): ValidationResult {
    // Check all required variables
    // Return validation errors
  }
}
```

### Backend Components

#### 1. Sentry Integration (`Backend/src/config/sentry.config.ts`)

**Purpose**: Configure Sentry for Node.js/Express error tracking and performance monitoring.

**New Implementation**:
```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Express } from 'express';

export function initializeSentry(app: Express): void {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.warn('Sentry DSN not configured - error tracking disabled');
    return;
  }
  
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      new ProfilingIntegration(),
    ],
    
    beforeSend(event, hint) {
      // Filter sensitive data
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      
      // Filter password fields
      if (event.request?.data) {
        const data = event.request.data;
        if (typeof data === 'object') {
          ['password', 'token', 'secret'].forEach(key => {
            if (key in data) {
              data[key] = '[Filtered]';
            }
          });
        }
      }
      
      return event;
    },
    
    ignoreErrors: [
      'NetworkError',
      'AbortError',
      'Unauthorized',
      'Not found',
    ],
  });
  
  // Request handler must be first middleware
  app.use(Sentry.Handlers.requestHandler());
  
  // Tracing handler for performance monitoring
  app.use(Sentry.Handlers.tracingHandler());
  
  logger.info('Sentry initialized for Backend');
}

export function getSentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

export function captureException(error: Error, context?: any) {
  Sentry.captureException(error, context);
}

export function setUser(user: { id: string; username?: string; email?: string }) {
  Sentry.setUser(user);
}

export function clearUser() {
  Sentry.setUser(null);
}
```

**Integration in `Backend/src/main.ts`**:
```typescript
import { initializeSentry, getSentryErrorHandler } from './config/sentry.config';

// After app creation, before routes
initializeSentry(app);

// ... routes ...

// Error handler must be after all routes
app.use(getSentryErrorHandler());
```

#### 2. Winston-Sentry Integration (`Backend/src/utils/logger.ts`)

**Purpose**: Forward Winston logs to Sentry for centralized error tracking.

**Enhancement**:
```typescript
import winston from 'winston';
import * as Sentry from '@sentry/node';

// Custom Sentry transport for Winston
class SentryTransport extends winston.Transport {
  log(info: any, callback: () => void) {
    setImmediate(() => {
      this.emit('logged', info);
    });
    
    // Send errors to Sentry
    if (info.level === 'error') {
      Sentry.captureException(info.message, {
        level: 'error',
        extra: info.metadata || {},
      });
    } else if (info.level === 'warn') {
      Sentry.captureMessage(info.message, 'warning');
    }
    
    callback();
  }
}

// Add Sentry transport to logger
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  logger.add(new SentryTransport());
}
```

#### 3. Environment Validation Service (`Backend/src/config/env.config.ts`)

**Purpose**: Validate all required environment variables at startup.

**New Implementation**:
```typescript
interface RequiredEnvVars {
  // Database
  DATABASE_URL: string;
  
  // Authentication
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_WEBHOOK_SECRET: string;
  
  // Storage
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  
  // Media
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  
  // Sports Data
  FOOTBALL_API_KEY: string;
}

interface OptionalEnvVars {
  // Monitoring
  SENTRY_DSN?: string;
  
  // Redis
  REDIS_URL?: string;
  
  // Feature Flags
  ENABLE_ANALYTICS?: string;
  ENABLE_ERROR_TRACKING?: string;
}

class EnvironmentValidator {
  private errors: string[] = [];
  private warnings: string[] = [];
  
  validate(): { valid: boolean; errors: string[]; warnings: string[] } {
    this.validateRequired();
    this.validateOptional();
    this.validateFormats();
    
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }
  
  private validateRequired(): void {
    const required: (keyof RequiredEnvVars)[] = [
      'DATABASE_URL',
      'CLERK_SECRET_KEY',
      'CLERK_PUBLISHABLE_KEY',
      'CLERK_WEBHOOK_SECRET',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'FOOTBALL_API_KEY',
    ];
    
    for (const key of required) {
      if (!process.env[key]) {
        this.errors.push(`Missing required environment variable: ${key}`);
      }
    }
  }
  
  private validateOptional(): void {
    if (!process.env.SENTRY_DSN) {
      this.warnings.push('SENTRY_DSN not set - error tracking disabled');
    }
    
    if (!process.env.REDIS_URL) {
      this.warnings.push('REDIS_URL not set - caching disabled');
    }
  }
  
  private validateFormats(): void {
    // Validate DATABASE_URL format
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
      this.errors.push('DATABASE_URL must start with postgresql://');
    }
    
    // Validate SUPABASE_URL format
    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith('https://')) {
      this.errors.push('SUPABASE_URL must be a valid HTTPS URL');
    }
    
    // Validate Clerk keys format
    if (process.env.CLERK_SECRET_KEY && !process.env.CLERK_SECRET_KEY.startsWith('sk_')) {
      this.errors.push('CLERK_SECRET_KEY must start with sk_');
    }
    
    if (process.env.CLERK_PUBLISHABLE_KEY && !process.env.CLERK_PUBLISHABLE_KEY.startsWith('pk_')) {
      this.errors.push('CLERK_PUBLISHABLE_KEY must start with pk_');
    }
  }
}

export function validateEnvironment(): void {
  const validator = new EnvironmentValidator();
  const result = validator.validate();
  
  // Log warnings
  result.warnings.forEach(warning => logger.warn(warning));
  
  // Log and exit on errors
  if (!result.valid) {
    logger.error('Environment validation failed:');
    result.errors.forEach(error => logger.error(`  - ${error}`));
    logger.error('\nPlease check your .env file and ensure all required variables are set.');
    logger.error('See .env.example for reference.');
    process.exit(1);
  }
  
  logger.info('✅ Environment validation passed');
}
```

## Data Models

### Sentry Event Structure

```typescript
interface SentryEvent {
  event_id: string;
  timestamp: number;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  message?: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace: {
        frames: Array<{
          filename: string;
          function: string;
          lineno: number;
          colno: number;
        }>;
      };
    }>;
  };
  user?: {
    id: string;
    username?: string;
    email?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  breadcrumbs?: Array<{
    timestamp: number;
    message: string;
    category: string;
    level: string;
    data?: Record<string, any>;
  }>;
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    data?: any;
  };
  contexts?: {
    device?: {
      name: string;
      model: string;
      os: { name: string; version: string };
    };
    app?: {
      app_version: string;
      app_build: string;
    };
  };
}
```

### Firebase Analytics Event Structure

```typescript
interface AnalyticsEventParams {
  // Standard parameters
  screen_name?: string;
  screen_class?: string;
  
  // Content parameters
  video_id?: string;
  video_duration?: number;
  source?: string;
  
  // Social parameters
  target_user_id?: string;
  content_type?: string;
  
  // Prediction parameters
  match_id?: string;
  coins_spent?: number;
  prediction_type?: string;
  
  // Quiz parameters
  category_id?: string;
  question_count?: number;
  correct_answers?: number;
  score?: number;
  
  // Gamification parameters
  coins_amount?: number;
  level?: number;
  achievement_id?: string;
  
  // Conversion tracking
  value?: number;
  currency?: string;
}

interface UserProperties {
  user_level: string;
  favorite_team: string;
  language: string;
  theme: string;
  total_coins: string;
  total_predictions: string;
  total_videos: string;
}
```

### Environment Configuration Schema

```typescript
interface EnvironmentVariables {
  // Required
  required: {
    // API
    EXPO_PUBLIC_API_URL: string;
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
    EXPO_PUBLIC_SPORTMONKS_TOKEN: string;
    
    // Backend
    DATABASE_URL: string;
    CLERK_SECRET_KEY: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    FOOTBALL_API_KEY: string;
  };
  
  // Optional
  optional: {
    // Monitoring
    EXPO_PUBLIC_SENTRY_DSN?: string;
    SENTRY_DSN?: string;
    
    // Firebase
    EXPO_PUBLIC_FIREBASE_API_KEY?: string;
    EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string;
    EXPO_PUBLIC_FIREBASE_APP_ID?: string;
    
    // Feature Flags
    EXPO_PUBLIC_ENABLE_ANALYTICS?: boolean;
    EXPO_PUBLIC_ENABLE_ERROR_TRACKING?: boolean;
    EXPO_PUBLIC_ENABLE_DEBUG_LOGS?: boolean;
    
    // Development
    EXPO_PUBLIC_NGROK_URL?: string;
    EXPO_PUBLIC_LOCAL_IP?: string;
    REDIS_URL?: string;
  };
}
```

### TypeScript Configuration

```typescript
// tsconfig.json structure
interface TypeScriptConfig {
  compilerOptions: {
    // Strict type checking
    strict: true;
    noImplicitAny: true;
    strictNullChecks: true;
    strictFunctionTypes: true;
    strictBindCallApply: true;
    strictPropertyInitialization: true;
    noImplicitThis: true;
    alwaysStrict: true;
    
    // Additional checks
    noUnusedLocals: true;
    noUnusedParameters: true;
    noImplicitReturns: true;
    noFallthroughCasesInSwitch: true;
    
    // Module resolution
    moduleResolution: 'node';
    esModuleInterop: true;
    allowSyntheticDefaultImports: true;
    
    // Output
    target: 'ES2020';
    module: 'commonjs';
    declaration: true;
    sourceMap: true;
  };
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties and performed redundancy elimination:

**Redundancy Analysis**:
- Properties 1.8 and 6.12 both deal with filtering/ignoring certain data in Sentry - these can be combined into a comprehensive "Sentry data filtering" property
- Properties 1.13 and 2.15 both test user context setting on authentication - these are similar but for different services (Sentry vs Analytics), so both are needed
- Properties 6.1, 6.2, and 6.3 all test breadcrumb capture for different event types - these can be combined into one comprehensive breadcrumb property
- Properties 6.4 and 6.5 both test context/tag setting - these can be combined
- Properties 4.7 and 4.8 both test environment variable validation - 4.8 is more specific and comprehensive, so 4.7 is redundant

**Final Property Set**: After eliminating redundancy, we have 20 unique properties that provide comprehensive validation coverage.

### Property 1: Sensitive Data Filtering

*For any* error event sent to Sentry, all sensitive data (Authorization headers, cookies, password fields, tokens, secrets) SHALL be filtered or redacted before transmission.

**Validates: Requirements 1.8, 6.12**

### Property 2: Exception Capture Completeness

*For any* unhandled exception that occurs in the application, the Sentry service SHALL capture the exception with a complete stack trace including filename, function name, and line numbers.

**Validates: Requirements 1.10**

### Property 3: User Context Setting on Authentication

*For any* user authentication event, the Sentry service SHALL set user context containing at minimum the user ID, and optionally username and email if available.

**Validates: Requirements 1.13**

### Property 4: Screen View Event Logging

*For any* screen navigation event in the Frontend, the Analytics service SHALL log a screen_view event with the screen name parameter.

**Validates: Requirements 2.7**

### Property 5: Analytics User Context Setting

*For any* user authentication event, the Analytics service SHALL set the user ID and relevant user properties (level, favorite_team, language).

**Validates: Requirements 2.15**

### Property 6: Analytics Graceful Failure

*For any* Firebase Analytics initialization failure, the Frontend application SHALL continue functioning without crashing or blocking user interactions.

**Validates: Requirements 2.18, 5.6**

### Property 7: Environment Variable Validation Failure

*For any* missing required environment variable at application startup, the application SHALL log a clear error message identifying the missing variable and exit with a non-zero status code.

**Validates: Requirements 4.7, 4.8**

### Property 8: Database URL Format Validation

*For any* DATABASE_URL value that does not start with "postgresql://", the Backend environment validation SHALL fail with an appropriate error message.

**Validates: Requirements 4.13**

### Property 9: API URL Format Validation

*For any* EXPO_PUBLIC_API_URL value that is not a valid HTTP/HTTPS URL format, the Frontend environment validation SHALL fail with an appropriate error message.

**Validates: Requirements 4.17**

### Property 10: Breadcrumb Capture for Events

*For any* user action, navigation event, or API call, the Sentry service SHALL capture a breadcrumb with the event type, timestamp, and relevant context data.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 11: Context and Tag Setting

*For any* error or event captured by Sentry, relevant tags (feature name, platform, screen) and context (device info, app version) SHALL be attached for debugging purposes.

**Validates: Requirements 6.4, 6.5**

### Property 12: Performance Span Tracking

*For any* critical operation (API calls, database queries, file uploads), the Sentry service SHALL create a performance span with operation name, start time, and duration.

**Validates: Requirements 6.6**

### Property 13: Network Failure Capture

*For any* network request that fails with an error, the Sentry service SHALL capture the request details (URL, method, headers) and response status code.

**Validates: Requirements 6.7**

### Property 14: Database Error Capture

*For any* database query that fails with an error, the Backend Sentry integration SHALL capture the query type (SELECT, INSERT, UPDATE, DELETE) and error details.

**Validates: Requirements 6.8**

### Property 15: Error Severity Classification

*For any* error captured by Sentry, the appropriate severity level (fatal, error, warning, info, debug) SHALL be assigned based on the error type and impact.

**Validates: Requirements 6.13**

### Example Test 1: Sentry Initialization with Valid DSN

WHEN the Frontend application calls initSentry() with a valid EXPO_PUBLIC_SENTRY_DSN environment variable, THEN Sentry SHALL be initialized with the correct configuration including DSN, environment, and sample rates.

**Validates: Requirements 1.3, 1.5, 1.7**

### Example Test 2: Sentry Initialization with Valid DSN (Backend)

WHEN the Backend application calls initializeSentry() with a valid SENTRY_DSN environment variable, THEN Sentry SHALL be initialized with the correct configuration including DSN, environment, sample rates, and Express integration.

**Validates: Requirements 1.4, 1.6, 1.7**

### Example Test 3: Sentry Release Tracking Configuration

WHEN Sentry is initialized, THEN the configuration SHALL include the release version from app constants and the build number/distribution identifier.

**Validates: Requirements 1.9**

### Example Test 4: User Context Clearing on Logout

WHEN a user logs out of the application, THEN the Sentry service SHALL clear the user context by calling setUser(null).

**Validates: Requirements 1.14**

### Example Test 5: Firebase Analytics Initialization

WHEN the Frontend application calls analytics.initialize(), THEN Firebase Analytics SHALL be initialized and data collection SHALL be enabled (unless in development environment).

**Validates: Requirements 2.4**

### Example Test 6: Authentication Event Tracking

WHEN a user signs up, logs in, or logs out, THEN the Analytics service SHALL log the corresponding event (sign_up, login, or logout) with appropriate parameters.

**Validates: Requirements 2.9**

### Example Test 7: Content Event Tracking

WHEN a user plays, pauses, completes, or uploads a video, THEN the Analytics service SHALL log the corresponding content event (video_play, video_pause, video_complete, video_upload) with video ID and duration parameters.

**Validates: Requirements 2.10**

### Example Test 8: Social Event Tracking

WHEN a user likes, comments, follows, or unfollows, THEN the Analytics service SHALL log the corresponding social event with target user ID and content type parameters.

**Validates: Requirements 2.11**

### Example Test 9: Gamification Event Tracking

WHEN coins are earned/spent, a user levels up, or an achievement is unlocked, THEN the Analytics service SHALL log the corresponding gamification event with relevant parameters (coins amount, level, achievement ID).

**Validates: Requirements 2.12**

### Example Test 10: Prediction Event Tracking

WHEN a prediction is made, won, or lost, THEN the Analytics service SHALL log the corresponding prediction event with match ID, coins spent, and prediction type parameters.

**Validates: Requirements 2.13**

### Example Test 11: Quiz Event Tracking

WHEN a quiz starts, completes, or an answer is submitted, THEN the Analytics service SHALL log the corresponding quiz event with category ID, question count, and score parameters.

**Validates: Requirements 2.14**

### Example Test 12: Analytics Disabled in Development

WHEN the application is running in development mode (__DEV__ === true), THEN the Analytics service SHALL disable data collection and only log events locally.

**Validates: Requirements 2.16**

### Example Test 13: Backend TypeScript Compilation

WHEN the Backend TypeScript compiler (tsc) runs, THEN the compilation SHALL complete successfully with zero errors and generate JavaScript output in the dist/ directory.

**Validates: Requirements 3.1**

### Example Test 14: Frontend TypeScript Compilation

WHEN the Frontend TypeScript compiler runs during build, THEN the compilation SHALL complete successfully with zero errors and generate the application bundle.

**Validates: Requirements 3.2**

### Example Test 15: TypeScript Strict Mode Configuration

WHEN examining the tsconfig.json files for Frontend and Backend, THEN both SHALL have "strict": true, "noImplicitReturns": true, and "noFallthroughCasesInSwitch": true enabled.

**Validates: Requirements 3.3, 3.4, 3.5**

### Example Test 16: Explicit Type Usage

WHEN analyzing the codebase, THEN all function parameters and return values SHALL have explicit type annotations, and usage of 'any' type SHALL be minimal and justified with comments.

**Validates: Requirements 3.6, 3.7**

### Example Test 17: API Response Type Definitions

WHEN examining API client code, THEN all API response shapes SHALL have corresponding TypeScript interfaces defined.

**Validates: Requirements 3.9**

### Example Test 18: Component Props Type Definitions

WHEN examining React components, THEN all component props SHALL have TypeScript interfaces or types defined.

**Validates: Requirements 3.10**

### Example Test 19: Build Failure on Type Errors

WHEN the TypeScript compiler encounters type errors, THEN the build process SHALL fail with a non-zero exit code and display the error messages.

**Validates: Requirements 3.13**

### Example Test 20: No Hardcoded Secrets

WHEN searching the codebase for patterns matching API keys or secrets (long alphanumeric strings, "key", "secret", "token" followed by values), THEN no hardcoded credentials SHALL be found outside of .env.example files.

**Validates: Requirements 4.6**

### Example Test 21: Clerk Key Usage (Backend)

WHEN the Backend authentication middleware initializes, THEN it SHALL use the CLERK_SECRET_KEY environment variable (not CLERK_PUBLISHABLE_KEY).

**Validates: Requirements 4.11**

### Example Test 22: Clerk Key Usage (Frontend)

WHEN the Frontend Clerk provider initializes, THEN it SHALL use the EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable.

**Validates: Requirements 4.12**

### Example Test 23: Supabase Key Validation

WHEN the Backend starts, THEN it SHALL validate that SUPABASE_SERVICE_ROLE_KEY is present and non-empty.

**Validates: Requirements 4.14**

### Example Test 24: Cloudinary Keys Validation

WHEN the Backend starts, THEN it SHALL validate that CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are present and non-empty.

**Validates: Requirements 4.15**

### Example Test 25: Football API Key Validation

WHEN the Backend starts, THEN it SHALL validate that FOOTBALL_API_KEY is present and non-empty.

**Validates: Requirements 4.16**

### Example Test 26: Sportmonks Token Validation

WHEN the Frontend starts, THEN it SHALL validate that EXPO_PUBLIC_SPORTMONKS_TOKEN is present and non-empty.

**Validates: Requirements 4.18**

### Example Test 27: Environment-Specific Configuration

WHEN the application runs in development vs production, THEN configuration values (sample rates, logging levels, feature flags) SHALL differ appropriately based on NODE_ENV or __DEV__.

**Validates: Requirements 4.21**

### Example Test 28: Gitignore Configuration

WHEN examining the .gitignore file, THEN it SHALL contain entries for .env, .env.local, and .env.*.local to prevent committing environment files.

**Validates: Requirements 4.22**

### Example Test 29: Sentry Initialization Failure Handling

WHEN Sentry initialization fails (invalid DSN, network error), THEN the Frontend SHALL log a warning message and continue application startup without crashing.

**Validates: Requirements 5.5**

### Example Test 30: Backend Successful Startup

WHEN the Backend starts with all required environment variables present and valid, THEN it SHALL log "✅ Environment validation passed" and "✅ Sentry initialized for Backend".

**Validates: Requirements 5.7, 5.14**

### Example Test 31: Frontend Successful Initialization

WHEN the Frontend initializes with valid configuration, THEN it SHALL log "Sentry initialized" and "Analytics initialized" (or "Analytics disabled in development").

**Validates: Requirements 5.15**

### Example Test 32: Session Event Tracking

WHEN a user opens the app or a session starts/ends, THEN the Analytics service SHALL log session events for retention tracking.

**Validates: Requirements 6.9**

### Example Test 33: Conversion Event Tracking

WHEN a user makes a prediction or uploads a video, THEN the Analytics service SHALL log a conversion event with value parameter for tracking.

**Validates: Requirements 6.10**

### Example Test 34: User Property Segmentation

WHEN user properties are set, THEN the Analytics service SHALL include level, favorite_team, and language for segmentation purposes.

**Validates: Requirements 6.11**

## Error Handling

### Error Categories and Handling Strategies

#### 1. Initialization Errors

**Sentry Initialization Failure**:
- Cause: Invalid DSN, network connectivity issues, Sentry service outage
- Handling: Log warning, disable error tracking, continue application startup
- User Impact: None - application functions normally without error tracking
- Recovery: Automatic on next restart if issue resolved

**Firebase Analytics Initialization Failure**:
- Cause: Missing configuration files, invalid API keys, Firebase service issues
- Handling: Log warning, disable analytics, continue application startup
- User Impact: None - application functions normally without analytics
- Recovery: Automatic on next restart if issue resolved

#### 2. Configuration Errors

**Missing Required Environment Variables**:
- Cause: .env file not created, variables not set, typos in variable names
- Handling: Log detailed error message listing missing variables, exit with code 1
- User Impact: Application fails to start
- Recovery: User must add missing variables to .env file and restart

**Invalid Environment Variable Format**:
- Cause: Malformed URLs, incorrect key prefixes, invalid connection strings
- Handling: Log validation error with expected format, exit with code 1
- User Impact: Application fails to start
- Recovery: User must correct variable format and restart

#### 3. Runtime Errors

**Sentry Event Capture Failure**:
- Cause: Network issues, rate limiting, Sentry quota exceeded
- Handling: Log locally, queue for retry, continue application execution
- User Impact: None - error still logged locally
- Recovery: Automatic retry on next error or network recovery

**Analytics Event Logging Failure**:
- Cause: Network issues, Firebase quota exceeded, invalid event parameters
- Handling: Log warning, drop event, continue application execution
- User Impact: None - analytics data point lost but app continues
- Recovery: Subsequent events will be logged normally

#### 4. TypeScript Compilation Errors

**Type Errors During Build**:
- Cause: Type mismatches, missing type definitions, incorrect type usage
- Handling: Display error messages with file and line numbers, fail build
- User Impact: Cannot deploy until errors fixed
- Recovery: Developer must fix type errors and rebuild

**Missing Type Definitions**:
- Cause: Third-party library without types, missing @types package
- Handling: TypeScript compiler error, fail build
- User Impact: Cannot deploy until types added
- Recovery: Install @types package or create custom type definitions

### Error Logging and Monitoring

All errors SHALL be logged with the following information:
- Timestamp (ISO 8601 format)
- Error type/category
- Error message
- Stack trace (for exceptions)
- Context (user ID, request ID, operation)
- Environment (development/production)

**Log Levels**:
- `fatal`: Application cannot continue (missing required config)
- `error`: Operation failed but app continues (API call failed)
- `warn`: Potential issue or degraded functionality (Sentry disabled)
- `info`: Normal operations (successful initialization)
- `debug`: Detailed debugging information (development only)

### Graceful Degradation

The system SHALL gracefully degrade when optional services fail:

1. **Sentry Unavailable**: Application continues with local logging only
2. **Firebase Analytics Unavailable**: Application continues without analytics tracking
3. **Redis Unavailable**: Application continues without caching (direct database queries)
4. **External API Unavailable**: Application shows cached data or appropriate error message

Critical services that prevent startup if unavailable:
- Database (PostgreSQL)
- Authentication service (Clerk)
- Storage service (Supabase/Cloudinary)

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and integration points
- Sentry initialization with valid/invalid DSN
- Firebase Analytics initialization
- Environment variable validation with specific missing variables
- TypeScript compilation success
- Configuration file structure
- Specific event tracking (login, video play, etc.)

**Property-Based Tests**: Verify universal properties across all inputs
- Sensitive data filtering for any error event
- Exception capture for any thrown error
- User context setting for any authentication
- Breadcrumb capture for any user action
- Environment validation failure for any missing required variable
- URL format validation for any invalid URL

### Property-Based Testing Configuration

All property tests SHALL:
- Run minimum 100 iterations per test (due to randomization)
- Use fast-check library for input generation
- Reference the design document property in test comments
- Tag format: `Feature: infrastructure-setup-and-configuration, Property {number}: {property_text}`

### Test Organization

#### Frontend Tests (`front/__tests__/`)

```
front/__tests__/
├── services/
│   ├── sentry.service.test.ts          # Unit tests for Sentry service
│   ├── sentry.service.property.test.ts # Property tests for Sentry
│   ├── analytics.service.test.ts       # Unit tests for Analytics
│   └── analytics.service.property.test.ts # Property tests for Analytics
├── config/
│   ├── env.config.test.ts              # Unit tests for env validation
│   └── env.config.property.test.ts     # Property tests for env validation
└── integration/
    └── infrastructure.integration.test.ts # Integration tests
```

#### Backend Tests (`Backend/src/__tests__/`)

```
Backend/src/__tests__/
├── config/
│   ├── sentry.config.test.ts           # Unit tests for Sentry config
│   ├── sentry.config.property.test.ts  # Property tests for Sentry
│   ├── env.config.test.ts              # Unit tests for env validation
│   └── env.config.property.test.ts     # Property tests for env validation
├── utils/
│   └── logger.test.ts                  # Tests for Winston-Sentry integration
└── integration/
    └── infrastructure.integration.test.ts # Integration tests
```

### Test Examples

#### Property Test Example (Sensitive Data Filtering)

```typescript
import fc from 'fast-check';
import { beforeSend } from './sentry.config';

describe('Feature: infrastructure-setup-and-configuration, Property 1: Sensitive Data Filtering', () => {
  it('should filter sensitive data from any error event', () => {
    fc.assert(
      fc.property(
        fc.record({
          request: fc.record({
            headers: fc.dictionary(
              fc.string(),
              fc.string()
            ),
            data: fc.record({
              password: fc.string(),
              token: fc.string(),
              email: fc.string(),
            }),
          }),
        }),
        (event) => {
          const filtered = beforeSend(event);
          
          // Verify sensitive headers removed
          expect(filtered.request?.headers?.authorization).toBeUndefined();
          expect(filtered.request?.headers?.cookie).toBeUndefined();
          
          // Verify sensitive fields filtered
          expect(filtered.request?.data?.password).toBe('[Filtered]');
          expect(filtered.request?.data?.token).toBe('[Filtered]');
          
          // Verify non-sensitive data preserved
          expect(filtered.request?.data?.email).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Unit Test Example (Sentry Initialization)

```typescript
import { initSentry } from './sentry.service';
import * as Sentry from '@sentry/react-native';

jest.mock('@sentry/react-native');

describe('Sentry Initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should initialize Sentry with valid DSN', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
    
    initSentry();
    
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://test@sentry.io/123',
        environment: expect.any(String),
        tracesSampleRate: expect.any(Number),
      })
    );
  });
  
  it('should not initialize Sentry without DSN', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    
    initSentry();
    
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});
```

### Integration Testing

Integration tests SHALL verify:
1. Sentry captures errors from React error boundaries
2. Sentry captures errors from Express middleware
3. Firebase Analytics logs events from user actions
4. Environment validation runs before app initialization
5. TypeScript compilation runs before deployment
6. Winston logger forwards errors to Sentry

### Manual Testing Checklist

Before deployment, manually verify:
- [ ] Sentry dashboard shows test errors from Frontend
- [ ] Sentry dashboard shows test errors from Backend
- [ ] Firebase Console shows test events
- [ ] Application starts with all required env vars
- [ ] Application fails gracefully with missing env vars
- [ ] TypeScript compilation fails with intentional type error
- [ ] Error boundaries capture and report React errors
- [ ] User context appears in Sentry events after login
- [ ] Breadcrumbs appear in Sentry error details
- [ ] Analytics events appear in Firebase Console
- [ ] No sensitive data in Sentry error reports

### Performance Testing

Verify performance impact of monitoring:
- Sentry initialization time < 100ms
- Firebase Analytics initialization time < 100ms
- Error capture overhead < 10ms per error
- Analytics event logging overhead < 5ms per event
- No memory leaks from breadcrumb accumulation
- No performance degradation with Sentry enabled

### Documentation Testing

Verify documentation completeness:
- [ ] .env.example files contain all variables
- [ ] Each variable has description comment
- [ ] Setup instructions for Sentry are clear
- [ ] Setup instructions for Firebase are clear
- [ ] Troubleshooting guide covers common issues
- [ ] Code examples are correct and runnable

