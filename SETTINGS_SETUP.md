# Settings System Setup Guide

## ✅ Installation Complete!

The settings system has been successfully integrated into your app.

## 📦 Installed Packages

- ✅ `expo-notifications` - For push notifications
- ✅ `@react-native-async-storage/async-storage` - For persistent storage

## 🔧 Configuration

### app.json
The following has been added to your `app.json`:

**iOS:**
```json
"ios": {
  "infoPlist": {
    "UIBackgroundModes": ["remote-notification"]
  }
}
```

**Android:**
```json
"android": {
  "permissions": [
    "RECEIVE_BOOT_COMPLETED",
    "VIBRATE",
    "SCHEDULE_EXACT_ALARM"
  ]
}
```

**Plugins:**
```json
"plugins": [
  ["expo-notifications", {
    "icon": "./assets/images/notification-icon.png",
    "color": "#22c55e"
  }]
]
```

## 🚀 Quick Start

### 1. Basic Usage

```typescript
import { useSettings } from './contexts/SettingsContext';

function MyComponent() {
  const { settings, toggleNotifications } = useSettings();
  
  return (
    <Switch
      value={settings.notificationsEnabled}
      onValueChange={() => toggleNotifications(!settings.notificationsEnabled)}
    />
  );
}
```

### 2. Schedule Match Notification

```typescript
import { scheduleMatchNotification } from './contexts/SettingsContext';

await scheduleMatchNotification(
  'match123',
  'Real Madrid',
  'Barcelona',
  new Date('2024-12-25T20:00:00'),
  15 // minutes before
);
```

### 3. Check Notification Permissions

```typescript
import { useNotifications } from './hooks/useNotifications';

function MatchScreen() {
  const { canSendMatchNotifications } = useNotifications();
  
  if (canSendMatchNotifications) {
    // Schedule notification
  }
}
```

## 📱 Testing

### Test Notifications on Device

1. **Enable notifications in settings:**
   - Go to Settings tab
   - Toggle "تفعيل الإشعارات"

2. **Test match notification:**
```typescript
import { scheduleMatchNotification } from './contexts/SettingsContext';

// Schedule notification for 1 minute from now
const testDate = new Date(Date.now() + 60000);
await scheduleMatchNotification(
  'test',
  'Team A',
  'Team B',
  testDate,
  0
);
```

3. **Test immediate notification:**
```typescript
import { sendGoalNotification } from './contexts/SettingsContext';

await sendGoalNotification('Real Madrid', 'Ronaldo', 45);
```

## 🔍 Troubleshooting

### Notifications not appearing?

1. **Check device permissions:**
   - iOS: Settings > [Your App] > Notifications
   - Android: Settings > Apps > [Your App] > Notifications

2. **Check app settings:**
   - Open Settings tab in app
   - Ensure "تفعيل الإشعارات" is ON

3. **Check console for errors:**
```bash
npx expo start
# Look for notification-related errors
```

### Settings not persisting?

1. **Clear app data and restart:**
```bash
npx expo start --clear
```

2. **Check AsyncStorage:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Debug: View all stored data
const keys = await AsyncStorage.getAllKeys();
const data = await AsyncStorage.multiGet(keys);
console.log('Stored data:', data);
```

## 📚 Available Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `notificationsEnabled` | boolean | true | Master switch for all notifications |
| `matchNotifications` | boolean | true | Notifications before matches start |
| `goalNotifications` | boolean | true | Instant notifications for goals |
| `predictionReminders` | boolean | true | Reminders to make predictions |
| `language` | 'ar' \| 'en' | 'ar' | App language |
| `favoriteTeams` | number[] | [] | User's favorite teams |
| `favoriteLeagues` | number[] | [] | User's favorite leagues |

## 🎯 Next Steps

1. **Integrate with Match Screen:**
   - Schedule notifications when viewing upcoming matches
   - Send goal notifications for live matches

2. **Add Favorite Teams UI:**
   - Create team selection screen
   - Show favorite teams in home screen

3. **Implement Language Switching:**
   - Add language selector in settings
   - Apply translations throughout app

4. **Add Analytics:**
   - Track which notifications users interact with
   - Optimize notification timing

## 📖 Documentation

Full documentation available in:
- `contexts/README.md` - Complete API reference
- `contexts/SettingsContext.tsx` - Source code with comments
- `hooks/useNotifications.ts` - Notification helper hook

## 🆘 Support

If you encounter any issues:
1. Check the console for errors
2. Review the documentation
3. Ensure all dependencies are installed
4. Try clearing cache: `npx expo start --clear`

## ✨ Features Ready to Use

- ✅ Notification management
- ✅ Persistent settings storage
- ✅ Favorite teams/leagues
- ✅ Language preferences
- ✅ Cache management
- ✅ Type-safe operations
- ✅ Easy integration

**Your settings system is now production-ready! 🚀**
