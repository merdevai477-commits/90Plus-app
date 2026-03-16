# Requirements Document

## Introduction

This document outlines the requirements for addressing critical security vulnerabilities, technical debt, and UX improvements in the football application. The system consists of a React Native frontend (Expo) and a Node.js/Express backend with Prisma ORM. The fixes address exposed API keys, authorization gaps, logging issues, code quality improvements, background data preloading, rate limiting for user actions, and reels page enhancements to ensure production readiness and optimal user experience.

## Glossary

- **API Key**: A secret credential used to authenticate requests to external services
- **Backend Proxy**: A server-side intermediary that forwards requests to external APIs while hiding credentials
- **Authorization**: The process of verifying a user has permission to perform a specific action
- **Environment Variable**: A configuration value stored outside the codebase, loaded at runtime
- **ErrorBoundary**: A React component that catches JavaScript errors in child components and displays fallback UI
- **Logger Service**: A centralized utility for application logging with environment-aware output
- **Placeholder**: A generic example value in configuration files that must be replaced with real credentials
- **Background Preloading**: Loading data in the background before the user navigates to a page
- **Rate Limiting**: Restricting how often a user can perform certain actions within a time period
- **Cooldown Period**: The waiting time before a user can perform an action again
- **Optimistic Update**: Updating the UI immediately before the backend confirms the operation

## Requirements

### Requirement 1: Secure Football API Key

**User Story:** As a security engineer, I want the Football API key moved to the backend, so that it cannot be extracted from the mobile application.

#### Acceptance Criteria

1. WHEN the frontend needs football data THEN the Backend SHALL provide proxy endpoints that forward requests to the Football API
2. WHEN the Backend makes requests to the Football API THEN the Backend SHALL use an API key stored in environment variables
3. WHEN the frontend code is inspected THEN the Frontend SHALL contain no Football API keys or secrets
4. WHEN a proxy endpoint receives a request THEN the Backend SHALL validate the request before forwarding to the Football API

### Requirement 2: Secure Environment Example File

**User Story:** As a developer, I want the .env.example file to contain only placeholder values, so that real credentials are never committed to version control.

#### Acceptance Criteria

1. WHEN a developer views .env.example THEN the File SHALL contain only placeholder values for all secrets
2. WHEN a placeholder is used THEN the Placeholder SHALL follow the format "your_value_here" or similar descriptive text
3. WHEN DATABASE_URL is shown THEN the Value SHALL be a generic example like "postgresql://user:password@localhost:5432/dbname"
4. WHEN API secrets are shown THEN the Values SHALL be descriptive placeholders indicating the expected format

### Requirement 3: File Deletion Authorization

**User Story:** As a user, I want my files protected from unauthorized deletion, so that other users cannot delete my uploads.

#### Acceptance Criteria

1. WHEN a delete request is received THEN the Backend SHALL verify the requesting user owns the file
2. WHEN a user attempts to delete another user's file THEN the Backend SHALL return a 403 Forbidden response
3. WHEN ownership verification fails THEN the Backend SHALL log the unauthorized attempt
4. WHEN a file path is provided THEN the Backend SHALL extract and validate the owner ID from the path structure

### Requirement 4: Centralized Logger Service

**User Story:** As a developer, I want a centralized logging service, so that console.log statements can be controlled based on environment.

#### Acceptance Criteria

1. WHEN the application runs in production THEN the Logger SHALL suppress debug-level messages
2. WHEN the application runs in development THEN the Logger SHALL output all log levels
3. WHEN a log message is created THEN the Logger SHALL include a timestamp and log level
4. WHEN logging is needed THEN the Codebase SHALL use the Logger service instead of console.log

### Requirement 5: Centralized API URL Configuration

**User Story:** As a developer, I want API URLs managed in a central configuration, so that environment-specific URLs are easy to maintain.

#### Acceptance Criteria

1. WHEN the frontend needs an API URL THEN the Frontend SHALL retrieve it from a central configuration module
2. WHEN the environment changes THEN the Configuration SHALL return the appropriate URL for that environment
3. WHEN a hardcoded localhost URL exists THEN the URL SHALL be replaced with a configuration reference
4. WHEN the configuration is accessed THEN the Module SHALL support development, staging, and production environments

### Requirement 6: TypeScript Type Safety

**User Story:** As a developer, I want proper TypeScript types throughout the codebase, so that type errors are caught at compile time.

#### Acceptance Criteria

1. WHEN a variable is declared THEN the Declaration SHALL use a specific type instead of "any"
2. WHEN data structures are used THEN the Codebase SHALL define interfaces or types for those structures
3. WHEN API responses are handled THEN the Response SHALL be typed with appropriate interfaces
4. WHEN tsconfig strict mode is enabled THEN the Codebase SHALL compile without type errors

