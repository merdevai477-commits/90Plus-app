# Apple App Review Response Template

## Response to Guideline 5.1.1(v) - Data Collection and Storage

Dear Apple App Review Team,

Thank you for your feedback regarding account deletion functionality.

### What We've Implemented

We have now implemented a complete account deletion feature that meets all requirements of Guideline 5.1.1(v):

#### 1. In-App Account Deletion
- Users can now delete their account directly from the Settings screen
- The deletion option is clearly labeled as "Delete Account" with a red/danger style
- The process is straightforward and takes less than 2 minutes

#### 2. Clear User Communication
- Before deletion, users see a clear warning about data loss
- A detailed list shows exactly what data will be deleted:
  - Profile information (username, email, avatar, cover photo)
  - All uploaded videos (Reels)
  - All comments and interactions
  - All predictions and quiz progress
  - All notifications and settings
  - All follow/follower relationships

#### 3. Confirmation Steps
- Users must confirm deletion with password or biometric authentication
- A final confirmation checkbox prevents accidental deletion
- Users receive an email confirmation after successful deletion

#### 4. Permanent Deletion
- Account deletion is permanent, not just deactivation
- All user data is deleted within 30 days as per privacy regulations
- Users cannot log in with deleted credentials

#### 5. How to Test
To test the account deletion feature:
1. Open the app and log in
2. Navigate to Settings (bottom navigation → Profile → Settings icon)
3. Scroll to the "Account" section at the bottom
4. Tap "Delete Account" (red button)
5. Follow the deletion flow (warning → confirmation → success)

### Technical Implementation
- **Frontend**: AccountDeletionModal component with two-step confirmation
- **Backend**: DELETE /api/users/me endpoint with cascade deletion
- **Database**: Soft delete with scheduled permanent deletion after 30 days
- **Email**: Confirmation email sent to user's registered email address

---

## Response to Guideline 1.2 - Safety - User-Generated Content

Dear Apple App Review Team,

Thank you for your feedback regarding user-generated content moderation.

### What We've Implemented

We have now implemented comprehensive content moderation features that meet all requirements of Guideline 1.2:

#### 1. Terms of Service (EULA)
- **During Signup**: All new users must review and accept our Terms of Service before creating an account
- **Zero Tolerance Policy**: Terms clearly state that there is NO TOLERANCE for objectionable content or abusive users
- **Accessible**: Terms are accessible from Settings at any time
- **Version Tracking**: We track which version of terms each user has accepted

#### 2. Content Reporting System
- **Easy Access**: Report button is visible on all user-generated content (Reels, Comments, User Profiles)
- **Quick Process**: Reporting takes less than 30 seconds (2 taps + reason selection)
- **Report Reasons**:
  - Spam
  - Harassment
  - Inappropriate Content
  - Violence
  - Hate Speech
  - Copyright Violation
  - Other (with optional details)
- **Confirmation**: Users receive immediate confirmation that their report was submitted
- **Review Time**: All reports are reviewed within 24 hours

#### 3. User Blocking System
- **Block Users**: Users can block abusive users from their profile or content
- **Instant Effect**: Blocking immediately:
  - Hides blocked user's content from blocker's feed
  - Prevents blocked user from commenting on blocker's content
  - Removes follow/follower relationships
- **Manage Blocks**: Users can view and manage blocked users in Settings
- **Unblock**: Users can unblock at any time

#### 4. Automated Content Filtering
- **Text Filtering**: Comments and usernames are filtered for profanity and hate speech
- **Strike System**: Violations result in strikes:
  - 1st strike: Warning
  - 3rd strike: 7-day suspension
  - 5th strike: Permanent ban
- **Auto-Deletion**: Content with multiple reports is automatically removed
- **Notification**: Users are notified when their content is removed

#### 5. Admin Moderation Dashboard
- **Review Queue**: Admins can review all reported content
- **Quick Actions**: Admins can approve, delete, warn, suspend, or ban users
- **Audit Trail**: All moderation actions are logged
- **Priority System**: Reports are prioritized based on severity

#### 6. How to Test

**Test Terms Acceptance:**
1. Create a new account
2. You will see the Terms of Service modal before account creation
3. Scroll to the bottom to enable the "Accept" button
4. Check the acceptance checkbox and tap "Accept"

**Test Content Reporting:**
1. View any Reel or Comment
2. Tap the three-dot menu (⋯)
3. Select "Report"
4. Choose a reason and tap "Submit Report"
5. You will see a confirmation message

**Test User Blocking:**
1. Go to any user's profile
2. Tap the three-dot menu (⋯)
3. Select "Block User"
4. Confirm the action
5. The user's content will be hidden from your feed

**Test Blocked Users Management:**
1. Go to Settings
2. Scroll to "Privacy & Security" section
3. Tap "Blocked Users"
4. View list of blocked users and unblock if desired

### Technical Implementation
- **Frontend**: 
  - TermsOfServiceModal component
  - ReportContentModal component
  - BlockedUsersScreen component
- **Backend**: 
  - TermsService for terms acceptance
  - Enhanced ModerationService for reporting
  - Block/unblock API endpoints
- **Database**: 
  - TermsAcceptance table
  - Enhanced Report table with priority system
  - Block table with indexes

---

## Additional Information

### Privacy Policy
Our privacy policy is available at:
https://90plus-app-production.up.railway.app/privacy

### Support Contact
Users can contact us at:
- Email: support@90plus.com
- In-App: Settings → Contact Us

### Compliance Commitment
We are committed to maintaining a safe and respectful platform for all users. We continuously monitor and improve our moderation systems to ensure compliance with Apple's guidelines and industry best practices.

---

## Summary

We have fully addressed both issues raised in the App Review:

✅ **Guideline 5.1.1(v)**: Account deletion is now available in-app with clear communication and permanent deletion

✅ **Guideline 1.2**: Comprehensive content moderation system with terms acceptance, reporting, blocking, and admin moderation

We believe these implementations fully satisfy Apple's requirements and look forward to your approval.

Thank you for your time and consideration.

Best regards,
90Plus Development Team

