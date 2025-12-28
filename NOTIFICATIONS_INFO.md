# Notifications Information

## ⚠️ Important Notice

**Notifications do NOT work in Expo Go!**

Push notifications functionality was removed from Expo Go starting with SDK 53. To use notifications, you need to create a **Development Build**.

## Why This Happens

Expo Go is a sandbox app that runs on your device for quick testing. However, it has limitations:
- ❌ Cannot use native modules that require custom configuration
- ❌ Cannot use push notifications
- ❌ Cannot use certain native features

## Solutions

### Option 1: Use Development Build (Recommended)

A development build is a custom version of your app that includes all native code.

#### Steps:

1. **Install EAS CLI:**
```bash
npm install -g eas-cli
```

2. **Login to Expo:**
```bash
eas login
```

3. **Configure EAS:**
```bash
eas build:configure
```

4. **Build for Android:**
```bash
eas build --profile development --platform android
```

5. **Build for iOS:**
```bash
eas build --profile development --platform ios
```

6. **Install the build on your device**

7. **Run the app:**
```bash
npx expo start --dev-client
```

### Option 2: Test Without Notifications

The app will work perfectly fine without notifications in Expo Go. All notification-related code is wrapped in try-catch blocks and will fail silently.

**What works in Expo Go:**
- ✅ All UI and navigation
- ✅ Settings management
- ✅ Language switching
- ✅ Match data and predictions
- ✅ Everything except notifications

**What doesn't work in Expo Go:**
- ❌ Push notifications
- ❌ Scheduled notifications
- ❌ Notification permissions

## Current Implementation

The app is designed to work in both environments:

```typescript
// Notifications will fail silently in Expo Go
try {
  await Notifications.scheduleNotificationAsync({...});
} catch (error) {
  console.log('Notification not available in Expo Go');
}
```

## Testing Notifications

### In Development Build:

1. **Enable notifications in settings**
2. **Grant permissions when prompted**
3. **Test match notification:**
```typescript
import { scheduleMatchNotification } from './contexts/SettingsContext';

await scheduleMatchNotification(
  'test',
  'Real Madrid',
  'Barcelona',
  new Date(Date.now() + 60000), // 1 minute from now
  0
);
```

4. **Test goal notification:**
```typescript
import { sendGoalNotification } from './contexts/SettingsContext';

await sendGoalNotification('Real Madrid', 'Ronaldo', 45);
```

### In Expo Go:

Notifications will not work, but the app will function normally without errors.

## Production Build

For production, you'll need to:

1. **Build APK/IPA:**
```bash
eas build --platform android
eas build --platform ios
```

2. **Submit to stores:**
```bash
eas submit --platform android
eas submit --platform ios
```

## Notification Features

When using a development/production build, you'll have:

✅ **Match Reminders** - Get notified before matches start
✅ **Goal Alerts** - Instant notifications when goals are scored
✅ **Prediction Reminders** - Reminders to make predictions
✅ **Result Notifications** - Know if your predictions were correct

## FAQ

**Q: Why can't I test notifications in Expo Go?**
A: Expo Go doesn't support custom native modules. Notifications require native configuration.

**Q: Do I need to change my code?**
A: No! The code is already set up to work in both environments.

**Q: Will the app crash without notifications?**
A: No! All notification code is wrapped in try-catch blocks.

**Q: How do I know if notifications are working?**
A: Check the console. In Expo Go, you'll see "Notification not available in Expo Go". In a development build, notifications will work normally.

**Q: Can I disable the warning?**
A: The warning only shows in development mode (__DEV__). It won't appear in production.

## Resources

- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)

## Summary

- ✅ App works perfectly in Expo Go (except notifications)
- ✅ Notifications work in Development/Production builds
- ✅ No code changes needed
- ✅ Graceful fallback in Expo Go
- ✅ Production-ready implementation
