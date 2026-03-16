# Implementation Plan

## Phase 1: Security Fixes (Critical)

- [x] 1. Move Football API to Backend






  - [x] 1.1 Create Football API service in Backend

    - Create `Backend/src/services/football.service.ts` with API-Football integration
    - Move API key to environment variable `FOOTBALL_API_KEY`
    - Implement caching and rate limiting
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Create Football API proxy controller

    - Create `Backend/src/controllers/football.controller.ts`
    - Implement endpoints: `/leagues`, `/fixtures`, `/fixtures/live`, `/fixtures/:id`, `/standings`, `/h2h`
    - Add request validation
    - _Requirements: 1.1, 1.4_


  - [x] 1.3 Create Football API routes





    - Create `Backend/src/routes/football.routes.ts`


    - Register routes in `main.ts`


    - _Requirements: 1.1_
  - [x] 1.4 Write property test for Football API proxy





    - **Property 1: Football API Proxy Response Validity**
    - **Validates: Requirements 1.1, 1.4**
  - [x] 1.5 Update Frontend to use Backend proxy





    - Modify `front/services/apiFootball.ts` to call Backend instead of API-Football directly
    - Remove hardcoded API key from frontend
    - _Requirements: 1.2, 1.3_

- [x] 2. Secure .env.example file






  - [x] 2.1 Replace real credentials with placeholders

    - Update `Backend/.env.example` with placeholder values
    - Use format: `your_value_here` or descriptive placeholders
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Add File Deletion Authorization






  - [x] 3.1 Create ownership middleware


    - Create `Backend/src/middleware/ownership.middleware.ts`
    - Implement file path owner extraction
    - Verify requesting user matches file owner
    - Return 403 for unauthorized attempts
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 3.2 Write property tests for file ownership


    - **Property 2: File Deletion Authorization**
    - **Property 3: File Path Owner Extraction**
    - **Validates: Requirements 3.1, 3.2, 3.4**
  - [x] 3.3 Update storage controller to use ownership middleware


    - Modify `Backend/src/controllers/storage.controller.ts`
    - Apply middleware to delete endpoint
    - _Requirements: 3.1, 3.2_

- [x] 4. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Code Quality Improvements

- [x] 5. Create Logger Service






  - [x] 5.1 Create Backend logger service

    - Create `Backend/src/utils/logger.ts`
    - Implement log levels: debug, info, warn, error
    - Add timestamp and level to output
    - Suppress debug in production
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.2 Write property tests for logger

    - **Property 4: Logger Environment Behavior**
    - **Property 5: Logger Message Format**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  - [x] 5.3 Create Frontend logger service


    - Create `front/services/logger.ts`
    - Same interface as backend logger
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.4 Replace console.log with logger in Backend

    - Update all files using console.log
    - _Requirements: 4.4_

  - [x] 5.5 Replace console.log with logger in Frontend

    - Update all files using console.log
    - _Requirements: 4.4_

- [x] 6. Create Centralized API Configuration
  - [x] 6.1 Create API config module
    - Create `front/config/api.config.ts`
    - Support development, staging, production environments
    - Include baseUrl, wsUrl, timeout settings
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 6.2 Write property test for API config
    - **Property 6: API Configuration Environment URLs**
    - **Validates: Requirements 5.2, 5.4**
  - [x] 6.3 Replace hardcoded localhost URLs
    - Update all files with hardcoded URLs to use config
    - _Requirements: 5.3_

- [x] 7. Create ErrorBoundary Component
  - [x] 7.1 Create ErrorBoundary component
    - Create `front/components/ErrorBoundary.tsx`
    - Catch JavaScript errors in children
    - Display user-friendly error screen
    - Log error details
    - Provide retry/home options
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 7.2 Write property test for ErrorBoundary
    - **Property 7: ErrorBoundary Error Catching**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  - [x] 7.3 Wrap app with ErrorBoundary
    - Update app entry point to use ErrorBoundary
    - _Requirements: 7.1_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Performance Optimizations

- [x] 9. Implement Background Data Preloading




  - [x] 9.1 Create PreloadManager service

    - Create `front/services/preloadManager.ts`
    - Implement preloading for Profile, Reels, Notifications, Matches
    - Use existing cacheService for storage
    - _Requirements: 8.1, 8.2_

  - [x] 9.2 Write property test for preloading

    - **Property 8: Preloaded Data Immediate Display**
    - **Validates: Requirements 8.3, 8.4**
  - [x] 9.3 Initialize preloading on app start


    - Update app entry to call PreloadManager.initialize()
    - Set up periodic refresh
    - _Requirements: 8.1, 8.5_


  - [x] 9.4 Update screens to use preloaded data

    - Modify Profile, Reels, Notifications, Matches screens
    - Display cached data immediately, refresh in background
    - _Requirements: 8.3, 8.4_