### Requirement 7: React Native Error Boundary

**User Story:** As a user, I want the app to handle errors gracefully, so that crashes show a friendly message instead of a blank screen.

#### Acceptance Criteria

1. WHEN a JavaScript error occurs in a component THEN the ErrorBoundary SHALL catch the error
2. WHEN an error is caught THEN the ErrorBoundary SHALL display a user-friendly error screen
3. WHEN an error is caught THEN the ErrorBoundary SHALL log the error details for debugging
4. WHEN the error screen is shown THEN the Screen SHALL provide an option to retry or return to home

### Requirement 8: Background Data Preloading

**User Story:** As a user, I want all pages to load instantly, so that I never wait for content when navigating.

#### Acceptance Criteria

1. WHEN the application starts THEN the System SHALL preload data for Profile, Reels, Notifications, and Matches pages in the background
2. WHEN the user is on any page THEN the System SHALL continue preloading other pages' data in the background
3. WHEN the user navigates to a preloaded page THEN the Page SHALL display content immediately without loading indicators
4. WHEN cached data exists THEN the System SHALL display cached data first and refresh in the background
5. WHEN the app is idle THEN the System SHALL periodically refresh cached data to keep it current

### Requirement 9: Video Duration Display Fix

**User Story:** As a user, I want to see the correct video duration on profile thumbnails, so that I know how long each video is.

#### Acceptance Criteria

1. WHEN a video thumbnail is displayed on a profile THEN the Thumbnail SHALL show the actual video duration
2. WHEN video metadata is loaded THEN the System SHALL extract and store the correct duration value
3. WHEN duration is displayed THEN the Format SHALL be MM:SS for videos under one hour
4. WHEN duration cannot be determined THEN the System SHALL hide the duration indicator instead of showing 0:00

### Requirement 10: Profile Picture Change Rate Limiting

**User Story:** As a user, I want profile picture changes limited to once per 7 days, so that identity consistency is maintained.

#### Acceptance Criteria

1. WHEN a user changes their profile picture THEN the Backend SHALL record the change timestamp
2. WHEN a user attempts to change profile picture within 7 days THEN the System SHALL reject the request
3. WHEN change is rejected THEN the System SHALL display a popup showing remaining days until next change
4. WHEN change is rejected THEN the System SHALL send a notification with the remaining cooldown period
5. WHEN the user logs out and back in THEN the Cooldown SHALL persist based on the stored timestamp

### Requirement 11: Cover Photo Change Rate Limiting

**User Story:** As a user, I want cover photo changes limited to once per 15 days, so that profile stability is maintained.

#### Acceptance Criteria

1. WHEN a user changes their cover photo THEN the Backend SHALL record the change timestamp
2. WHEN a user attempts to change cover photo within 15 days THEN the System SHALL reject the request
3. WHEN change is rejected THEN the System SHALL display a popup showing remaining days until next change
4. WHEN change is rejected THEN the System SHALL send a notification with the remaining cooldown period
5. WHEN the user logs out and back in THEN the Cooldown SHALL persist based on the stored timestamp

### Requirement 12: Username Change Rate Limiting

**User Story:** As a user, I want username changes limited to once per 15 days, so that user identification remains stable.

#### Acceptance Criteria

1. WHEN a user changes their username THEN the Backend SHALL record the change timestamp with exact date and time
2. WHEN a user attempts to change username within 15 days THEN the System SHALL reject the request
3. WHEN the user opens the edit profile page THEN the Username field SHALL display a countdown timer showing remaining days
4. WHEN countdown is active THEN the User SHALL be able to edit other fields but not the username
5. WHEN the user logs out and back in THEN the Cooldown SHALL persist based on the stored timestamp

### Requirement 13: Video Upload Rate Limiting

**User Story:** As a user, I want video uploads limited to once per 3 days, so that content quality is maintained.

#### Acceptance Criteria

1. WHEN a user uploads a video THEN the Backend SHALL record the upload timestamp
2. WHEN a user attempts to upload within 3 days THEN the Upload button SHALL display a countdown timer
3. WHEN the user taps the timer THEN the System SHALL show the exact remaining time until next upload
4. WHEN the user deletes their video THEN the Upload button SHALL become active immediately
5. WHEN the user deletes a video THEN the System SHALL allow up to 2 deletions before restricting
6. WHEN the user has deleted 2 videos THEN the Third deletion SHALL be blocked
7. WHEN upload state changes THEN the Frontend SHALL update immediately with optimistic updates

