# Design Document: Performance Optimization

## Overview

This design document outlines the architecture and implementation approach for optimizing the performance of three key screens in the mobile application: Notifications, Profile, and Reels. The optimization strategy focuses on implementing Optimistic UI patterns, local caching with AsyncStorage, parallel data loading, and video preloading.

## Architecture

The performance optimization follows a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (Screens)                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐│
│  │Notifications│ │   Profile   │ │       Reels         ││
│  └─────────────┘ └─────────────┘ └─────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Cache Layer                            │
│  ┌─────────────────────────────────────────────────────┐│
│  │              CacheService                            ││
│  │  - get(key): Promise<T | null>                      ││
│  │  - set(key, data, ttl): Promise<void>               ││
│  │  - invalidate(key): Promise<void>                   ││
│  │  - cleanup(): Promise<void>                         ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Storage Layer                           │
│  ┌─────────────────────────────────────────────────────┐│
│  │              AsyncStorage                            ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. CacheService

A centralized caching service that handles all local storage operations.

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheService {
  // Get cached data, returns null if expired or not found
  get<T>(key: string): Promise<T | null>;
  
  // Set data with optional TTL (default: 5 minutes)
  set<T>(key: string, data: T, ttl?: number): Promise<void>;
  
  // Invalidate specific cache entry
  invalidate(key: string): Promise<void>;
  
  // Clean up expired entries
  cleanup(): Promise<void>;
  
  // Get all keys matching a pattern
  getKeys(pattern: string): Promise<string[]>;
}
```

### 2. Optimistic UI Handler

A utility for handling optimistic updates with rollback capability.

```typescript
interface OptimisticUpdate<T> {
  // Execute optimistic update
  execute(
    optimisticAction: () => void,
    asyncAction: () => Promise<T>,
    rollbackAction: () => void,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): Promise<void>;
}
```

### 3. Screen-Specific Hooks

#### useNotificationsOptimistic
```typescript
interface UseNotificationsOptimistic {
  notifications: SocialNotification[];
  clearAll: () => Promise<void>;
  isClearing: boolean;
}
```

#### useProfileCache
```typescript
interface UseProfileCache {
  userData: UserData | null;
  followStats: FollowStats | null;
  videos: Video[];
  isLoading: boolean;
  isCacheHit: boolean;
  refresh: () => Promise<void>;
}
```

#### useReelsCache
```typescript
interface UseReelsCache {
  reels: ReelData[];
  isLoading: boolean;
  isCacheHit: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  preloadNext: (currentIndex: number) => void;
}
```

## Data Models

### CacheKeys
```typescript
const CACHE_KEYS = {
  PROFILE_DATA: 'cache_profile_data',
  PROFILE_STATS: 'cache_profile_stats',
  PROFILE_VIDEOS: 'cache_profile_videos',
  REELS_FEED: 'cache_reels_feed',
  NOTIFICATIONS: 'cache_notifications',
} as const;
```

### Cache TTL Configuration
```typescript
const CACHE_TTL = {
  PROFILE: 5 * 60 * 1000,      // 5 minutes
  REELS: 2 * 60 * 1000,        // 2 minutes
  NOTIFICATIONS: 1 * 60 * 1000, // 1 minute
} as const;
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Optimistic Clear Immediate UI Update
*For any* list of notifications, when the clear all action is triggered, the UI should immediately show an empty list before any async operation completes.
**Validates: Requirements 1.1**

### Property 2: Cache-First Profile Loading
*For any* cached profile data, when navigating to the profile screen, the cached data should be displayed before any network request completes.
**Validates: Requirements 2.1**

### Property 3: Profile Data Caching
*For any* successfully loaded profile data, the data should be stored in cache with a valid timestamp for future retrieval.
**Validates: Requirements 2.5**

### Property 4: Cache-First Reels Loading
*For any* cached reels data, when navigating to the reels screen, the cached reels should be displayed before any network request completes.
**Validates: Requirements 3.1**

### Property 5: Reels Data Caching
*For any* successfully loaded reels data, the data should be stored in cache with a valid timestamp for future retrieval.
**Validates: Requirements 3.4**

### Property 6: Non-Disruptive Reels Update
*For any* current viewing index, when new reels data arrives, the current viewing position should be preserved.
**Validates: Requirements 3.6**

### Property 7: Cache Storage with Timestamp
*For any* data stored in cache, the cache entry should include a timestamp and the original data.
**Validates: Requirements 4.1**

### Property 8: Cache Retrieval Within TTL
*For any* cached data where current time minus timestamp is less than TTL, the cache service should return the data.
**Validates: Requirements 4.2**

### Property 9: Cache Expiration Handling
*For any* cached data where current time minus timestamp exceeds TTL, the cache service should return null.
**Validates: Requirements 4.3**

### Property 10: LRU Cache Eviction
*For any* cache storage that exceeds the maximum size, the oldest entries (by timestamp) should be removed first.
**Validates: Requirements 4.4**

### Property 11: Matches Batch Fetching
*For any* matches request, the service should fetch matches for multiple days (batch) in a single API call to minimize request count.
**Validates: Requirements 5.1, 5.6**

### Property 12: Matches Cache Sharing
*For any* cached matches data, all subsequent requests within the TTL should return the same cached data without making new API calls.
**Validates: Requirements 5.3, 5.4**

### Property 13: Matches Cache TTL
*For any* matches cache entry, the TTL should be at least 30 minutes to reduce API usage.
**Validates: Requirements 5.2**

