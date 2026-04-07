# Bugfix Requirements Document

## Introduction

The 90Plus app was rejected by Apple Review under Guideline 2.1 (Information Needed) because reviewers were unable to sign in with the demo account credentials provided in App Store Connect (aibuilder80@gmail.com / 1872004ME). This prevents Apple from reviewing the app's full features and functionality, blocking the app's release to the App Store.

The bug affects the Apple Review process and must be resolved to ensure the demo account works reliably for reviewers, has full access to all features, and is protected from deletion, suspension, or strikes.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN Apple reviewers attempt to sign in with the demo account credentials (aibuilder80@gmail.com) THEN the system fails to authenticate the account

1.2 WHEN the demo account does not exist in the production database THEN authentication fails with no user record found

1.3 WHEN the demo account exists but has strikes, suspensions, or bans THEN authentication may succeed but feature access is restricted

1.4 WHEN the demo account is marked as deleted (isDeleted=true) or scheduled for deletion THEN authentication fails or the account is inaccessible

1.5 WHEN the demo account is not properly synced with Clerk authentication service THEN Clerk authentication fails even if the database record exists

1.6 WHEN the demo account lacks proper permissions or role assignments THEN certain features may be inaccessible to Apple reviewers

1.7 WHEN the demo account can be modified or deleted by normal app operations THEN it may become unavailable during the review period

### Expected Behavior (Correct)

2.1 WHEN Apple reviewers attempt to sign in with the demo account credentials THEN the system SHALL authenticate successfully and grant full access

2.2 WHEN the demo account is accessed THEN the system SHALL ensure it exists in both Clerk and the production database with matching credentials

2.3 WHEN the demo account is checked for moderation status THEN the system SHALL ensure it has no strikes, suspensions, bans, or deletion flags

2.4 WHEN the demo account is evaluated for permissions THEN the system SHALL ensure it has full access to all app features without restrictions

2.5 WHEN the demo account is protected from modifications THEN the system SHALL prevent deletion, suspension, banning, or strike assignment to this account

2.6 WHEN the demo account is created or verified THEN the system SHALL include a protection flag (isDemoAccount=true) to identify it as a special account

2.7 WHEN moderation actions are attempted on the demo account THEN the system SHALL block these actions and log the attempt

2.8 WHEN the demo account is seeded or initialized THEN the system SHALL populate it with sample data (reels, quiz attempts, follows) to demonstrate features

### Unchanged Behavior (Regression Prevention)

3.1 WHEN regular users authenticate with their credentials THEN the system SHALL CONTINUE TO authenticate them normally without any changes

3.2 WHEN regular users are subject to moderation actions (strikes, suspensions, bans) THEN the system SHALL CONTINUE TO apply these actions as designed

3.3 WHEN regular users delete their accounts THEN the system SHALL CONTINUE TO process account deletion with the 30-day grace period

3.4 WHEN Clerk authentication processes normal user logins THEN the system SHALL CONTINUE TO use the existing authentication middleware without changes

3.5 WHEN the database seed script runs in development THEN the system SHALL CONTINUE TO clear and recreate test data as designed

3.6 WHEN users register new accounts THEN the system SHALL CONTINUE TO create accounts without the demo protection flag

3.7 WHEN the app checks user permissions and roles THEN the system SHALL CONTINUE TO enforce role-based access control for non-demo accounts