### Requirement 14: Reels Page Comment Replies

**User Story:** As a user, I want to reply to comments on reels, so that I can engage in conversations.

#### Acceptance Criteria

1. WHEN viewing a comment THEN the User SHALL see a reply button
2. WHEN the user taps reply THEN the System SHALL open a reply input field
3. WHEN a reply is submitted THEN the Reply SHALL appear immediately with optimistic update
4. WHEN replies exist THEN the Comment SHALL show a "View replies" option with reply count

### Requirement 15: Reels Comment and Reply Limits

**User Story:** As a user, I want comment limits per video, so that spam is prevented.

#### Acceptance Criteria

1. WHEN a user has posted 5 comments on a video THEN the System SHALL prevent additional comments on that video
2. WHEN a user has posted 5 replies on a video THEN the System SHALL prevent additional replies on that video
3. WHEN limit is reached THEN the System SHALL display a message indicating the limit
4. WHEN limits are checked THEN the Frontend SHALL validate immediately before sending to backend

### Requirement 16: Reels Audio Management

**User Story:** As a user, I want video audio to stop when leaving the reels page, so that audio does not continue playing unexpectedly.

#### Acceptance Criteria

1. WHEN the user navigates away from the reels page THEN the System SHALL immediately stop all video audio
2. WHEN the user switches to another app THEN the System SHALL pause video playback and audio
3. WHEN the user returns to the reels page THEN the System SHALL resume from the paused state

### Requirement 17: Reels Video Replay Limit

**User Story:** As a user, I want videos to auto-replay only twice, so that I can control when to rewatch.

#### Acceptance Criteria

1. WHEN a video finishes playing THEN the System SHALL auto-replay up to 2 times
2. WHEN the video has replayed twice THEN the Video SHALL pause and show a replay button
3. WHEN the user taps the paused video THEN the Video SHALL play again from the beginning
4. WHEN the user scrolls away and back THEN the Replay count SHALL reset

### Requirement 18: Reels Follow Button Logic

**User Story:** As a user, I want the follow button to work correctly on reels, so that I can easily follow content creators.

#### Acceptance Criteria

1. WHEN viewing my own reel THEN the Follow button SHALL be hidden
2. WHEN viewing another user's reel THEN the Follow button SHALL be visible
3. WHEN the follow button is tapped THEN the System SHALL follow the reel creator immediately with optimistic update
4. WHEN already following THEN the Button SHALL show "Following" state
5. WHEN follow state changes THEN the Backend SHALL be updated in the background

### Requirement 19: Reels Video Preloading

**User Story:** As a user, I want reels to load instantly without buffering, so that my viewing experience is smooth.

#### Acceptance Criteria

1. WHEN the app starts THEN the System SHALL preload the first 3-5 reels in the background
2. WHEN viewing a reel THEN the System SHALL preload the next 2-3 reels ahead
3. WHEN a reel is displayed THEN the Video SHALL start playing immediately without buffering indicator
4. WHEN the user is on any page THEN the System SHALL continue preloading reels in the background

### Requirement 20: Real-time Frontend Updates with Background Sync

**User Story:** As a user, I want all actions to feel instant, so that the app feels responsive and fast.

#### Acceptance Criteria

1. WHEN the user performs any action THEN the Frontend SHALL update immediately with optimistic updates
2. WHEN an optimistic update is made THEN the Backend SHALL be notified in the background
3. WHEN the backend sync fails THEN the System SHALL retry and show error only after multiple failures
4. WHEN the app starts THEN the System SHALL sync any pending operations from previous sessions
5. WHEN data changes on the backend THEN the Frontend SHALL receive updates in near real-time


### Requirement 21: WebSocket Real-time Communication

**User Story:** As a user, I want instant updates for critical actions, so that I see changes immediately without refreshing.

#### Acceptance Criteria

1. WHEN the app starts THEN the System SHALL establish a WebSocket connection to the backend
2. WHEN a user receives a new notification THEN the WebSocket SHALL push the notification instantly
3. WHEN a user receives a new comment or reply on their reel THEN the WebSocket SHALL push the update instantly
4. WHEN a user follows or unfollows THEN the WebSocket SHALL broadcast the change to affected users
5. WHEN a live match score changes THEN the WebSocket SHALL push the update to subscribed users
6. WHEN the WebSocket connection drops THEN the System SHALL automatically reconnect with exponential backoff
7. WHEN reconnection occurs THEN the System SHALL sync any missed events from the server
8. WHEN the user is on the reels page THEN the WebSocket SHALL push like count updates in real-time
9. WHEN a comment is added to a reel THEN the WebSocket SHALL notify the reel owner instantly
