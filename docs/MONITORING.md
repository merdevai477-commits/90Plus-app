# 📊 Monitoring & Analytics Guide

## Overview

This document outlines the monitoring, analytics, and observability strategy for the 90Plus mobile application.

## Current Status

🟡 **Partially Implemented**
- ✅ Logger service configured
- ✅ Error boundaries in place
- ⏳ Error tracking (Sentry) - Planned
- ⏳ Analytics (Firebase) - Planned
- ⏳ Performance monitoring - Planned

## Monitoring Stack (Planned)

### 1. Error Tracking: Sentry

**Purpose**: Track crashes, errors, and exceptions in production

**Setup**:

```bash
# Install Sentry
npm install @sentry/react-native

# Initialize Sentry plugin
npx @sentry/wizard -i reactNative -p ios android
```

**Configuration**:

```typescript
// app/_layout.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  
  // Performance monitoring
  tracesSampleRate: 0.2, // 20% of transactions
  
  // Session replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of errors
  
  // Release tracking
  release: Constants.expoConfig?.version,
  dist: Constants.expoConfig?.ios?.buildNumber,
  
  // Integrations
  integrations: [
    new Sentry.ReactNativeTracing({
      routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
    }),
  ],
  
  // Filter sensitive data
  beforeSend(event) {
    // Remove sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.Authorization;
    }
    return event;
  },
});
```

**Usage**:

```typescript
// Capture exceptions
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: 'video-upload',
      userId: user.id,
    },
    extra: {
      videoSize: file.size,
      duration: file.duration,
    },
  });
  throw error;
}

// Capture messages
Sentry.captureMessage('User completed onboarding', {
  level: 'info',
  tags: { flow: 'onboarding' },
});

// Set user context
Sentry.setUser({
  id: user.id,
  username: user.username,
  email: user.email,
});

// Add breadcrumbs
Sentry.addBreadcrumb({
  category: 'navigation',
  message: 'User navigated to profile',
  level: 'info',
});
```

### 2. Analytics: Firebase Analytics

**Purpose**: Track user behavior, engagement, and conversion

**Setup**:

```bash
# Install Firebase
npm install @react-native-firebase/app @react-native-firebase/analytics

# Configure Firebase
# Add google-services.json (Android)
# Add GoogleService-Info.plist (iOS)
```

**Configuration**:

```typescript
// services/analytics.ts
import analytics from '@react-native-firebase/analytics';

export class AnalyticsService {
  /**
   * Track screen view
   */
  static async logScreenView(screenName: string) {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  }
  
  /**
   * Track custom event
   */
  static async logEvent(
    eventName: string,
    params?: Record<string, any>
  ) {
    await analytics().logEvent(eventName, params);
  }
  
  /**
   * Set user properties
   */
  static async setUserProperties(properties: Record<string, string>) {
    for (const [key, value] of Object.entries(properties)) {
      await analytics().setUserProperty(key, value);
    }
  }
  
  /**
   * Set user ID
   */
  static async setUserId(userId: string) {
    await analytics().setUserId(userId);
  }
}
```

**Usage**:

```typescript
// Track screen views
useEffect(() => {
  AnalyticsService.logScreenView('Home');
}, []);

// Track events
const handleVideoPlay = async (videoId: string) => {
  await AnalyticsService.logEvent('video_played', {
    video_id: videoId,
    source: 'home_feed',
  });
};

// Track conversions
const handlePrediction = async (matchId: string, coins: number) => {
  await AnalyticsService.logEvent('prediction_made', {
    match_id: matchId,
    coins_spent: coins,
    value: coins, // For conversion tracking
  });
};

// Set user properties
await AnalyticsService.setUserProperties({
  user_level: user.level.toString(),
  favorite_team: user.favoriteTeam,
  language: language,
});
```

### 3. Performance Monitoring

**Purpose**: Track app performance, load times, and bottlenecks

