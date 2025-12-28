# Example Usage - Leagues Page

## Code Examples

### 1. Fetching Live Matches

```typescript
import ApiFootballService from './services/apiFootball';

// Get all live matches
const liveMatches = await ApiFootballService.getLiveFixtures();
console.log(`Found ${liveMatches.length} live matches`);

// Example output:
// Found 15 live matches
```

### 2. Fetching Matches by Date

```typescript
// Get today's matches
const today = new Date().toISOString().split('T')[0];
const todayMatches = await ApiFootballService.getFixturesByDate(today);

// Get tomorrow's matches
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowMatches = await ApiFootballService.getFixturesByDate(
  tomorrow.toISOString().split('T')[0]
);
```

### 3. Fetching Major League Matches

```typescript
import { MAJOR_LEAGUES } from './services/apiFootball';

// Get Premier League matches
const premierLeague = await ApiFootballService.getFixturesByLeague(
  MAJOR_LEAGUES.PREMIER_LEAGUE,
  2024
);

// Get Champions League matches
const championsLeague = await ApiFootballService.getFixturesByLeague(
  MAJOR_LEAGUES.CHAMPIONS_LEAGUE,
  2024
);
```

### 4. Saving a Prediction

```typescript
import PredictionStorage from './services/predictionStorage';

const prediction = {
  id: 'pred_123_1234567890',
  matchId: '123',
  fixtureId: 123,
  homeTeam: 'Manchester United',
  awayTeam: 'Liverpool',
  prediction: {
    type: 'home' as const,
    homeScore: 2,
    awayScore: 1,
  },
  timestamp: Date.now(),
  status: 'pending' as const,
};

await PredictionStorage.savePrediction(prediction);
console.log('Prediction saved!');
```

### 5. Checking if User Has Predicted

```typescript
const matchId = '123';
const hasPredicted = await PredictionStorage.hasPredicted(matchId);

if (hasPredicted) {
  console.log('User has already predicted this match');
  const prediction = await PredictionStorage.getPredictionByMatchId(matchId);
  console.log('Prediction:', prediction);
} else {
  console.log('User can make a prediction');
}
```

### 6. Getting User Statistics

```typescript
const stats = await PredictionStorage.getUserStats();

console.log(`Total Predictions: ${stats.totalPredictions}`);
console.log(`Correct: ${stats.correctPredictions}`);
console.log(`Accuracy: ${stats.accuracy}%`);
console.log(`Total Points: ${stats.totalPoints}`);
console.log(`Current Streak: ${stats.streak}`);
console.log(`Level: ${stats.level}`);
```

### 7. Updating Prediction After Match Ends

```typescript
// When a match finishes, update the prediction status
const matchId = '123';
const actualHomeScore = 2;
const actualAwayScore = 1;

await PredictionStorage.updatePredictionStatus(
  matchId,
  actualHomeScore,
  actualAwayScore
);

// This will:
// 1. Check if prediction was correct
// 2. Calculate points earned
// 3. Update prediction status
// 4. Recalculate user statistics
```

### 8. Filtering Matches in UI

```typescript
const [matches, setMatches] = useState<Match[]>([]);
const [searchQuery, setSearchQuery] = useState('');

// Filter matches by search query
const filteredMatches = matches.filter(match => {
  if (!searchQuery) return true;
  
  const query = searchQuery.toLowerCase();
  return (
    match.homeTeam.toLowerCase().includes(query) ||
    match.awayTeam.toLowerCase().includes(query) ||
    match.league.toLowerCase().includes(query)
  );
});
```

### 9. Sorting Matches by Priority

```typescript
const sortedMatches = matches.sort((a, b) => {
  // Live matches first
  if (a.status === 'live' && b.status !== 'live') return -1;
  if (b.status === 'live' && a.status !== 'live') return 1;

  // Major leagues next
  const aIsMajor = isMajorLeague(a.leagueId);
  const bIsMajor = isMajorLeague(b.leagueId);
  if (aIsMajor && !bIsMajor) return -1;
  if (bIsMajor && !aIsMajor) return 1;

  // Upcoming before finished
  if (a.status === 'upcoming' && b.status === 'finished') return -1;
  if (b.status === 'upcoming' && a.status === 'finished') return 1;

  return 0;
});
```

### 10. Complete Prediction Flow

```typescript
// 1. User selects a match
const match = matches.find(m => m.id === '123');

// 2. User enters prediction
const userPrediction = {
  type: 'home',
  homeScore: 2,
  awayScore: 1,
};

// 3. Check if already predicted
const alreadyPredicted = await PredictionStorage.hasPredicted(match.id);
if (alreadyPredicted) {
  Alert.alert('Error', 'You have already predicted this match');
  return;
}

// 4. Save prediction
const storedPrediction = {
  id: `pred_${match.id}_${Date.now()}`,
  matchId: match.id,
  fixtureId: parseInt(match.id),
  homeTeam: match.homeTeam,
  awayTeam: match.awayTeam,
  prediction: userPrediction,
  timestamp: Date.now(),
  status: 'pending' as const,
};

await PredictionStorage.savePrediction(storedPrediction);

// 5. Update UI
Alert.alert('Success', 'Prediction saved!');
await loadUserData(); // Refresh predictions and stats
```

