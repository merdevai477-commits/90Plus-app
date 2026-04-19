# Sentry User Tracking Integration

## Overview

This document describes the integration of Sentry user context tracking with the Clerk authentication flow in the 90Plus application.

## Requirements

- **Requirement 1.13**: Set user context on login/signup (user ID, username, email)
- **Requirement 1.14**: Clear user context on logout

## Implementation

### Components

#### SentryUserTracker Component

Location: `front/components/SentryUserTracker.tsx`

A React component that monitors authentication state changes and automatically updates Sentry user context.

**Features:**
- Monitors Clerk authentication state using `useAuth()` and `useUser()` hooks
- Sets Sentry user context when user signs in
- Clears Sentry user context when user signs out
- Handles errors gracefully without crashing the app
- Logs all operations for debugging

**User Context Data:**
- `id`: Clerk user ID (required)
- `username`: User's username (optional)
- `email`: User's primary email address (optional)

### Integration Points

#### App Layout

Location: `front/app/_layout.tsx`

The `SentryUserTracker` component is integrated into the app layout immediately after the `ClerkProvider`:

```tsx
<ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
  <SentryUserTracker />
  <QueryClientProvider client={queryClient}>
    {/* Rest of the app */}
  </QueryClientProvider>
</ClerkProvider>
```

This placement ensures:
1. Clerk authentication is initialized before tracking
2. User context is set as soon as authentication state changes
3. The component has access to authentication hooks

### Authentication Flow

#### Login/Signup Flow

1. User authenticates through Clerk (login or signup)
2. Clerk updates authentication state (`isSignedIn` becomes `true`)
3. `SentryUserTracker` detects the state change
4. Component calls `setUser()` with user details
5. Sentry associates all subsequent errors with this user

#### Logout Flow

1. User logs out through Clerk (`signOut()` is called)
2. Clerk updates authentication state (`isSignedIn` becomes `false`)
3. `SentryUserTracker` detects the state change
4. Component calls `clearUser()` to remove user context
5. Sentry stops associating errors with the previous user

### Error Handling

The implementation includes comprehensive error handling:

- **Initialization Errors**: If Sentry is not initialized, operations fail silently
- **Network Errors**: If Sentry API calls fail, errors are logged but don't crash the app
- **Missing Data**: If user data is incomplete, only available fields are sent

All errors are logged using the application logger for debugging purposes.

### Testing

The Sentry service functions (`setUser` and `clearUser`) are thoroughly tested in:
- `front/__tests__/services/sentry.service.test.ts`
- `front/__tests__/services/sentry.service.property.test.ts`

Tests cover:
- Setting user context with all fields
- Setting user context with partial data
- Clearing user context
- Error handling and graceful degradation

### Verification

To verify the integration is working:

1. **Development Mode**: Check console logs for Sentry user tracking messages
   ```
   [SentryUserTracker] User context set { userId: 'user_xxx', username: 'testuser' }
   [SentryUserTracker] User context cleared
   ```

2. **Production Mode**: Check Sentry dashboard
   - Navigate to Issues → Select an error
   - Check the "User" section in error details
   - Verify user ID, username, and email are present

3. **Manual Testing**:
   - Sign in to the app
   - Trigger an error (e.g., network failure)
   - Check Sentry dashboard for user context
   - Sign out
   - Trigger another error
   - Verify user context is cleared

### Benefits

1. **Better Error Tracking**: All errors are associated with specific users
2. **User Impact Analysis**: Identify which users are affected by issues
3. **Debugging Context**: User information helps reproduce and fix bugs
4. **Privacy Compliance**: User context is automatically cleared on logout
5. **Automatic Updates**: No manual tracking code needed throughout the app

### Security Considerations

- User email addresses are sent to Sentry (ensure compliance with privacy policies)
- Sensitive data is filtered by Sentry's `beforeSend` hook (see `sentry.service.ts`)
- User context is cleared immediately on logout
- All data transmission uses HTTPS

### Maintenance

The integration requires minimal maintenance:

- **No code changes needed** when adding new authentication flows
- **Automatic updates** when Clerk user data changes
- **Self-contained** component with no external dependencies
- **Graceful degradation** if Sentry is disabled or unavailable

### Troubleshooting

**User context not appearing in Sentry:**
1. Verify `EXPO_PUBLIC_SENTRY_DSN` is set in `.env`
2. Check that Sentry is enabled in production mode
3. Verify user is authenticated (check `isSignedIn` state)
4. Check console logs for error messages

**User context not clearing on logout:**
1. Verify `signOut()` is being called
2. Check that `SentryUserTracker` is mounted in the app layout
3. Verify Clerk authentication state is updating correctly

**Errors in console:**
1. Check that all dependencies are installed (`@sentry/react-native`, `@clerk/clerk-expo`)
2. Verify Sentry service is properly initialized
3. Check for TypeScript errors in the component

## Related Documentation

- [Sentry Service Documentation](../services/sentry.service.ts)
- [Clerk Authentication Documentation](https://clerk.com/docs)
- [Infrastructure Setup Spec](.kiro/specs/infrastructure-setup-and-configuration/)