**Setup**:

```bash
# Install Firebase Performance
npm install @react-native-firebase/perf
```

**Configuration**:

```typescript
// services/performance.ts
import perf from '@react-native-firebase/perf';

export class PerformanceService {
  /**
   * Track custom trace
   */
  static async trace<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const trace = await perf().startTrace(name);
    
    try {
      const result = await fn();
      await trace.stop();
      return result;
    } catch (error) {
      await trace.stop();
      throw error;
    }
  }
  
  /**
   * Track HTTP request
   */
  static async trackHttpRequest(
    url: string,
    method: string,
    fn: () => Promise<Response>
  ): Promise<Response> {
    const metric = await perf().newHttpMetric(url, method);
    await metric.start();
    
    try {
      const response = await fn();
      metric.setHttpResponseCode(response.status);
      metric.setResponseContentType(
        response.headers.get('content-type') || ''
      );
      await metric.stop();
      return response;
    } catch (error) {
      await metric.stop();
      throw error;
    }
  }
}
```

**Usage**:

```typescript
// Track custom operations
const matches = await PerformanceService.trace(
  'fetch_matches',
  () => fetchMatches(date)
);

// Track API calls
const response = await PerformanceService.trackHttpRequest(
  `${API_URL}/matches`,
  'GET',
  () => fetch(`${API_URL}/matches`)
);

// Track screen load time
useEffect(() => {
  const trace = perf().startTrace('home_screen_load');
  
  // Simulate data loading
  loadData().then(() => {
    trace.stop();
  });
  
  return () => {
    trace.stop();
  };
}, []);
```

## Key Metrics to Track

### 1. User Engagement

```typescript
// Daily Active Users (DAU)
await AnalyticsService.logEvent('app_open');

// Session duration
const sessionStart = Date.now();
// ... on app close
const sessionDuration = Date.now() - sessionStart;
await AnalyticsService.logEvent('session_end', {
  duration_seconds: Math.floor(sessionDuration / 1000),
});

// Feature usage
await AnalyticsService.logEvent('feature_used', {
  feature_name: 'predictions',
  frequency: 'daily',
});
```

### 2. User Retention

```typescript
// First time user
await AnalyticsService.logEvent('first_open');

// Returning user
await AnalyticsService.logEvent('app_open', {
  user_type: 'returning',
  days_since_install: daysSinceInstall,
});

// Churn indicators
await AnalyticsService.logEvent('user_inactive', {
  days_inactive: daysInactive,
});
```

### 3. Conversion Metrics

```typescript
// Onboarding completion
await AnalyticsService.logEvent('onboarding_complete', {
  time_taken_seconds: timeTaken,
  steps_completed: stepsCompleted,
});

// In-app actions
await AnalyticsService.logEvent('prediction_made', {
  coins_spent: coins,
  match_type: matchType,
});

// Social actions
await AnalyticsService.logEvent('video_shared', {
  video_id: videoId,
  share_method: 'whatsapp',
});
```

### 4. Performance Metrics

```typescript
// App startup time
const startupTrace = await perf().startTrace('app_startup');
// ... app initialization
await startupTrace.stop();

// Screen load time
const screenTrace = await perf().startTrace('screen_load_home');
// ... data fetching
await screenTrace.stop();

// API response time
// Automatically tracked by Firebase Performance
```

### 5. Error Metrics

```typescript
// Error rate
Sentry.captureException(error, {
  tags: {
    error_type: 'network',
    severity: 'high',
  },
});

// Crash-free rate
// Automatically tracked by Sentry

// Error recovery
await AnalyticsService.logEvent('error_recovered', {
  error_type: 'network',
  recovery_method: 'retry',
});
```

## Dashboards

### 1. User Engagement Dashboard

**Metrics**:
- Daily/Monthly Active Users
- Session duration
- Screen views per session
- Feature usage frequency

**Tools**: Firebase Analytics Console