## API Response Examples

### Live Fixture Response

```json
{
  "fixture": {
    "id": 12345,
    "date": "2024-01-15T20:00:00+00:00",
    "status": {
      "long": "In Play",
      "short": "1H",
      "elapsed": 35
    },
    "venue": {
      "name": "Old Trafford",
      "city": "Manchester"
    }
  },
  "league": {
    "id": 39,
    "name": "Premier League",
    "logo": "https://media.api-sports.io/football/leagues/39.png"
  },
  "teams": {
    "home": {
      "id": 33,
      "name": "Manchester United",
      "logo": "https://media.api-sports.io/football/teams/33.png"
    },
    "away": {
      "id": 40,
      "name": "Liverpool",
      "logo": "https://media.api-sports.io/football/teams/40.png"
    }
  },
  "goals": {
    "home": 1,
    "away": 0
  }
}
```

### Upcoming Fixture Response

```json
{
  "fixture": {
    "id": 12346,
    "date": "2024-01-16T19:30:00+00:00",
    "status": {
      "long": "Not Started",
      "short": "NS",
      "elapsed": null
    }
  },
  "teams": {
    "home": {
      "name": "Real Madrid"
    },
    "away": {
      "name": "Barcelona"
    }
  },
  "goals": {
    "home": null,
    "away": null
  }
}
```

## UI Component Examples

### Match Card Usage

```typescript
<MatchCard 
  match={{
    id: '123',
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    homeScore: 2,
    awayScore: 1,
    homeLogo: 'https://...',
    awayLogo: 'https://...',
    date: 'Monday, 15 January',
    time: '20:00',
    status: 'live',
    league: 'Premier League',
    leagueLogo: 'https://...',
    venue: 'Old Trafford',
  }}
  onPredictionSubmit={handlePredictionSubmit}
  showPrediction={true}
  userPredictions={userPredictions}
/>
```

### Search Bar Usage

```typescript
<SearchBar 
  onSearch={(query) => setSearchQuery(query)}
  onFilterPress={() => setShowFilters(true)}
  placeholder="Search matches or teams..."
/>
```

### Prediction System Usage

```typescript
<PredictionSystem
  predictions={userPredictions}
  userStats={{
    totalPredictions: 42,
    correctPredictions: 35,
    accuracy: 83,
    totalPoints: 1250,
    streak: 7,
    rank: 15,
    level: 8,
  }}
  onPredictionSubmit={handlePredictionSubmit}
  onPredictionUpdate={handlePredictionUpdate}
/>
```

## Common Patterns

### Loading State

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const loadData = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const data = await ApiFootballService.getLiveFixtures();
    setMatches(data);
  } catch (err) {
    setError('Failed to load matches');
    console.error(err);
  } finally {
    setLoading(false);
  }
};
```

### Pull to Refresh

```typescript
const [refreshing, setRefreshing] = useState(false);

const handleRefresh = async () => {
  setRefreshing(true);
  await loadData();
  setRefreshing(false);
};

<FlatList
  data={matches}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
    />
  }
/>
```

### Empty State

```typescript
{matches.length === 0 && !loading && (
  <View style={styles.emptyState}>
    <Trophy size={64} color="#666" />
    <Text style={styles.emptyTitle}>No matches found</Text>
    <Text style={styles.emptyText}>
      {searchQuery 
        ? 'Try a different search term' 
        : 'No matches available right now'}
    </Text>
  </View>
)}
```

## Testing Examples

### Test API Connection

```typescript
// Run this in your component to test API
useEffect(() => {
  const testApi = async () => {
    try {
      const fixtures = await ApiFootballService.getLiveFixtures();
      console.log('✅ API working:', fixtures.length, 'live matches');
    } catch (error) {
      console.error('❌ API error:', error);
    }
  };
  
  testApi();
}, []);
```

### Test Prediction Storage

```typescript
// Test saving and retrieving predictions
const testStorage = async () => {
  // Save
  await PredictionStorage.savePrediction({
    id: 'test_1',
    matchId: '999',
    fixtureId: 999,
    homeTeam: 'Test Home',
    awayTeam: 'Test Away',
    prediction: { type: 'home', homeScore: 2, awayScore: 1 },
    timestamp: Date.now(),
    status: 'pending',
  });
  
  // Retrieve
  const predictions = await PredictionStorage.getAllPredictions();
  console.log('Saved predictions:', predictions.length);
  
  // Check
  const hasPredicted = await PredictionStorage.hasPredicted('999');
  console.log('Has predicted:', hasPredicted);
};
```

## Performance Tips

1. **Use FlatList** for large lists
2. **Memoize callbacks** with useCallback
3. **Debounce search** for better performance
4. **Cache API responses** to reduce requests
5. **Lazy load images** with proper placeholders
6. **Optimize re-renders** with React.memo

## Best Practices

1. **Always handle errors** gracefully
2. **Show loading states** for better UX
3. **Validate user input** before saving
4. **Use TypeScript** for type safety
5. **Keep components small** and focused
6. **Test on real devices** not just simulators
7. **Monitor API rate limits** to avoid blocking

## Conclusion

These examples show how to use all the features of the enhanced leagues page. The implementation is complete and ready for production use.
