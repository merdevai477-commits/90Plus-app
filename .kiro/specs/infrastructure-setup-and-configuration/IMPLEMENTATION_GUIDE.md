# Implementation Guide: Infrastructure Setup and Configuration

## Phase 1: Sentry Setup (Frontend & Backend)

### Step 1.1: Install Packages

**Frontend**:
```bash
cd front
npm install @sentry/react-native
npx @sentry/wizard@latest -i reactNative -p ios android
```

**Backend**:
```bash
cd Backend
npm install @sentry/node @sentry/profiling-node
```

### Step 1.2: Configure Environment Variables

**Frontend (.env)**:
```bash
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
EXPO_PUBLIC_ENABLE_ERROR_TRACKING=true
```

**Backend (.env)**:
```bash
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### Step 1.3: Initialize Sentry (Frontend)

Update `front/app/_layout.tsx`:
```typescript
import { initSentry } from '../services/sentry.service';

// Initialize Sentry before app renders
initSentry();

export default function RootLayout() {
  // ... rest of layout
}
```

### Step 1.4: Initialize Sentry (Backend)

Create `Backend/src/config/sentry.config.ts` (see design document for full implementation).

Update `Backend/src/main.ts`:
```typescript
import { initializeSentry, getSentryErrorHandler } from './config/sentry.config';

// After app creation
initializeSentry(app);

// ... middleware and routes ...

// Error handler (must be after all routes)
app.use(getSentryErrorHandler());
```

### Step 1.5: Integrate with Winston Logger

Update `Backend/src/utils/logger.ts` to add Sentry transport (see design document).

### Step 1.6: Test Sentry Integration

**Frontend Test**:
```typescript
import { captureException } from './services/sentry.service';

// Trigger test error
try {
  throw new Error('Test error from Frontend');
} catch (error) {
  captureException(error, {
    tags: { feature: 'test' },
    level: 'error',
  });
}
```

**Backend Test**:
```typescript
import { captureException } from './config/sentry.config';

// Trigger test error
app.get('/test-sentry', (req, res) => {
  try {
    throw new Error('Test error from Backend');
  } catch (error) {
    captureException(error);
    res.json({ message: 'Error sent to Sentry' });
  }
});
```

## Phase 2: Firebase Analytics Setup (Frontend Only)

### Step 2.1: Install Packages

```bash
cd front
npm install @react-native-firebase/app @react-native-firebase/analytics
```

### Step 2.2: Configure Firebase

**Android**: Add `google-services.json` to `front/android/app/`

**iOS**: Add `GoogleService-Info.plist` to `front/ios/`

Update `app.json`:
```json
{
  "expo": {
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/analytics"
    ]
  }
}
```

### Step 2.3: Update Environment Variables

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
EXPO_PUBLIC_ENABLE_ANALYTICS=true
```

### Step 2.4: Initialize Firebase Analytics

Update `front/app/_layout.tsx`:
```typescript
import { analytics } from '../services/analytics.service';

useEffect(() => {
  // Initialize analytics
  analytics.initialize();
}, []);
```

### Step 2.5: Implement Analytics Service

Update `front/services/analytics.service.ts` to replace placeholder implementation with actual Firebase calls (see design document).

### Step 2.6: Add Analytics Tracking

**Screen Tracking**:
```typescript
import { trackScreenView } from '../services/analytics.service';

useEffect(() => {
  trackScreenView('Home');
}, []);
```

**Event Tracking**:
```typescript
import { trackEvent, AnalyticsEvent } from '../services/analytics.service';

const handleVideoPlay = (videoId: string) => {
  trackEvent(AnalyticsEvent.VIDEO_PLAY, {
    video_id: videoId,
    source: 'home_feed',
  });
};
```

### Step 2.7: Test Firebase Analytics

Check Firebase Console > Analytics > DebugView for real-time events.

## Phase 3: TypeScript Error Resolution

### Step 3.1: Update TypeScript Configuration

**Frontend (front/tsconfig.json)**:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Backend (Backend/tsconfig.json)**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "./dist"
  }
}
```

### Step 3.2: Run TypeScript Compiler

**Frontend**:
```bash
cd front
npx tsc --noEmit
```

**Backend**:
```bash
cd Backend
npm run build
```

### Step 3.3: Fix Type Errors Systematically

1. Start with files with fewest errors
2. Add explicit types to function parameters and return values
3. Replace `any` with proper types
4. Add interfaces for API responses
5. Add types for component props
6. Install missing @types packages

**Common Fixes**:

```typescript
// Before
function fetchUser(id) {
  return api.get(`/users/${id}`);
}

