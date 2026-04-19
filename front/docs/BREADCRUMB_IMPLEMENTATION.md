# Sentry Breadcrumb Implementation Guide

## Task 2.5: Add Sentry Breadcrumbs for Navigation and API Calls

This document describes the implementation of Sentry breadcrumb tracking for navigation events, API calls, and user actions.

## What Was Implemented

### 1. Navigation Tracking (`front/hooks/useNavigationTracking.ts`)

A React hook that automatically tracks screen navigation changes using expo-router.

**Features:**
- Tracks all screen changes automatically
- Extracts human-readable screen names from routes
- Includes navigation context (from/to screens, segments)
- Gracefully handles errors without breaking navigation

**Integration:**
- Added to `RootLayoutNav` component in `app/_layout.tsx`
- Automatically tracks all navigation throughout the app
- No additional code needed in individual screens

**Breadcrumb Example:**
```json
{
  "category": "navigation",
  "message": "Navigated to Quiz",
  "level": "info",
  "data": {
    "from": "/(tabs)/Home",
    "to": "/(tabs)/quiz",
    "screen": "Quiz",
    "segments": "(tabs)/quiz"
  }
}
```

### 2. API Call Tracking (`front/utils/apiClient.ts`)

A wrapper around the native `fetch` function that automatically adds breadcrumbs for all HTTP requests.

**Features:**
- Tracks request method, endpoint, and URL
- Tracks response status code and duration
- Tracks errors and failures
- Filters sensitive data from URLs
- Provides convenience methods (get, post, put, patch, delete)

**Two Usage Options:**

**Option A: Direct replacement of fetch**
```typescript
import { trackedFetch } from '@/utils/apiClient';

// Replace: fetch(url, options)
const response = await trackedFetch(url, options);
```

**Option B: API client helper**
```typescript
import { createAPIClient } from '@/utils/apiClient';

const api = createAPIClient({
  baseURL: getApiUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

const response = await api.get('/users/profile');
```

**Breadcrumb Example:**
```json
{
  "category": "http",
  "message": "API GET /users/profile - 200",
  "level": "info",
  "data": {
    "url": "https://api.90plus.app/api/users/profile",
    "method": "GET",
    "endpoint": "/users/profile",
    "status": 200,
    "statusText": "OK",
    "duration": 245,
    "ok": true
  }
}
```

### 3. User Action Tracking (`front/utils/userActionTracker.ts`)

A comprehensive utility for tracking user interactions throughout the app.

**Features:**
- Pre-defined action types for common interactions
- Convenience methods for common actions
- React hook for easy component integration
- Flexible custom action tracking

**Usage:**
```typescript
import { useUserActionTracker } from '@/utils/userActionTracker';

function MyComponent() {
  const tracker = useUserActionTracker();
  
  const handleLike = (videoId: string) => {
    tracker.like('video', videoId, { source: 'feed' });
    // ... rest of logic
  };
  
  return <Button onPress={() => handleLike('123')}>Like</Button>;
}
```

**Available Methods:**
- `buttonClick(name, data?)` - Track button clicks
- `formSubmit(name, data?)` - Track form submissions
- `formInput(field, data?)` - Track form input changes
- `videoPlay(id, data?)` - Track video play
- `videoPause(id, data?)` - Track video pause
- `like(type, id, data?)` - Track like actions
- `unlike(type, id, data?)` - Track unlike actions
- `comment(type, id, data?)` - Track comments
- `share(type, id, data?)` - Track shares
- `follow(userId, data?)` - Track follows
- `unfollow(userId, data?)` - Track unfollows
- `quizStart(id, data?)` - Track quiz start
- `quizAnswer(quizId, questionId, data?)` - Track quiz answers
- `quizComplete(id, data?)` - Track quiz completion
- `makePrediction(matchId, data?)` - Track predictions
- `search(query, data?)` - Track searches
- `settingsChange(setting, value, data?)` - Track settings changes
- `languageChange(lang, data?)` - Track language changes
- `custom(name, data?)` - Track custom actions

