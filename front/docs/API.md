# 📡 API Documentation

## Base URL

```
Production: https://90plus.pro/api

Internal (team only): `https://90plus-app-production-1808.up.railway.app/api` — set `INTERNAL_API_URL` in dev scripts.
Development: http://localhost:3000/api
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

## Services

### AuthService

```typescript
import { AuthService } from './services/authService';

// Sync user with backend
const user = await AuthService.syncUserWithBackend(clerkUserId, token);

// Get user profile
const profile = await AuthService.getUserProfile(token);

// Update profile
await AuthService.updateProfile(token, { bio: 'New bio' });

// Get user reels
const reels = await AuthService.getUserReels(token, username);
```

### MatchesService

```typescript
// Fetch matches for date
const matches = await fetchMatches('2024-01-15');

// Get match details
const match = await getMatchDetails(matchId);

// Favorite match
await favoriteMatch(matchId, token);
```

### PredictionsService

```typescript
// Make prediction
await makePrediction({
  matchId,
  homeScore: 2,
  awayScore: 1,
  coinsSpent: 10
}, token);

// Get user predictions
const predictions = await getUserPredictions(token);
```

### QuizService

```typescript
// Get quiz questions
const questions = await getQuizQuestions(categoryId);

// Submit quiz answers
const result = await submitQuiz({
  categoryId,
  answers: [...]
}, token);
```

### WebSocketClient

```typescript
import { websocketClient } from './services/websocketClient';

// Connect
await websocketClient.connect(userId, token);

// Subscribe to events
websocketClient.subscribe('notification', (data) => {
  console.log('New notification:', data);
});

// Send message
websocketClient.send('match_update', { matchId: 123 });

// Disconnect
websocketClient.disconnect();
```

## Error Handling

All services throw errors with the following structure:

```typescript
interface APIError {
  code: string;        // E001-E010
  message: string;     // User-friendly message
  details?: any;       // Additional context
}
```

### Error Codes

- `E001`: Validation error
- `E002`: Authentication failed
- `E003`: Authorization failed
- `E004`: Not found
- `E005`: Conflict
- `E006`: Rate limit exceeded
- `E007`: File upload error
- `E008`: External service error
- `E009`: Database error
- `E010`: Internal server error

## Rate Limiting

- General endpoints: 5000 requests / 15 minutes
- Write operations: 500 requests / 15 minutes
- Auth endpoints: 5 requests / minute

## Caching

Services implement multi-layer caching:

1. Memory cache (1-5 minutes)
2. AsyncStorage (5-60 minutes)
3. React Query cache (configurable)

## Examples

### Complete Authentication Flow

```typescript
import { useAuth } from '@clerk/clerk-expo';
import { AuthService } from './services/authService';

const { getToken, userId } = useAuth();

// Get Clerk token
const token = await getToken();

// Sync with backend
const user = await AuthService.syncUserWithBackend(userId, token);

// Now authenticated!
```

### Fetch and Display Matches

```typescript
import { useMatchesData } from './hooks/useMatchesData';

const { matches, loading, error, refetch } = useMatchesData('2024-01-15');

if (loading) return <LoadingSpinner />;
if (error) return <ErrorState error={error} onRetry={refetch} />;

return <MatchList matches={matches} />;
```

### Real-time Updates

```typescript
import { useWebSocket } from './hooks/useWebSocket';

const { subscribe, unsubscribe } = useWebSocket();

useEffect(() => {
  const unsubscribeNotification = subscribe('notification', (data) => {
    showNotification(data);
  });
  
  return () => {
    unsubscribeNotification();
  };
}, []);
```

## See Also

- [Architecture](./ARCHITECTURE.md)
- [Security](./SECURITY.md)
- [Testing](./TESTING.md)
