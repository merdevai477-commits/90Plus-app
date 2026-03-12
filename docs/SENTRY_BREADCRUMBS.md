# Sentry Breadcrumbs Integration

This document explains how to use the Sentry breadcrumb tracking features in the 90Plus application.

## Overview

Breadcrumbs are a trail of events that happened before an error occurred. They help developers understand the context and user actions leading up to an error, making debugging much easier.

The application automatically tracks three types of breadcrumbs:
1. **Navigation Events** - Screen changes and route transitions
2. **API Calls** - HTTP requests with endpoint, method, and response status
3. **User Actions** - Button clicks, form submissions, and other interactions

## Automatic Tracking

### Navigation Tracking

Navigation breadcrumbs are automatically captured when users navigate between screens. This is enabled in `app/_layout.tsx` using the `useNavigationTracking` hook.

**What's tracked:**
- Screen name
- Previous screen
- Route pathname
- Navigation segments

**Example breadcrumb:**
```
Category: navigation
Message: Navigated to Quiz
Data: {
  from: "/(tabs)/Home",
  to: "/(tabs)/quiz",
  screen: "Quiz",
  segments: "(tabs)/quiz"
}
```

### API Call Tracking

API calls can be tracked by using the `trackedFetch` function instead of the native `fetch`.

**Basic usage:**
```typescript
import { trackedFetch } from '@/utils/apiClient';

// Instead of: fetch(url, options)
const response = await trackedFetch(url, options);
```

**What's tracked:**
- HTTP method (GET, POST, etc.)
- Endpoint path
- Response status code
- Request duration
- Success/failure status

**Example breadcrumb:**
```
Category: http
Message: API GET /users/profile - 200
Data: {
  url: "https://api.90plus.app/api/users/profile",
  method: "GET",
  endpoint: "/users/profile",
  status: 200,
  statusText: "OK",
  duration: 245,
  ok: true
}
```

### Migrating Existing API Calls

To add breadcrumb tracking to existing API calls, replace `fetch` with `trackedFetch`:

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

### Using the API Client Helper

For cleaner code, you can use the `createAPIClient` helper:

```typescript
import { createAPIClient } from '@/utils/apiClient';
import { getApiUrl } from '@/config/api.config';

const api = createAPIClient({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// GET request
const response = await api.get('/users/profile');

// POST request
const response = await api.post('/users/update', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Other methods: put, patch, delete
```

## Manual User Action Tracking

For user interactions like button clicks and form submissions, use the `UserActionTracker` utility.

### Basic Usage

```typescript
import { UserActionTracker } from '@/utils/userActionTracker';

// Track button click
const handleSubmit = () => {
  UserActionTracker.buttonClick('Submit Login Form', {
    formName: 'login',
    buttonId: 'submit-btn'
  });
  
  // ... rest of your logic
};
```

### Using the Hook

```typescript
import { useUserActionTracker } from '@/utils/userActionTracker';

function MyComponent() {
  const tracker = useUserActionTracker();
  
  const handleLike = (videoId: string) => {
    tracker.like('video', videoId, { source: 'feed' });
    // ... rest of your logic
  };
  
  return <Button onPress={() => handleLike('123')}>Like</Button>;
}
```

### Available Tracking Methods

#### Button Interactions
```typescript
tracker.buttonClick('Button Name', { buttonId: 'btn-1' });
```

#### Form Interactions
```typescript
tracker.formSubmit('Login Form', { fields: ['email', 'password'] });
tracker.formInput('Email Field', { value: 'user@example.com' });
```

#### Video Interactions
```typescript
tracker.videoPlay('video-123', { duration: 30, source: 'feed' });
tracker.videoPause('video-123', { currentTime: 15 });
```

#### Social Interactions
```typescript
tracker.like('video', 'video-123', { source: 'feed' });
tracker.unlike('video', 'video-123');
tracker.comment('video', 'video-123', { commentLength: 50 });
tracker.share('video', 'video-123', { platform: 'twitter' });
tracker.follow('user-456');
tracker.unfollow('user-456');
```

#### Quiz Interactions
```typescript
tracker.quizStart('quiz-789', { category: 'legends' });
tracker.quizAnswer('quiz-789', 'question-1', { correct: true });
tracker.quizComplete('quiz-789', { score: 8, totalQuestions: 10 });
```

#### Prediction Interactions
```typescript
tracker.makePrediction('match-101', { 
  prediction: 'home_win',
  coinsSpent: 50 
});
```

#### Search & Filter
```typescript
tracker.search('Ronaldo', { category: 'players' });
```

