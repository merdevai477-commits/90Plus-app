# Apple App Store Compliance Requirements

## Overview
This specification addresses critical compliance issues identified by Apple App Review that are blocking the app's approval on the App Store. The app must implement account deletion functionality and enhance user-generated content moderation to meet Apple's guidelines.

## Background
After submitting the app to Apple Developer, two critical issues were identified:
1. **Guideline 5.1.1(v)**: Missing account deletion functionality
2. **Guideline 1.2**: Incomplete user-generated content moderation system

## Goals
- Implement complete account deletion flow that meets Apple's requirements
- Enhance content moderation system with required safety features
- Ensure full compliance with Apple App Store guidelines
- Maintain user data privacy and control

## User Stories

### 1. Account Deletion

#### 1.1 User-Initiated Account Deletion
**As a** registered user  
**I want to** delete my account directly from the app  
**So that** I can remove all my data when I no longer want to use the service

**Acceptance Criteria:**
- User can access account deletion option from Settings screen
- Deletion process is clear and straightforward (no more than 3 steps)
- User receives clear warning about data loss before confirming
- User must confirm deletion with password or biometric authentication
- Account deletion is permanent and immediate (not just deactivation)
- All user data is deleted within 30 days as per privacy regulations

#### 1.2 Data Deletion Scope
**As a** user deleting my account  
**I want to** understand what data will be deleted  
**So that** I can make an informed decision

**Acceptance Criteria:**
- Clear list of data that will be deleted is shown before confirmation
- User understands that deletion includes: profile, videos, comments, likes, predictions, quiz progress
- User is informed about data retention policies (if any)
- User receives confirmation email after successful deletion

#### 1.3 Account Deletion Confirmation
**As a** user who deleted my account  
**I want to** receive confirmation that my account was deleted  
**So that** I have proof of deletion

**Acceptance Criteria:**
- User receives in-app confirmation message
- User receives email confirmation (if email is available)
- User is logged out immediately after deletion
- User cannot log in with deleted credentials

### 2. Content Moderation Enhancement

#### 2.1 Terms of Service and EULA
**As a** new user  
**I want to** review and accept terms of service  
**So that** I understand the rules and my responsibilities

**Acceptance Criteria:**
- Terms of Service (EULA) is presented during signup
- Terms clearly state zero tolerance for objectionable content
- Terms define what constitutes abusive behavior
- User must explicitly accept terms before creating account
- Terms are accessible from Settings at any time

#### 2.2 Content Reporting System
**As a** user viewing content  
**I want to** report inappropriate content easily  
**So that** the platform remains safe

**Acceptance Criteria:**
- Report button is visible on all user-generated content (Reels, Comments)
- Report flow is simple (max 2 taps to submit)
- User can select reason for report (harassment, violence, spam, etc.)
- User receives confirmation that report was submitted
- User can optionally provide additional details

#### 2.3 User Blocking System
**As a** user  
**I want to** block abusive users  
**So that** I don't see their content or receive interactions from them

**Acceptance Criteria:**
- User can block another user from their profile or content
- Blocked users cannot see blocker's content
- Blocked users cannot comment on or interact with blocker's content
- User can view and manage list of blocked users in Settings
- User can unblock users at any time

#### 2.4 Admin Moderation Dashboard
**As an** admin  
**I want to** review reported content efficiently  
**So that** I can take action on violations quickly

**Acceptance Criteria:**
- Admin can view all reported content in a queue
- Reports show content, reporter, reason, and timestamp
- Admin can take actions: approve, remove content, warn user, ban user
- Admin actions are logged for audit trail
- Users receive notifications about moderation decisions

#### 2.5 Automated Content Filtering
**As a** platform  
**I want to** automatically detect potentially harmful content  
**So that** I can prevent it from being published

**Acceptance Criteria:**
- Video uploads are scanned for inappropriate content
- Text content (comments, usernames) is filtered for profanity
- Suspicious content is flagged for manual review
- Repeated violations trigger automatic account restrictions

## Technical Requirements

### Account Deletion
- Backend API endpoint for account deletion
- Cascade deletion of all related data (videos, comments, likes, etc.)
- Soft delete with 30-day grace period before permanent deletion
- Email notification service integration
- Clerk user deletion integration

### Content Moderation
- Report submission API endpoints
- Block/unblock user API endpoints
- Admin moderation API endpoints
- Content filtering service integration
- Notification system for moderation actions

## Constraints
- Must comply with GDPR and data privacy regulations
- Account deletion must be irreversible after grace period
- Moderation actions must be logged for legal compliance
- System must handle high volume of reports efficiently

## Success Metrics
- Account deletion flow completion rate > 95%
- Average time to delete account < 2 minutes
- Report submission success rate > 98%
- Admin moderation response time < 24 hours
- False positive rate for automated filtering < 5%

## Out of Scope
- Account recovery after deletion (explicitly not supported)
- Data export before deletion (can be added in future)
- Appeal process for moderation decisions (v1)
- Multi-language support for terms of service (v1)

## Dependencies
- Clerk authentication system
- Supabase storage for video content
- Email service for notifications
- Existing moderation system (strikes, bans)

## Risks
- Data deletion may fail for some records (need robust error handling)
- Automated content filtering may have false positives
- High volume of reports may overwhelm admin team
- Users may abuse blocking feature

## Timeline Estimate
- Account Deletion: 3-4 days
- Content Moderation Enhancement: 4-5 days
- Testing and QA: 2-3 days
- Total: 9-12 days