### Property 14: Match Archive Persistence
*For any* finished match, the archive service should save all details (score, lineups, statistics) to both local storage and backend.
**Validates: Requirements 6.1, 6.2**

### Property 15: Match Archive Local-First Retrieval
*For any* archived match request, the service should return local data if available before making any network request.
**Validates: Requirements 6.3, 6.4**

### Property 16: Match Archive Data Completeness
*For any* archived match, the stored data should include match date, teams, score, and key statistics.
**Validates: Requirements 6.5**

### 4. Matches Batch Service

A service that fetches matches in bulk to minimize API requests.

```typescript
interface MatchesBatchService {
  // Fetch all matches for a date range in a single request
  fetchMatchesBatch(startDate: Date, endDate: Date): Promise<Match[]>;
  
  // Get matches from cache, fetch if expired
  getMatches(date: Date): Promise<Match[]>;
  
  // Get cached matches without triggering fetch
  getCachedMatches(): Match[] | null;
  
  // Force refresh matches cache
  refreshCache(): Promise<void>;
}

// Configuration
const MATCHES_CONFIG = {
  BATCH_DAYS: 7,           // Fetch 7 days of matches at once
  CACHE_TTL: 30 * 60 * 1000, // 30 minutes cache
  MAX_MATCHES_PER_REQUEST: 100, // Maximum matches per API call
} as const;
```

### Matches Caching Strategy

```
┌─────────────────────────────────────────────────────────┐
│                   User Request                           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Check Local Cache                           │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Is cache valid? (exists && not expired)            ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
           │                              │
      Yes  │                              │  No
           ▼                              ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│  Return Cached Data │    │  Fetch Batch from API       │
└─────────────────────┘    │  (7 days, max matches)      │
                           └─────────────────────────────┘
                                          │
                                          ▼
                           ┌─────────────────────────────┐
                           │  Store in Cache (30 min TTL)│
                           └─────────────────────────────┘
                                          │
                                          ▼
                           ┌─────────────────────────────┐
                           │  Return Data to User        │
                           └─────────────────────────────┘
```

### 5. Match Archive Service

A service that saves and retrieves finished match details for historical viewing.

```typescript
interface MatchArchive {
  matchId: string;
  date: Date;
  homeTeam: Team;
  awayTeam: Team;
  score: { home: number; away: number };
  status: 'FT' | 'AET' | 'PEN';
  lineups: {
    home: Player[];
    away: Player[];
  };
  statistics: MatchStatistics;
  events: MatchEvent[]; // Goals, cards, substitutions
  archivedAt: Date;
}

interface MatchArchiveService {
  // Save finished match details
  archiveMatch(matchId: string, details: MatchArchive): Promise<void>;
  
  // Get archived match (local first, then backend)
  getArchivedMatch(matchId: string): Promise<MatchArchive | null>;
  
  // Get all archived matches for a date range
  getArchivedMatches(startDate: Date, endDate: Date): Promise<MatchArchive[]>;
  
  // Check if match is archived locally
  isArchivedLocally(matchId: string): boolean;
  
  // Sync local archives with backend
  syncWithBackend(): Promise<void>;
}
```

### Match Archive Flow

```
┌─────────────────────────────────────────────────────────┐
│              Match Finishes (status: FT)                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│         Collect All Match Details                        │
│  - Final Score                                          │
│  - Lineups (both teams)                                 │
│  - Statistics (possession, shots, etc.)                 │
│  - Events (goals, cards, subs)                          │
└─────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│  Save to Local      │    │  Save to Backend            │
│  AsyncStorage       │    │  (Shared Cache)             │
└─────────────────────┘    └─────────────────────────────┘
                           
                           
┌─────────────────────────────────────────────────────────┐
│              User Requests Match History                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Check Local Storage                         │
└─────────────────────────────────────────────────────────┘
           │                              │
      Found│                              │ Not Found
           ▼                              ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│  Return Local Data  │    │  Fetch from Backend         │
└─────────────────────┘    │  (Shared Cache)             │
                           └─────────────────────────────┘
                                          │
                                          ▼
                           ┌─────────────────────────────┐
                           │  Save to Local + Return     │
                           └─────────────────────────────┘
```

## Error Handling

### Optimistic UI Rollback
When a backend operation fails after an optimistic UI update:
1. Restore the previous state
2. Display an error toast to the user
3. Log the error for debugging

### Cache Failures
When cache operations fail:
1. Fall back to network-only mode
2. Log the cache error
3. Continue with normal operation

### Network Failures
When network requests fail:
1. Display cached data if available
2. Show a non-intrusive error indicator
3. Allow manual retry

## Testing Strategy

### Unit Testing
- Test CacheService methods in isolation
- Test optimistic update handler with mock async operations
- Test cache key generation and TTL calculations

### Property-Based Testing
The project will use **fast-check** library for property-based testing in TypeScript/JavaScript.

Each property-based test should:
- Run a minimum of 100 iterations
- Be tagged with the corresponding correctness property reference
- Use smart generators that constrain inputs to valid ranges

Property tests will validate:
- Cache storage always includes timestamp (Property 7)
- Cache retrieval respects TTL (Properties 8, 9)
- LRU eviction removes oldest entries (Property 10)
- Optimistic updates are immediate (Property 1)
- Cache-first loading works correctly (Properties 2, 4)

### Integration Testing
- Test full flow from UI action to cache update
- Test background refresh behavior
- Test error recovery scenarios
- Test matches batch fetching reduces API calls
- Test matches cache is shared across components