- [x] 10. Fix Video Duration Display

  - [x] 10.1 Create video duration utility
    - Create `front/utils/videoDuration.ts`
    - Extract duration from video metadata
    - Format as MM:SS
    - Hide indicator for unknown duration
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 10.2 Write property test for duration formatting
    - **Property 9: Video Duration Display Format**
    - **Validates: Requirements 9.1, 9.3, 9.4**
  - [x] 10.3 Update profile video thumbnails

    - Apply duration display to profile video grid
    - _Requirements: 9.1_

- [x] 11. Implement Reels Video Preloading





  - [x] 11.1 Create reels preloader


    - Extend PreloadManager for video preloading
    - Preload first 3-5 reels on app start
    - Preload next 2-3 reels while viewing
    - _Requirements: 19.1, 19.2, 19.4_
  - [x] 11.2 Write property test for reel preloading


    - **Property 24: Reel Preloading Ahead**
    - **Validates: Requirements 19.2, 19.3**
  - [x] 11.3 Update reels page to use preloaded videos


    - Play preloaded videos immediately
    - _Requirements: 19.3_

- [x] 12. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Rate Limiting Implementation

- [x] 13. Implement Profile Picture Rate Limiting






  - [x] 13.1 Update avatar change endpoint

    - Enforce 7-day cooldown in `Backend/src/routes/profile.routes.ts`
    - Return remaining days on rejection
    - Create notification on rejection
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 13.2 Write property test for avatar cooldown

    - **Property 10: Avatar Change Cooldown Enforcement**
    - **Validates: Requirements 10.2, 10.3**

  - [x] 13.3 Update frontend avatar change UI

    - Show popup with remaining days
    - Display countdown in edit profile
    - _Requirements: 10.3_

- [x] 14. Implement Cover Photo Rate Limiting





  - [x] 14.1 Update cover change endpoint


    - Enforce 15-day cooldown
    - Return remaining days on rejection
    - Create notification on rejection
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [x] 14.2 Write property test for cover cooldown


    - **Property 11: Cover Change Cooldown Enforcement**
    - **Validates: Requirements 11.2, 11.3**
  - [x] 14.3 Update frontend cover change UI


    - Show popup with remaining days
    - _Requirements: 11.3_

- [x] 15. Implement Username Rate Limiting






  - [x] 15.1 Update username change endpoint

    - Enforce 15-day cooldown
    - Record exact timestamp
    - Return remaining days on rejection
    - _Requirements: 12.1, 12.2_

  - [x] 15.2 Write property test for username cooldown

    - **Property 12: Username Change Cooldown Enforcement**
    - **Validates: Requirements 12.2, 12.3**
  - [x] 15.3 Update frontend username field


    - Show countdown timer in edit profile
    - Disable field during cooldown
    - _Requirements: 12.3, 12.4_

- [x] 16. Write property test for cooldown persistence






  - [x] 16.1 Write property test for cooldown persistence

    - **Property 13: Cooldown Persistence Across Sessions**
    - **Validates: Requirements 10.5, 11.5, 12.5**



- [x] 17. Implement Video Upload Rate Limiting




  - [x] 17.1 Update video upload endpoint

    - Enforce 3-day cooldown (already exists, verify)
    - Return remaining hours on rejection
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 17.2 Write property test for upload cooldown

    - **Property 14: Video Upload Cooldown Enforcement**
    - **Validates: Requirements 13.2, 13.3**

  - [x] 17.3 Update frontend upload button

    - Show countdown timer when on cooldown
    - Show remaining time on tap
    - _Requirements: 13.2, 13.3_

- [x] 18. Implement Video Delete Limits






  - [x] 18.1 Update video delete endpoint

    - Track delete count per user
    - Block third deletion
    - Reset upload cooldown on delete
    - _Requirements: 13.4, 13.5, 13.6_

  - [x] 18.2 Write property tests for delete limits

    - **Property 15: Video Delete Limit Enforcement**
    - **Property 16: Video Delete Resets Upload Cooldown**
    - **Validates: Requirements 13.4, 13.5, 13.6**
  - [x] 18.3 Update frontend delete UI


    - Show remaining deletes
    - Update upload button state after delete
    - _Requirements: 13.4, 13.7_

- [x] 19. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Reels Page Enhancements

- [x] 20. Implement Comment Replies

  - [x] 20.1 Update comments API for replies
    - Verify reply functionality in `Backend/src/routes/reels.routes.ts`
    - Add reply button to comments
    - _Requirements: 14.1, 14.2_
  - [x] 20.2 Update frontend comment UI
    - Add reply button to each comment
    - Show reply input field on tap
    - Display "View replies" with count
    - _Requirements: 14.1, 14.2, 14.4_
  - [x] 20.3 Write property test for reply optimistic update

    - **Property 18: Reply Optimistic Update**
    - **Validates: Requirements 14.3**