// After
interface User {
  id: string;
  username: string;
  email: string;
}

async function fetchUser(id: string): Promise<User> {
  const response = await api.get<User>(`/users/${id}`);
  return response.data;
}
```

### Step 3.4: Verify No Errors

```bash
# Frontend
cd front && npx tsc --noEmit

# Backend
cd Backend && npm run build
```

Both should complete with zero errors.

## Phase 4: Environment Variables Audit

### Step 4.1: Create Environment Validation Service

**Frontend**: Create `front/config/env.config.ts` (see design document)

**Backend**: Create `Backend/src/config/env.config.ts` (see design document)

### Step 4.2: Update .env.example Files

**Frontend (.env.example)**:
```bash
# ============================================
# API Configuration
# ============================================
EXPO_PUBLIC_API_URL=https://90plus-app-production.up.railway.app/api
EXPO_PUBLIC_WS_URL=wss://90plus-app-production.up.railway.app

# ============================================
# Authentication (Clerk)
# Get from: https://dashboard.clerk.com/
# ============================================
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here

# ============================================
# Sports Data API
# Get from: https://www.sportmonks.com/
# ============================================
EXPO_PUBLIC_SPORTMONKS_TOKEN=your_sportmonks_token_here

# ============================================
# Error Tracking (Sentry)
# Get from: https://sentry.io/settings/projects/
# Optional - app works without it
# ============================================
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id

# ============================================
# Analytics (Firebase)
# Get from: https://console.firebase.google.com/
# Optional - app works without it
# ============================================
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id

# ============================================
# Feature Flags
# ============================================
EXPO_PUBLIC_ENABLE_ANALYTICS=false
EXPO_PUBLIC_ENABLE_ERROR_TRACKING=false
EXPO_PUBLIC_ENABLE_DEBUG_LOGS=false

# ============================================
# Development (Optional)
# ============================================
EXPO_PUBLIC_NGROK_URL=
EXPO_PUBLIC_LOCAL_IP=192.168.1.7
```

**Backend (.env.example)**:
```bash
# ============================================
# Server Configuration
# ============================================
NODE_ENV=development
PORT=3000
API_PREFIX=/api

# ============================================
# Database Configuration (Neon/Supabase)
# Get from: https://neon.tech/ or https://supabase.com/
# Format: postgresql://username:password@host/database?sslmode=require
# ============================================
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?sslmode=require"

# ============================================
# Authentication (Clerk)
# Get from: https://dashboard.clerk.com/
# ============================================
CLERK_SECRET_KEY=sk_test_your_secret_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# ============================================
# Storage (Supabase)
# Get from: https://supabase.com/dashboard/project/_/settings/api
# ============================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Storage Buckets
SUPABASE_STORAGE_BUCKET_AVATARS=avatars
SUPABASE_STORAGE_BUCKET_REELS=reels
SUPABASE_STORAGE_BUCKET_THUMBNAILS=thumbnails

# ============================================
# Media Upload (Cloudinary)
# Get from: https://cloudinary.com/console
# ============================================
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here

# File Size Limits (in bytes)
MAX_AVATAR_SIZE=5242880
MAX_REEL_SIZE=104857600
MAX_THUMBNAIL_SIZE=2097152

# ============================================
# Sports Data API
# Get from: https://www.api-football.com/
# ============================================
FOOTBALL_API_KEY=your_football_api_key_here

# ============================================
# Error Tracking (Sentry)
# Get from: https://sentry.io/settings/projects/
# Optional - app works without it
# ============================================
SENTRY_DSN=https://your-dsn@sentry.io/project-id

# ============================================
# Caching (Redis)
# Get from: https://redis.com/ or https://upstash.com/
# Optional - app works without it
# ============================================
REDIS_URL=redis://localhost:6379

# ============================================
# Feature Flags
# ============================================
ENABLE_ANALYTICS=false
ENABLE_ERROR_TRACKING=false
```

### Step 4.3: Integrate Environment Validation

**Frontend (front/app/_layout.tsx)**:
```typescript
import { validateEnvironment } from '../config/env.config';