**Breadcrumb Example:**
```json
{
  "category": "user-action",
  "message": "Like video",
  "level": "info",
  "data": {
    "actionType": "like",
    "contentType": "video",
    "contentId": "123",
    "source": "feed",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Files Created

1. **`front/hooks/useNavigationTracking.ts`** - Navigation tracking hook
2. **`front/utils/apiClient.ts`** - API call tracking wrapper
3. **`front/utils/userActionTracker.ts`** - User action tracking utility
4. **`front/docs/SENTRY_BREADCRUMBS.md`** - User documentation
5. **`front/docs/BREADCRUMB_IMPLEMENTATION.md`** - This implementation guide

## Files Modified

1. **`front/app/_layout.tsx`** - Added navigation tracking integration

## Migration Guide

### For API Calls

Existing services using `fetch` should be gradually migrated to use `trackedFetch`:

**Before:**
```typescript
const response = await fetch(`${API_URL}/users/profile`, {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**After:**
```typescript
import { trackedFetch } from '@/utils/apiClient';

const response = await trackedFetch(`${API_URL}/users/profile`, {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Priority Services to Migrate:**
1. Authentication services (`authService.ts`)
2. User profile services
3. Video/reel services
4. Quiz services
5. Prediction services

### For User Actions

Add tracking to critical user interactions:

**Example: Button Click**
```typescript
import { useUserActionTracker } from '@/utils/userActionTracker';

function LoginButton() {
  const tracker = useUserActionTracker();
  
  const handlePress = () => {
    tracker.buttonClick('Login Button', { screen: 'auth' });
    // ... existing logic
  };
  
  return <Button onPress={handlePress}>Login</Button>;
}
```

**Example: Form Submission**
```typescript
const handleSubmit = async () => {
  tracker.formSubmit('Login Form', {
    emailProvided: !!email,
    passwordProvided: !!password,
  });
  
  // ... existing submit logic
};
```

**Priority Components to Add Tracking:**
1. Authentication forms (login, signup)
2. Video interactions (play, pause, like, comment)
3. Quiz interactions (start, answer, complete)
4. Prediction submissions
5. Settings changes
6. Search functionality

## Testing

### Manual Testing

1. **Navigation Tracking:**
   - Navigate between different screens
   - Check Sentry dashboard for navigation breadcrumbs
   - Verify screen names are human-readable

2. **API Call Tracking:**
   - Make API calls (login, fetch data, etc.)
   - Check Sentry dashboard for HTTP breadcrumbs
   - Verify endpoint, method, and status are captured

3. **User Action Tracking:**
   - Perform user actions (click buttons, submit forms)
   - Check Sentry dashboard for user-action breadcrumbs
   - Verify action type and context data are captured

### Viewing Breadcrumbs

1. Trigger an error in the app (or use test error)
2. Go to Sentry dashboard
3. Find the error in Issues
4. Click on the error
5. Scroll to "Breadcrumbs" section
6. Verify breadcrumbs appear chronologically

### Expected Breadcrumb Flow

For a typical user flow (login → view video → like video):

```
1. [navigation] Navigated to Authentication
2. [user-action] Input Email Field
3. [user-action] Input Password Field
4. [user-action] Submitted Login Form
5. [http] API POST /auth/login - 200
6. [navigation] Navigated to Home
7. [http] API GET /reels/feed - 200
8. [user-action] Play Video
9. [user-action] Like video
10. [http] API POST /reels/123/like - 200
```

## Performance Considerations

### Minimal Overhead

- Breadcrumbs are stored in memory (not sent immediately)
- Only sent to Sentry when an error occurs
- Async operations don't block UI thread
- Failed breadcrumb tracking doesn't break functionality

### Breadcrumb Limits

- Sentry keeps the most recent 100 breadcrumbs
- Older breadcrumbs are automatically discarded
- No need to manually manage breadcrumb cleanup

### Best Practices

1. **Don't over-track:** Focus on meaningful actions
2. **Include context:** Add relevant data to breadcrumbs
3. **Avoid sensitive data:** Never include passwords, tokens, etc.
4. **Use descriptive names:** Make breadcrumbs searchable
5. **Test in production:** Breadcrumbs only sent when `__DEV__` is false

## Requirements Validation

This implementation satisfies the following requirements from the spec:

✅ **Requirement 6.1**: Capture breadcrumbs for user actions leading up to errors
- Implemented via `userActionTracker.ts` with comprehensive action types

✅ **Requirement 6.2**: Capture breadcrumbs for navigation events
- Implemented via `useNavigationTracking` hook in `_layout.tsx`

✅ **Requirement 6.3**: Capture breadcrumbs for API calls with endpoint and method
- Implemented via `trackedFetch` and `createAPIClient` in `apiClient.ts`

## Next Steps

### Immediate (Optional)

1. Migrate high-priority services to use `trackedFetch`
2. Add user action tracking to critical components
3. Test breadcrumb capture in staging environment

### Future Enhancements

1. Add automatic tracking for React Query mutations
2. Add tracking for WebSocket events
3. Add tracking for background tasks
4. Create analytics dashboard for breadcrumb patterns

## Troubleshooting

### Breadcrumbs Not Appearing

**Problem:** Breadcrumbs don't show up in Sentry

**Solutions:**
1. Check Sentry is initialized: `initSentry()` called in `_layout.tsx`
2. Check environment: Breadcrumbs only sent in production (`__DEV__ === false`)
3. Check DSN: Verify `EXPO_PUBLIC_SENTRY_DSN` is set
4. Check logs: Look for "Failed to add breadcrumb" warnings

### Navigation Not Tracked

**Problem:** Navigation breadcrumbs missing

**Solutions:**
1. Verify `useNavigationTracking()` is called in `RootLayoutNav`
2. Check expo-router is working correctly
3. Check console for navigation tracking errors

### API Calls Not Tracked

**Problem:** HTTP breadcrumbs missing

**Solutions:**
1. Verify using `trackedFetch` instead of `fetch`
2. Check API calls are actually being made
3. Check for errors in breadcrumb capture (logged as warnings)

## Support

For questions or issues:
1. Check the [Sentry Breadcrumbs Documentation](./SENTRY_BREADCRUMBS.md)
2. Review the [Sentry Service Documentation](./SENTRY.md)
3. Check Sentry dashboard for error details
4. Review application logs for warnings

## References

- [Sentry Breadcrumbs Documentation](https://docs.sentry.io/platforms/react-native/enriching-events/breadcrumbs/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [React Native Fetch API](https://reactnative.dev/docs/network)