- [x] 21. Implement Comment/Reply Limits






  - [x] 21.1 Update comment endpoint for limits


    - Enforce 5 comments + 5 replies per user per reel
    - Return limit reached message
    - _Requirements: 15.1, 15.2, 15.3_
  - [x] 21.2 Write property test for comment limits


    - **Property 17: Comment Limit Per User Per Reel**
    - **Validates: Requirements 15.1, 15.2, 15.3**
  - [x] 21.3 Add frontend validation


    - Check limits before sending to backend
    - Show limit message
    - _Requirements: 15.4_

- [x] 22. Fix Reels Audio Management

  - [x] 22.1 Implement audio cleanup on navigation
    - Stop all video audio when leaving reels page
    - Pause on app background
    - Resume on return
    - _Requirements: 16.1, 16.2, 16.3_
  - [x] 22.2 Write property test for audio cleanup

    - **Property 19: Audio Cleanup on Navigation**
    - **Validates: Requirements 16.1**

- [x] 23. Implement Video Replay Limit






  - [x] 23.1 Add replay count tracking

    - Track replays per video
    - Pause after 2 auto-replays
    - Show replay button
    - Reset count on scroll away
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 23.2 Write property tests for replay

    - **Property 20: Video Replay Limit**
    - **Property 21: Replay Count Reset on Scroll**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4**

- [x] 24. Fix Follow Button Logic




  - [x] 24.1 Update follow button visibility

    - Hide for own reels
    - Show for other users' reels
    - Show correct state (Follow/Following)
    - _Requirements: 18.1, 18.2, 18.4_

  - [x] 24.2 Write property test for follow button

    - **Property 22: Follow Button Visibility**
    - **Validates: Requirements 18.1, 18.2**
  - [x] 24.3 Implement optimistic follow


    - Update UI immediately on tap
    - Sync to backend in background
    - _Requirements: 18.3, 18.5_


  - [x] 24.4 Write property test for follow optimistic update

    - **Property 23: Follow Optimistic Update with Background Sync**
    - **Validates: Requirements 18.3, 18.4, 18.5**

- [x] 25. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Real-time & Optimistic Updates

- [x] 26. Implement Optimistic Updates System






  - [x] 26.1 Create optimistic update utility

    - Create `front/utils/optimisticUpdate.ts`
    - Implement update, rollback, confirm pattern
    - Add retry logic with exponential backoff
    - _Requirements: 20.1, 20.2, 20.3_

  - [x] 26.2 Write property test for optimistic updates

    - **Property 25: Optimistic Update with Retry**
    - **Validates: Requirements 20.1, 20.2, 20.3**
  - [x] 26.3 Implement pending operations sync


    - Store pending operations in AsyncStorage
    - Sync on app start
    - _Requirements: 20.4_

- [x] 27. Implement WebSocket Server






  - [x] 27.1 Create WebSocket service in Backend

    - Create `Backend/src/services/websocket.service.ts`
    - Initialize with HTTP server
    - Implement broadcast, sendToUser, sendToRoom
    - _Requirements: 21.1_

  - [x] 27.2 Integrate WebSocket with existing features

    - Emit events on notification create
    - Emit events on comment/reply
    - Emit events on follow/unfollow
    - Emit events on like
    - _Requirements: 21.2, 21.3, 21.4, 21.8, 21.9_

  - [x] 27.3 Write property test for WebSocket events

    - **Property 26: WebSocket Event Delivery**
    - **Validates: Requirements 21.2, 21.3, 21.4, 21.5, 21.8, 21.9**

- [x] 28. Implement WebSocket Client






  - [x] 28.1 Create WebSocket client in Frontend

    - Create `front/services/websocketClient.ts`
    - Implement connect, disconnect, subscribe, send
    - Add reconnection with exponential backoff
    - _Requirements: 21.1, 21.6_

  - [x] 28.2 Write property test for WebSocket reconnection

    - **Property 27: WebSocket Reconnection with Backoff**
    - **Validates: Requirements 21.6, 21.7**
  - [x] 28.3 Integrate WebSocket with app


    - Connect on app start
    - Subscribe to relevant events
    - Update UI on events
    - _Requirements: 21.1, 21.5_

- [x] 29. Implement Match Score Updates via WebSocket






  - [x] 29.1 Add match update broadcasting

    - Emit score changes to subscribed users
    - _Requirements: 21.5_



- [x] 30. Final Checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.
