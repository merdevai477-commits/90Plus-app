# Settings Context Documentation

## Overview
Global settings management system for the Football Predictions app. Provides app-wide state management for notifications, preferences, and user settings.

## Features
- ✅ Persistent storage with AsyncStorage
- ✅ Notification management with Expo Notifications
- ✅ Type-safe operations
- ✅ Easy integration across the app
- ✅ Automatic state synchronization

## Installation

### 1. Wrap your app with SettingsProvider

```typescript
// app/_layout.tsx
import { SettingsProvider } from '../contexts/SettingsContext';

export default function RootLayout() {
  return (
    <SettingsProvider>
      {/* Your app content */}
    </SettingsProvider>
  );
}
```

### 2. Use the hook in any component

```typescript
import { useSettings } from '../contexts/SettingsContext';

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

## API Reference

### Settings State

```typescript
interface SettingsState {
  // Notifications
  notificationsEnabled: boolean;
  matchNotifications: boolean;
  goalNotifications: boolean;
  predictionReminders: boolean;
  
  // Preferences
  language: 'ar' | 'en';
  favoriteTeams: number[];
  favoriteLeagues: number[];
  
  // App State
  isFirstLaunch: boolean;
  lastSyncTime: number;
}
```

### Methods

#### Notification Methods
- `toggleNotifications(enabled: boolean)` - Enable/disable all notifications
- `toggleMatchNotifications(enabled: boolean)` - Toggle match notifications
- `toggleGoalNotifications(enabled: boolean)` - Toggle goal notifications
- `togglePredictionReminders(enabled: boolean)` - Toggle prediction reminders

#### Preference Methods
- `setLanguage(lang: 'ar' | 'en')` - Change app language
- `addFavoriteTeam(teamId: number)` - Add team to favorites
- `removeFavoriteTeam(teamId: number)` - Remove team from favorites
- `addFavoriteLeague(leagueId: number)` - Add league to favorites
- `removeFavoriteLeague(leagueId: number)` - Remove league from favorites

#### Utility Methods
- `clearCache()` - Clear app cache
- `resetSettings()` - Reset all settings to default
- `updateLastSync()` - Update last sync timestamp

### Helper Functions

#### Schedule Match Notification
```typescript
import { scheduleMatchNotification } from '../contexts/SettingsContext';

await scheduleMatchNotification(
  'match123',
  'Real Madrid',
  'Barcelona',
  new Date('2024-12-25T20:00:00'),
  15 // minutes before
);
```

#### Send Goal Notification
```typescript
import { sendGoalNotification } from '../contexts/SettingsContext';

await sendGoalNotification(
  'Real Madrid',
  'Cristiano Ronaldo',
  45
);
```

#### Send Prediction Result
```typescript
import { sendPredictionResultNotification } from '../contexts/SettingsContext';

await sendPredictionResultNotification(
  true, // isCorrect
  10, // points
  'Real Madrid vs Barcelona'
);
```

## Usage Examples

### Example 1: Settings Screen
```typescript
import { useSettings } from '../contexts/SettingsContext';

function SettingsScreen() {
  const {
    settings,
    toggleNotifications,
    toggleMatchNotifications,
    clearCache,
  } = useSettings();

  return (
    <View>
      <Switch
        value={settings.notificationsEnabled}
        onValueChange={() => toggleNotifications(!settings.notificationsEnabled)}
      />
      <Switch
        value={settings.matchNotifications}
        onValueChange={() => toggleMatchNotifications(!settings.matchNotifications)}
      />
      <Button title="Clear Cache" onPress={clearCache} />
    </View>
  );
}
```

### Example 2: Match Screen with Notifications
```typescript
import { useSettings } from '../contexts/SettingsContext';
import { scheduleMatchNotification } from '../contexts/SettingsContext';

function MatchScreen({ match }) {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings.matchNotifications) {
      scheduleMatchNotification(
        match.id,
        match.homeTeam,
        match.awayTeam,
        new Date(match.date),
        15
      );
    }
  }, [match, settings.matchNotifications]);

  return <View>{/* Match content */}</View>;
}
```

### Example 3: Favorite Teams
```typescript
import { useSettings } from '../contexts/SettingsContext';

function TeamScreen({ teamId }) {
  const { settings, addFavoriteTeam, removeFavoriteTeam } = useSettings();
  
  const isFavorite = settings.favoriteTeams.includes(teamId);

  const toggleFavorite = () => {
    if (isFavorite) {
      removeFavoriteTeam(teamId);
    } else {
      addFavoriteTeam(teamId);
    }
  };

  return (
    <TouchableOpacity onPress={toggleFavorite}>
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={24}
        color={isFavorite ? '#ef4444' : '#666'}
      />
    </TouchableOpacity>
  );
}
```

## Custom Hook: useNotifications

For easier notification management:

```typescript
import { useNotifications } from '../hooks/useNotifications';

function MyComponent() {
  const {
    canSendNotifications,
    canSendMatchNotifications,
    scheduleMatchNotification,
  } = useNotifications();

  if (canSendMatchNotifications) {
    // Schedule notification
  }
}
```

## Storage Keys

All settings are persisted to AsyncStorage with the key:
- `@app:settings` - Main settings object
- `@app:cache` - Cache data

## Best Practices

1. **Always check permissions before sending notifications**
```typescript
if (settings.notificationsEnabled && settings.matchNotifications) {
  await scheduleMatchNotification(...);
}
```

2. **Use try-catch for async operations**
```typescript
try {
  await toggleNotifications(true);
} catch (error) {
  Alert.alert('Error', 'Failed to enable notifications');
}
```

3. **Update last sync time after data fetches**
```typescript
await fetchData();
await updateLastSync();
```

4. **Clear cache periodically**
```typescript
// In settings screen
<Button title="Clear Cache" onPress={clearCache} />
```

## Troubleshooting

### Notifications not working
1. Check if notifications are enabled in settings
2. Verify device permissions
3. Check if Expo Notifications is properly configured

### Settings not persisting
1. Verify AsyncStorage is working
2. Check for errors in console
3. Ensure SettingsProvider wraps your app

### State not updating
1. Make sure you're using the hook correctly
2. Check if component is inside SettingsProvider
3. Verify async operations are awaited

## Future Enhancements

- [ ] Cloud sync for settings
- [ ] Multiple notification channels
- [ ] Advanced notification scheduling
- [ ] Theme customization
- [ ] Font size preferences
- [ ] Accessibility options