### 2. Performance Dashboard

**Metrics**:
- App startup time
- Screen load times
- API response times
- Frame rate (FPS)

**Tools**: Firebase Performance Console

### 3. Error Dashboard

**Metrics**:
- Crash-free rate
- Error frequency
- Error types
- Affected users

**Tools**: Sentry Dashboard

### 4. Business Metrics Dashboard

**Metrics**:
- User registrations
- Predictions made
- Videos uploaded
- Coins earned/spent

**Tools**: Custom dashboard (Metabase/Grafana)

## Alerts & Notifications

### Critical Alerts

```typescript
// Sentry alerts
// Configure in Sentry dashboard:
// - Crash rate > 1%
// - Error rate > 5%
// - New error type detected

// Firebase alerts
// Configure in Firebase console:
// - App startup time > 3s
// - Screen load time > 2s
// - API response time > 5s
```

### Slack Integration

```typescript
// Send critical errors to Slack
Sentry.init({
  integrations: [
    new Sentry.Integrations.Slack({
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: '#app-errors',
    }),
  ],
});
```

## Privacy & Compliance

### GDPR Compliance

```typescript
// Allow users to opt-out
const handleOptOut = async () => {
  await analytics().setAnalyticsCollectionEnabled(false);
  await Sentry.close();
};

// Delete user data
const handleDeleteAccount = async () => {
  await AnalyticsService.logEvent('account_deleted');
  await Sentry.setUser(null);
  // Delete from backend
};
```

### Data Anonymization

```typescript
// Anonymize user data
Sentry.setUser({
  id: hashUserId(user.id), // Hash user ID
  // Don't include email or username
});

// Anonymize IP addresses
Sentry.init({
  beforeSend(event) {
    if (event.user) {
      delete event.user.ip_address;
    }
    return event;
  },
});
```

## Best Practices

### 1. Event Naming

```typescript
// ✅ Good: Descriptive, consistent naming
await AnalyticsService.logEvent('video_played', {
  video_id: videoId,
  source: 'home_feed',
});

// ❌ Bad: Vague, inconsistent naming
await AnalyticsService.logEvent('play', { id: videoId });
```

### 2. Error Context

```typescript
// ✅ Good: Rich context
Sentry.captureException(error, {
  tags: {
    feature: 'video-upload',
    network: 'wifi',
  },
  extra: {
    fileSize: file.size,
    duration: file.duration,
    userId: user.id,
  },
});

// ❌ Bad: No context
Sentry.captureException(error);
```

### 3. Performance Tracking

```typescript
// ✅ Good: Track critical paths
await PerformanceService.trace('user_login', async () => {
  await login(credentials);
});

// ❌ Bad: Track everything
await PerformanceService.trace('button_click', async () => {
  // Too granular
});
```

## Implementation Checklist

- [ ] Install Sentry SDK
- [ ] Configure Sentry DSN
- [ ] Add error boundaries
- [ ] Install Firebase Analytics
- [ ] Configure Firebase project
- [ ] Add screen tracking
- [ ] Add event tracking
- [ ] Install Firebase Performance
- [ ] Add custom traces
- [ ] Set up dashboards
- [ ] Configure alerts
- [ ] Test in development
- [ ] Deploy to production
- [ ] Monitor metrics
- [ ] Iterate and improve

## Resources

- [Sentry React Native](https://docs.sentry.io/platforms/react-native/)
- [Firebase Analytics](https://rnfirebase.io/analytics/usage)
- [Firebase Performance](https://rnfirebase.io/perf/usage)
- [Expo Analytics](https://docs.expo.dev/guides/using-analytics/)

## Next Steps

1. ⏳ Set up Sentry for error tracking
2. ⏳ Configure Firebase Analytics
3. ⏳ Add performance monitoring
4. ⏳ Create custom dashboards
5. ⏳ Set up alerts
6. ⏳ Train team on monitoring tools
