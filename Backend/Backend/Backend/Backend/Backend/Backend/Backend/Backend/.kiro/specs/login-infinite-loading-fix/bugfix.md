# Bugfix Requirements Document

## Introduction

This document addresses a critical authentication bug in the 90Plus mobile app where users experience an infinite loading state during login. When users attempt to login by entering their credentials, the app displays the "Logging in..." screen with loading dots but remains stuck indefinitely, forcing users to close and reopen the app. This severely impacts user experience and prevents legitimate users from accessing the application.

The bug appears to be caused by a hanging async operation in the `syncUserWithBackend` function, which fails to complete or timeout properly, leaving the loading screen visible indefinitely without error feedback or recovery mechanism.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN user enters valid login credentials and submits the login form THEN the system shows "Logging in..." screen and gets stuck indefinitely without completing authentication

1.2 WHEN the `syncUserWithBackend` function fails to retrieve user data from backend THEN the system continues showing loading screen without timeout or error handling

1.3 WHEN the `AuthService.syncUserWithBackend(token)` call hangs or fails silently THEN the system does not hide the loading screen or provide user feedback

1.4 WHEN network connectivity is poor or backend API is slow to respond THEN the system waits indefinitely without timeout mechanism

1.5 WHEN the retry logic in `syncUserWithBackend` exhausts all attempts without success THEN the system does not properly handle the failure state or hide loading screen

### Expected Behavior (Correct)

2.1 WHEN user enters valid login credentials and submits the login form THEN the system SHALL complete authentication within 30 seconds or show an error message

2.2 WHEN the `syncUserWithBackend` function fails to retrieve user data from backend THEN the system SHALL hide the loading screen and display a clear error message with retry option

2.3 WHEN the `AuthService.syncUserWithBackend(token)` call hangs or fails silently THEN the system SHALL implement a timeout mechanism (15 seconds) and handle the failure gracefully

2.4 WHEN network connectivity is poor or backend API is slow to respond THEN the system SHALL show a timeout error after 15 seconds and allow user to retry

2.5 WHEN the retry logic in `syncUserWithBackend` exhausts all attempts without success THEN the system SHALL hide the loading screen, show an error alert, and allow the user to retry or cancel

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user successfully logs in with valid credentials and backend sync succeeds THEN the system SHALL CONTINUE TO navigate to the home screen or onboarding as appropriate

3.2 WHEN user logs in via OAuth (Google/Apple) and sync succeeds THEN the system SHALL CONTINUE TO complete authentication and navigate correctly

3.3 WHEN user signs up with a new account THEN the system SHALL CONTINUE TO show email verification modal and complete registration flow

3.4 WHEN authentication fails due to invalid credentials THEN the system SHALL CONTINUE TO show appropriate error messages in Arabic

3.5 WHEN user data is successfully synced from backend THEN the system SHALL CONTINUE TO populate globalState and navigate to appropriate screen based on user status

3.6 WHEN cleanup operations run before login THEN the system SHALL CONTINUE TO clear previous user data properly
