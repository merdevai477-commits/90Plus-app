# 🏗️ Frontend Architecture Documentation

## Overview

90Plus is a React Native mobile application built with Expo, featuring a football social media platform with real-time updates, video content, predictions, and gamification.

## Tech Stack

### Core
- **React Native**: 0.83.2
- **Expo SDK**: 52
- **TypeScript**: Strict mode
- **Hermes**: JavaScript engine

### Navigation
- **expo-router**: File-based routing
- **React Navigation**: Under the hood

### State Management
- **Zustand**: Global state (10 stores)
- **React Query**: Server state & caching
- **Context API**: Shared state (6 contexts)
- **Local State**: UI-only state

### Authentication
- **Clerk**: Authentication provider
- **expo-secure-store**: Token storage

### Real-time
- **Socket.io**: WebSocket client
- **expo-notifications**: Push notifications

### Media
- **expo-av**: Video playback
- **expo-image**: Optimized images
- **expo-video-thumbnails**: Thumbnail generation

### UI/UX
- **Lucide React Native**: Icons
- **Lottie**: Animations
- **React Native Reanimated**: 60fps animations
- **React Native Gesture Handler**: Touch interactions

## Project Structure

```
front/
├── app/                    # Screens (file-based routing)
│   ├── (tabs)/            # Tab navigation
│   ├── auth/              # Authentication flow
│   ├── user/              # User profiles
│   ├── settings/          # Settings screens
│   └── _layout.tsx        # Root layout
│
├── components/            # React components
│   ├── common/           # Shared components
│   ├── Home/             # Home screen components
│   ├── Matches/          # Match components
│   ├── Quiz/             # Quiz components
│   ├── reels/            # Video components
│   └── ui/               # UI primitives
│
├── services/             # Business logic & API
│   ├── authService.ts    # Authentication
│   ├── websocketClient.ts # Real-time
│   ├── cacheService.ts   # Caching
│   └── ...               # 32 services total
│
├── hooks/                # Custom React hooks
│   ├── useMatchesData.ts # Match data fetching
│   ├── useWebSocket.ts   # WebSocket connection
│   └── ...               # 17 hooks total
│
├── contexts/             # React Context providers
│   ├── LanguageContext.tsx # i18n
│   ├── CoinsContext.tsx    # Gamification
│   └── ...                 # 6 contexts total
│
├── src/
│   ├── store/            # Zustand stores
│   ├── i18n/             # Internationalization
│   └── services/         # Core services
│
├── config/               # Configuration
│   └── api.config.ts     # API endpoints
│
├── locales/              # Translations (8 languages)
│   ├── en.ts
│   ├── ar.ts
│   └── ...
│
├── types/                # TypeScript types
├── utils/                # Utility functions
├── constants/            # App constants
└── data/                 # Static data
```

## Architecture Patterns

### 1. File-Based Routing (expo-router)

```
app/
├── (tabs)/
│   ├── _layout.tsx       → Tab navigator
│   ├── Home.tsx          → /home
│   ├── matches.tsx       → /matches
│   └── profile.tsx       → /profile
├── user/
│   └── [username].tsx    → /user/:username
└── _layout.tsx           → Root layout
```

### 2. State Management Layers

```typescript
// Layer 1: Server State (React Query)
const { data, isLoading } = useQuery({
  queryKey: ['matches', date],
  queryFn: () => fetchMatches(date),
  staleTime: 2 * 60 * 1000, // 2 minutes
});

// Layer 2: Global State (Zustand)
const { language, setLanguage } = useLanguageStore();

// Layer 3: Shared State (Context)
const { coins, addCoins } = useCoins();

// Layer 4: Local State (useState)
const [isOpen, setIsOpen] = useState(false);
```

### 3. Service Layer Pattern

```typescript
// services/authService.ts
export class AuthService {
  static async login(credentials) {
    // API call
    // Error handling
    // Cache management
    return user;
  }
}

// Usage in component
const handleLogin = async () => {
  const user = await AuthService.login(credentials);
};
```

### 4. Custom Hooks Pattern

```typescript
// hooks/useMatchesData.ts
export function useMatchesData(date: string) {
  // 1. Check memory cache
  // 2. Check AsyncStorage cache
  // 3. Fetch from API
  // 4. Update caches
  return { matches, loading, error, refetch };
}

// Usage
const { matches, loading } = useMatchesData('2024-01-15');
```

### 5. Caching Strategy

```
┌─────────────────────────────────────┐
│  Memory Cache (Instant)             │
│  TTL: 1-5 minutes                   │
└──────────────┬──────────────────────┘
               │ Miss
               ↓
┌─────────────────────────────────────┐
│  AsyncStorage (Fast)                │
│  TTL: 5-60 minutes                  │
└──────────────┬──────────────────────┘
               │ Miss
               ↓
┌─────────────────────────────────────┐
│  React Query Cache (Server State)   │
│  TTL: Configurable per query        │
└──────────────┬──────────────────────┘
               │ Miss
               ↓
┌─────────────────────────────────────┐
│  API Request                        │
└─────────────────────────────────────┘
```

## Data Flow

### 1. Authentication Flow

