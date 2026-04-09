# Implementation Plan

- [x] 1. Create CacheService utility




  - [x] 1.1 Create cache service file with get, set, invalidate, cleanup methods





    - Create `front/services/cacheService.ts`
    - Implement AsyncStorage wrapper with timestamp support
    - Add TTL validation logic
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 1.2 Write property test for cache storage with timestamp


    - **Property 7: Cache Storage with Timestamp**
    - **Validates: Requirements 4.1**
  - [x] 1.3 Write property test for cache retrieval within TTL

    - **Property 8: Cache Retrieval Within TTL**
    - **Validates: Requirements 4.2**
  - [x] 1.4 Write property test for cache expiration handling

    - **Property 9: Cache Expiration Handling**
    - **Validates: Requirements 4.3**
  - [x] 1.5 Implement LRU eviction when cache exceeds limits


    - Add max cache size configuration
    - Implement oldest-first removal logic
    - _Requirements: 4.4_
  - [x] 1.6 Write property test for LRU cache eviction


    - **Property 10: LRU Cache Eviction**
    - **Validates: Requirements 4.4**
  - [x] 1.7 Add cache cleanup on app start


    - Implement cleanup method to remove expired entries
    - Call cleanup in app initialization
    - _Requirements: 4.5_

- [x] 2. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement Optimistic UI for Notifications





  - [x] 3.1 Create optimistic update handler utility


    - Create `front/utils/optimisticUpdate.ts`
    - Implement execute method with rollback support
    - _Requirements: 1.1, 1.3_
  - [x] 3.2 Write property test for optimistic clear immediate UI update


    - **Property 1: Optimistic Clear Immediate UI Update**
    - **Validates: Requirements 1.1**
  - [x] 3.3 Update notifications screen to use optimistic clear


    - Modify `handleClearAll` in `front/app/notifications.tsx`
    - Clear UI immediately, then call backend
    - Implement rollback on error
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Implement Profile Page Caching







  - [x] 4.1 Create useProfileCache hook




    - Create `front/hooks/useProfileCache.ts`
    - Implement cache-first loading pattern
    - Add background refresh logic
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 4.2 Write property test for cache-first profile loading


    - **Property 2: Cache-First Profile Loading**
    - **Validates: Requirements 2.1**

  - [x] 4.3 Write property test for profile data caching

    - **Property 3: Profile Data Caching**
    - **Validates: Requirements 2.5**

  - [x] 4.4 Add skeleton loading components for profile

    - Create skeleton placeholders for profile card, stats, videos
    - Show skeleton when no cache and loading
    - _Requirements: 2.4_
  - [x] 4.5 Update profile screen to use cache hook


    - Modify `front/app/(tabs)/profile.tsx`
    - Replace current loading logic with useProfileCache
    - Implement parallel data loading with Promise.all
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

- [x] 5. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Reels Page Caching and Performance






  - [x] 6.1 Create useReelsCache hook

    - Create `front/hooks/useReelsCache.ts`
    - Implement cache-first loading pattern
    - Add background refresh without disrupting viewing
    - _Requirements: 3.1, 3.5, 3.6_
  - [x] 6.2 Write property test for cache-first reels loading


    - **Property 4: Cache-First Reels Loading**
    - **Validates: Requirements 3.1**
  - [x] 6.3 Write property test for reels data caching


    - **Property 5: Reels Data Caching**
    - **Validates: Requirements 3.4**
  - [x] 6.4 Write property test for non-disruptive reels update


    - **Property 6: Non-Disruptive Reels Update**
    - **Validates: Requirements 3.6**

  - [x] 6.5 Improve empty state message for reels

    - Update "No videos" message with better guidance
    - Add call-to-action to follow users
    - _Requirements: 3.2_

  - [x] 6.6 Implement video preloading

    - Preload next 2 videos when viewing current reel
    - Use Video component's preload capability
    - _Requirements: 3.7_
  - [x] 6.7 Update reels screen to use cache hook


    - Modify `front/app/(tabs)/reels.tsx`
    - Replace current loading logic with useReelsCache
    - Integrate preloading with viewability changes
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6_

- [x] 7. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.



- [x] 8. Implement Matches Batch Caching

  - [x] 8.1 Create matches batch service


    - Create `front/services/matchesBatchService.ts`
    - Implement batch fetching for 7 days of matches
    - Add 30-minute cache TTL
    - _Requirements: 5.1, 5.2, 5.6_

  - [x] 8.2 Write property test for matches batch fetching

    - **Property 11: Matches Batch Fetching**
    - **Validates: Requirements 5.1, 5.6**

  - [x] 8.3 Write property test for matches cache sharing
    - **Property 12: Matches Cache Sharing**

    - **Validates: Requirements 5.3, 5.4**
  - [x] 8.4 Write property test for matches cache TTL
    - **Property 13: Matches Cache TTL**
    - **Validates: Requirements 5.2**
  - [x] 8.5 Update Home screen to use matches batch service



    - Modify matches loading in Home components
    - Use cached matches instead of direct API calls
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 9. Implement Match Archive Service




  - [x] 9.1 Create match archive service





    - Create `front/services/matchArchiveService.ts`
    - Implement archiveMatch method to save finished match details
    - Store to both AsyncStorage and backend
    - _Requirements: 6.1, 6.2_
  - [x] 9.2 Write property test for match archive persistence


    - **Property 14: Match Archive Persistence**
    - **Validates: Requirements 6.1, 6.2**
  - [x] 9.3 Write property test for match archive local-first retrieval


    - **Property 15: Match Archive Local-First Retrieval**
    - **Validates: Requirements 6.3, 6.4**
  - [x] 9.4 Write property test for match archive data completeness


    - **Property 16: Match Archive Data Completeness**
    - **Validates: Requirements 6.5**
  - [x] 9.5 Implement getArchivedMatch with local-first pattern


    - Check local storage first
    - Fetch from backend if not found locally
    - Cache backend response locally
    - _Requirements: 6.3, 6.4_
  - [x] 9.6 Create match history UI component


    - Display archived matches list
    - Show date, teams, score, key stats
    - _Requirements: 6.5_
  - [x] 9.7 Integrate archive service with match details screen


    - Auto-archive when match finishes
    - Allow viewing historical match data
    - _Requirements: 6.1, 6.6_



- [x] 10. Final Checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.