#### Settings
```typescript
tracker.settingsChange('notifications', true);
tracker.languageChange('ar', { previousLanguage: 'en' });
```

#### Custom Actions
```typescript
tracker.custom('Custom Action Name', { 
  customData: 'value' 
});
```

## Best Practices

### 1. Track Important User Actions

Focus on tracking actions that provide context for debugging:
- Form submissions
- Critical button clicks (submit, delete, purchase)
- Content interactions (like, comment, share)
- Navigation to important screens
- Settings changes

### 2. Don't Over-Track

Avoid tracking every single interaction:
- ❌ Don't track: Every scroll event, every keystroke
- ✅ Do track: Form submission, search query submission

### 3. Include Relevant Context

Add meaningful data to breadcrumbs:
```typescript
// Good - includes context
tracker.buttonClick('Delete Video', { 
  videoId: '123',
  videoTitle: 'My Video',
  source: 'profile'
});

// Less useful - no context
tracker.buttonClick('Delete Video');
```

### 4. Avoid Sensitive Data

Never include sensitive information in breadcrumbs:
- ❌ Passwords, tokens, API keys
- ❌ Personal identification numbers
- ❌ Credit card information
- ✅ User IDs, content IDs, action types

### 5. Use Descriptive Names

Make breadcrumb messages clear and searchable:
```typescript
// Good
tracker.buttonClick('Submit Login Form');
tracker.videoPlay('video-123');

// Less clear
tracker.buttonClick('Button');
tracker.custom('Action');
```

## Example Integration

Here's a complete example of integrating breadcrumb tracking in a component:

```typescript
import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { useUserActionTracker } from '@/utils/userActionTracker';
import { trackedFetch } from '@/utils/apiClient';
import { getApiUrl } from '@/config/api.config';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const tracker = useUserActionTracker();

  const handleSubmit = async () => {
    // Track form submission
    tracker.formSubmit('Login Form', {
      emailProvided: !!email,
      passwordProvided: !!password,
    });

    try {
      // API call with automatic breadcrumb tracking
      const response = await trackedFetch(`${getApiUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        tracker.custom('Login Success', { email });
        // Navigate to home...
      } else {
        tracker.custom('Login Failed', { 
          status: response.status,
          email 
        });
      }
    } catch (error) {
      // Error will be captured by Sentry with all breadcrumbs
      console.error('Login error:', error);
    }
  };

  return (
    <View>
      <TextInput
        value={email}
        onChangeText={setEmail}
        onFocus={() => tracker.formInput('Email Field', { action: 'focus' })}
        placeholder="Email"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        onFocus={() => tracker.formInput('Password Field', { action: 'focus' })}
        placeholder="Password"
        secureTextEntry
      />
      <Button title="Login" onPress={handleSubmit} />
    </View>
  );
}
```

## Viewing Breadcrumbs in Sentry

When an error occurs, breadcrumbs appear in the Sentry error details:

1. Go to Sentry dashboard
2. Click on an error/issue
3. Scroll to "Breadcrumbs" section
4. See the timeline of events leading to the error

Breadcrumbs are displayed chronologically with:
- Timestamp
- Category (navigation, http, user-action)
- Message
- Additional data

## Troubleshooting

### Breadcrumbs Not Appearing

1. **Check Sentry initialization**: Ensure `initSentry()` is called in `app/_layout.tsx`
2. **Check environment**: Breadcrumbs are only sent in production (when `__DEV__` is false)
3. **Check DSN**: Verify `EXPO_PUBLIC_SENTRY_DSN` is set in `.env`
4. **Check logs**: Look for warnings like "Failed to add breadcrumb"

### Too Many Breadcrumbs

Sentry limits breadcrumbs to the most recent 100. If you're tracking too many actions, consider:
- Reducing tracking frequency
- Focusing on critical actions only
- Using sampling for high-frequency events

### Performance Impact

Breadcrumb tracking has minimal performance impact:
- Breadcrumbs are stored in memory (not sent immediately)
- Only sent when an error occurs
- Async operations don't block UI
- Failed breadcrumb tracking doesn't break functionality

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 6.1**: ✅ Capture breadcrumbs for user actions (button clicks, form submissions)
- **Requirement 6.2**: ✅ Capture breadcrumbs for navigation events (screen changes)
- **Requirement 6.3**: ✅ Capture breadcrumbs for API calls (endpoint, method, status)

## Related Documentation

- [Sentry Service Documentation](./SENTRY.md)
- [API Configuration](./API.md)
- [Error Handling Guide](./ERROR_HANDLING.md)