```
User Action
    ↓
Clerk SDK
    ↓
Get Token
    ↓
Sync with Backend (/api/auth/sync)
    ↓
Store in SecureStore
    ↓
Update Zustand Store
    ↓
Navigate to App
```

### 2. Real-time Updates Flow

```
Backend Event
    ↓
WebSocket Server
    ↓
Socket.io Client
    ↓
Event Handler
    ↓
Update React Query Cache
    ↓
UI Re-renders
```

### 3. Video Upload Flow

```
Select Video
    ↓
Validate Duration (5-60s)
    ↓
Generate Thumbnail
    ↓
Compress Video
    ↓
Upload to Supabase/R2
    ↓
Create Reel Record
    ↓
Invalidate Cache
    ↓
Show Success
```

## Performance Optimizations

### 1. Code Splitting

```typescript
// Lazy load heavy components
const VideoPlayer = lazy(() => import('./VideoPlayer'));

// Lazy load services
const getWebSocketClient = async () => {
  const module = await import('./websocketClient');
  return module.websocketClient;
};
```

### 2. Memoization

```typescript
// Memoize expensive calculations
const sortedMatches = useMemo(() => {
  return matches.sort((a, b) => a.date - b.date);
}, [matches]);

// Memoize callbacks
const handlePress = useCallback(() => {
  navigation.navigate('Details', { id });
}, [id, navigation]);

// Memoize components
export const VideoCard = React.memo(({ video }) => {
  // ...
});
```

### 3. Image Optimization

```typescript
// Use expo-image with caching
import { Image } from 'expo-image';

<Image
  source={{ uri: imageUrl }}
  cachePolicy="memory-disk"
  contentFit="cover"
  transition={200}
/>
```

### 4. List Virtualization

```typescript
// Use FlatList for long lists
<FlatList
  data={matches}
  renderItem={({ item }) => <MatchCard match={item} />}
  keyExtractor={(item) => item.id}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

## Internationalization (i18n)

### Supported Languages

- English (en)
- Arabic (ar) - RTL support
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Turkish (tr)

### Usage

```typescript
import { useTranslation } from '@/src/i18n';

const { t, language, setLanguage, isRTL } = useTranslation();

// Translate
const title = t('home.welcome');

// Change language
await setLanguage('ar');

// Check RTL
if (isRTL) {
  // Apply RTL styles
}
```

## Testing Strategy

### Unit Tests

```typescript
// services/__tests__/authService.test.ts
describe('AuthService', () => {
  it('should login successfully', async () => {
    const user = await AuthService.login(credentials);
    expect(user).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// __tests__/integration.authentication.test.ts
describe('Authentication Flow', () => {
  it('should complete full auth flow', async () => {
    // Test complete user journey
  });
});
```

### Property-Based Tests

```typescript
// __tests__/videoOperations.property.test.ts
import fc from 'fast-check';

fc.assert(
  fc.property(fc.integer(5, 60), (duration) => {
    // Test with random valid durations
    expect(isValidDuration(duration)).toBe(true);
  })
);
```

## Security Considerations

### 1. Token Storage

```typescript
// ✅ Use SecureStore for tokens
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('token', token);
```

### 2. API Communication

```typescript
// ✅ Always use HTTPS in production
const API_URL = isProduction()
  ? 'https://api.90plus.app/api'
  : 'http://localhost:3000/api';
```

### 3. Input Validation

```typescript
// ✅ Validate all user inputs
const validateUsername = (username: string) => {
  if (username.length < 3) return false;
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return false;
  return true;
};
```

## Deployment

### EAS Build

```bash
# Development build
eas build --profile development --platform ios

# Production build
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### Environment Configuration

```json
// eas.json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.90plus.app/api"
      }
    }
  }
}
```

## Monitoring & Analytics

### Error Tracking (Planned)

```typescript
// Sentry integration
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
});
```

### Analytics (Planned)

```typescript
// Firebase Analytics
import analytics from '@react-native-firebase/analytics';

await analytics().logEvent('video_played', {
  video_id: videoId,
  duration: duration,
});
```

## Best Practices

### 1. Component Structure

```typescript
/**
 * VideoCard component displays a video thumbnail with metadata
 * 
 * @param video - Video object with id, title, thumbnail
 * @param onPress - Callback when card is pressed
 */
export const VideoCard = React.memo(({ video, onPress }: Props) => {
  // Hooks
  const { t } = useTranslation();
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  
  // Callbacks
  const handlePress = useCallback(() => {
    onPress(video.id);
  }, [video.id, onPress]);
  
  // Render
  return (
    <TouchableOpacity onPress={handlePress}>
      {/* ... */}
    </TouchableOpacity>
  );
});
```

### 2. Error Handling

```typescript
try {
  const data = await fetchData();
  return data;
} catch (error) {
  logger.error('Failed to fetch data', error);
  
  if (error.code === 'NETWORK_ERROR') {
    showToast(t('errors.network'));
  } else {
    showToast(t('errors.generic'));
  }
  
  throw error;
}
```

### 3. Loading States

```typescript
if (isLoading) {
  return <LoadingSpinner />;
}

if (error) {
  return <ErrorState error={error} onRetry={refetch} />;
}

if (!data || data.length === 0) {
  return <EmptyState />;
}

return <DataList data={data} />;
```

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.