// Validate environment before rendering
useEffect(() => {
  const result = validateEnvironment();
  if (!result.valid) {
    console.error('Environment validation failed:', result.errors);
    // Show error screen or alert
  }
}, []);
```

**Backend (Backend/src/main.ts)**:
```typescript
import { validateEnvironment } from './config/env.config';

// Validate before starting server
validateEnvironment(); // Will exit if validation fails

async function startServer() {
  // ... rest of startup
}
```

### Step 4.4: Verify No Hardcoded Secrets

```bash
# Search for potential hardcoded secrets
grep -r "sk_" --exclude-dir=node_modules --exclude=".env*"
grep -r "pk_test" --exclude-dir=node_modules --exclude=".env*"
grep -r "api_key" --exclude-dir=node_modules --exclude=".env*"
```

All matches should be in .env.example or configuration files that read from process.env.

## Phase 5: Integration Testing

### Step 5.1: Test Sentry Integration

1. Trigger test error in Frontend
2. Trigger test error in Backend
3. Verify errors appear in Sentry dashboard
4. Verify user context is attached
5. Verify breadcrumbs are captured
6. Verify sensitive data is filtered

### Step 5.2: Test Firebase Analytics

1. Trigger test events (screen view, button click, etc.)
2. Open Firebase Console > Analytics > DebugView
3. Verify events appear in real-time
4. Verify event parameters are correct
5. Verify user properties are set

### Step 5.3: Test Environment Validation

1. Remove required variable from .env
2. Start application
3. Verify clear error message
4. Verify application exits
5. Restore variable and verify startup succeeds

### Step 5.4: Test TypeScript Compilation

1. Introduce intentional type error
2. Run build command
3. Verify build fails with error message
4. Fix error and verify build succeeds

## Phase 6: Documentation

### Step 6.1: Update README Files

Add sections for:
- Sentry setup instructions
- Firebase Analytics setup instructions
- Environment variable configuration
- TypeScript compilation
- Troubleshooting common issues

### Step 6.2: Create Troubleshooting Guide

Document solutions for:
- Sentry initialization failures
- Firebase Analytics not logging events
- Environment validation errors
- TypeScript compilation errors
- Missing type definitions

### Step 6.3: Add Code Examples

Include examples for:
- Capturing errors with Sentry
- Logging analytics events
- Setting user context
- Adding breadcrumbs
- Tracking performance

## Deployment Checklist

Before deploying to production:

- [ ] Sentry DSN configured for production
- [ ] Firebase Analytics configured for production
- [ ] All TypeScript errors resolved
- [ ] All required environment variables documented
- [ ] No hardcoded secrets in codebase
- [ ] Environment validation runs at startup
- [ ] Sentry captures test errors successfully
- [ ] Firebase Analytics logs test events successfully
- [ ] Error boundaries integrated with Sentry
- [ ] Winston logger forwards to Sentry
- [ ] Sensitive data filtered from error reports
- [ ] Sample rates configured appropriately (20% for production)
- [ ] Release version and build number tracked
- [ ] User context set on authentication
- [ ] Breadcrumbs captured for user actions
- [ ] Performance spans tracked for critical operations
- [ ] Documentation updated
- [ ] Tests passing (unit and property-based)

## Rollback Plan

If issues occur after deployment:

1. **Disable Sentry**: Set `SENTRY_DSN` to empty string
2. **Disable Analytics**: Set `ENABLE_ANALYTICS` to false
3. **Revert TypeScript Changes**: Restore previous tsconfig.json
4. **Restore Environment Variables**: Use previous .env configuration
5. **Redeploy Previous Version**: Use git to revert to last working commit

## Monitoring Post-Deployment

After deployment, monitor:

1. **Sentry Dashboard**: Check for new errors and error rates
2. **Firebase Console**: Check analytics event volume
3. **Application Logs**: Verify successful initialization
4. **Performance Metrics**: Check for performance degradation
5. **User Reports**: Monitor for user-reported issues

## Support Resources

- Sentry Documentation: https://docs.sentry.io/
- Firebase Analytics Documentation: https://firebase.google.com/docs/analytics
- TypeScript Documentation: https://www.typescriptlang.org/docs/
- Expo Documentation: https://docs.expo.dev/
- Express Documentation: https://expressjs.com/

