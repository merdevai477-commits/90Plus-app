# Apple Compliance Requirements - Implementation Tasks

## Phase 1: Database & Backend Foundation

### 1. Database Schema Updates
- [ ] 1.1 Create Prisma migration for TermsAcceptance table
- [ ] 1.2 Add account deletion fields to User model (isDeleted, deletedAt, scheduledDeletionAt)
- [ ] 1.3 Verify Block table exists and has correct indexes
- [ ] 1.4 Run migrations on development database
- [ ] 1.5 Test migrations on staging database

### 2. Terms of Service Backend
- [ ] 2.1 Create TermsService class
  - [ ] 2.1.1 Implement getLatestTerms() method
  - [ ] 2.1.2 Implement recordAcceptance() method
  - [ ] 2.1.3 Implement hasAcceptedLatestTerms() method
  - [ ] 2.1.4 Implement getUserAcceptanceHistory() method
- [ ] 2.2 Create terms API routes
  - [ ] 2.2.1 GET /api/terms/latest
  - [ ] 2.2.2 POST /api/terms/accept
  - [ ] 2.2.3 GET /api/terms/user-acceptance
- [ ] 2.3 Create terms content file (terms-v1.0.md)
- [ ] 2.4 Add terms acceptance check middleware
- [ ] 2.5 Write unit tests for TermsService

### 3. Account Deletion Backend
- [ ] 3.1 Create AccountDeletionService class
  - [ ] 3.1.1 Implement initiateAccountDeletion() method
  - [ ] 3.1.2 Implement permanentlyDeleteAccount() method
  - [ ] 3.1.3 Implement cancelAccountDeletion() method
  - [ ] 3.1.4 Implement deleteUserData() cascade logic
  - [ ] 3.1.5 Implement deleteClerkUser() integration
- [ ] 3.2 Update DELETE /api/users/me endpoint
  - [ ] 3.2.1 Add password/biometric verification
  - [ ] 3.2.2 Add rate limiting (1 request per hour)
  - [ ] 3.2.3 Add audit logging
- [ ] 3.3 Create email templates
  - [ ] 3.3.1 Account deletion confirmation email
  - [ ] 3.3.2 Permanent deletion confirmation email
- [ ] 3.4 Create cron job for permanent deletion (30-day cleanup)
- [ ] 3.5 Write unit tests for AccountDeletionService
- [ ] 3.6 Write integration tests for deletion flow

### 4. Enhanced Content Moderation Backend
- [ ] 4.1 Enhance ModerationService
  - [ ] 4.1.1 Add checkDuplicateReport() method
  - [ ] 4.1.2 Enhance calculateReportPriority() logic
  - [ ] 4.1.3 Add rate limiting to report submissions
- [ ] 4.2 Create report API routes
  - [ ] 4.2.1 POST /api/reports/reel/:reelId
  - [ ] 4.2.2 POST /api/reports/comment/:commentId
  - [ ] 4.2.3 POST /api/reports/user/:userId
  - [ ] 4.2.4 GET /api/reports/my-reports
- [ ] 4.3 Enhance block functionality
  - [ ] 4.3.1 Add GET /api/users/blocked endpoint
  - [ ] 4.3.2 Add rate limiting to block actions
  - [ ] 4.3.3 Update content queries to filter blocked users
- [ ] 4.4 Write unit tests for enhanced moderation
- [ ] 4.5 Write integration tests for reporting flow

## Phase 2: Frontend Components

### 5. Terms of Service UI
- [ ] 5.1 Create TermsOfServiceModal component
  - [ ] 5.1.1 Implement scrollable terms content
  - [ ] 5.1.2 Add scroll-to-bottom detection
  - [ ] 5.1.3 Add acceptance checkbox
  - [ ] 5.1.4 Add accept/decline buttons
  - [ ] 5.1.5 Add loading states
- [ ] 5.2 Create terms content display
- [ ] 5.3 Add terms link to Settings screen
- [ ] 5.4 Integrate terms modal into signup flow
  - [ ] 5.4.1 Show terms before account creation
  - [ ] 5.4.2 Record acceptance on signup
  - [ ] 5.4.3 Prevent signup without acceptance
- [ ] 5.5 Add translations for terms UI (EN, AR)

### 6. Account Deletion UI
- [ ] 6.1 Create AccountDeletionModal component
  - [ ] 6.1.1 Implement Step 1: Warning and data list
  - [ ] 6.1.2 Implement Step 2: Password/biometric confirmation
  - [ ] 6.1.3 Add final confirmation checkbox
  - [ ] 6.1.4 Add loading state during deletion
  - [ ] 6.1.5 Add success confirmation screen
- [ ] 6.2 Update Settings screen
  - [ ] 6.2.1 Add "Delete Account" button (danger style)
  - [ ] 6.2.2 Connect button to AccountDeletionModal
- [ ] 6.3 Implement deletion API integration
  - [ ] 6.3.1 Call DELETE /api/users/me
  - [ ] 6.3.2 Handle success response
  - [ ] 6.3.3 Handle error responses
  - [ ] 6.3.4 Clear local data after deletion
  - [ ] 6.3.5 Logout and redirect to auth screen
- [ ] 6.4 Add translations for deletion UI (EN, AR)

### 7. Content Reporting UI
- [ ] 7.1 Create ReportContentModal component
  - [ ] 7.1.1 Add reason selection (radio buttons)
  - [ ] 7.1.2 Add optional details input
  - [ ] 7.1.3 Add submit button with loading state
  - [ ] 7.1.4 Add success confirmation
- [ ] 7.2 Add report button to Reels
  - [ ] 7.2.1 Add to three-dot menu
  - [ ] 7.2.2 Connect to ReportContentModal
  - [ ] 7.2.3 Implement report submission
- [ ] 7.3 Add report button to Comments
  - [ ] 7.3.1 Add to long-press menu
  - [ ] 7.3.2 Connect to ReportContentModal
  - [ ] 7.3.3 Implement report submission
- [ ] 7.4 Add report button to User Profiles
  - [ ] 7.4.1 Add to three-dot menu
  - [ ] 7.4.2 Connect to ReportContentModal
  - [ ] 7.4.3 Implement report submission
- [ ] 7.5 Add translations for reporting UI (EN, AR)

### 8. User Blocking UI
- [ ] 8.1 Create BlockedUsersScreen component
  - [ ] 8.1.1 Display list of blocked users
  - [ ] 8.1.2 Add unblock button for each user
  - [ ] 8.1.3 Add empty state
  - [ ] 8.1.4 Add loading state
- [ ] 8.2 Add block button to User Profiles
  - [ ] 8.2.1 Add to three-dot menu
  - [ ] 8.2.2 Add confirmation dialog
  - [ ] 8.2.3 Implement block API call
  - [ ] 8.2.4 Update UI after blocking
- [ ] 8.3 Add "Blocked Users" option to Settings
  - [ ] 8.3.1 Add navigation to BlockedUsersScreen
- [ ] 8.4 Update content queries to filter blocked users
  - [ ] 8.4.1 Update reels feed query
  - [ ] 8.4.2 Update comments query
  - [ ] 8.4.3 Update search results
- [ ] 8.5 Add translations for blocking UI (EN, AR)

## Phase 3: Admin Dashboard (Optional for v1)

### 9. Admin Moderation Dashboard
- [ ]* 9.1 Create admin authentication middleware
- [ ]* 9.2 Create admin reports list screen
  - [ ]* 9.2.1 Display all pending reports
  - [ ]* 9.2.2 Add filters (type, status, priority)
  - [ ]* 9.2.3 Add sorting options
- [ ]* 9.3 Create report details screen
  - [ ]* 9.3.1 Display report information
  - [ ]* 9.3.2 Display reported content preview
  - [ ]* 9.3.3 Display user strike history
- [ ]* 9.4 Add admin action buttons
  - [ ]* 9.4.1 Approve content
  - [ ]* 9.4.2 Delete content
  - [ ]* 9.4.3 Warn user
  - [ ]* 9.4.4 Suspend user
  - [ ]* 9.4.5 Ban user
  - [ ]* 9.4.6 Reject report
- [ ]* 9.5 Create admin API endpoints
  - [ ]* 9.5.1 GET /api/admin/reports
  - [ ]* 9.5.2 GET /api/admin/reports/:id
  - [ ]* 9.5.3 POST /api/admin/reports/:id/action
  - [ ]* 9.5.4 GET /api/admin/users/:id/strikes

## Phase 4: Testing & Quality Assurance

### 10. Backend Testing
- [ ] 10.1 Write unit tests for TermsService
- [ ] 10.2 Write unit tests for AccountDeletionService
- [ ] 10.3 Write unit tests for enhanced ModerationService
- [ ] 10.4 Write integration tests for terms acceptance flow
- [ ] 10.5 Write integration tests for account deletion flow
- [ ] 10.6 Write integration tests for reporting flow
- [ ] 10.7 Write integration tests for blocking flow
- [ ] 10.8 Test email sending functionality
- [ ] 10.9 Test cron job for permanent deletion

### 11. Frontend Testing
- [ ] 11.1 Test TermsOfServiceModal component
- [ ] 11.2 Test AccountDeletionModal component
- [ ] 11.3 Test ReportContentModal component
- [ ] 11.4 Test BlockedUsersScreen component
- [ ] 11.5 Test terms acceptance during signup
- [ ] 11.6 Test account deletion from Settings
- [ ] 11.7 Test content reporting from reels
- [ ] 11.8 Test content reporting from comments
- [ ] 11.9 Test user blocking from profile
- [ ] 11.10 Test blocked users list

### 12. Manual Testing & Bug Fixes
- [ ] 12.1 Test complete account deletion flow
  - [ ] 12.1.1 Verify all user data is deleted
  - [ ] 12.1.2 Verify deletion email is sent
  - [ ] 12.1.3 Verify user is logged out
  - [ ] 12.1.4 Verify Clerk account is deleted
- [ ] 12.2 Test terms acceptance flow
  - [ ] 12.2.1 Verify terms are shown during signup
  - [ ] 12.2.2 Verify acceptance is recorded
  - [ ] 12.2.3 Verify terms are accessible from Settings
- [ ] 12.3 Test content reporting flow
  - [ ] 12.3.1 Report a reel
  - [ ] 12.3.2 Report a comment
  - [ ] 12.3.3 Report a user
  - [ ] 12.3.4 Verify confirmation is shown
- [ ] 12.4 Test user blocking flow
  - [ ] 12.4.1 Block a user
  - [ ] 12.4.2 Verify blocked user's content is hidden
  - [ ] 12.4.3 Verify follow relationships are removed
  - [ ] 12.4.4 Unblock a user
  - [ ] 12.4.5 Verify blocked users list
- [ ] 12.5 Fix any bugs found during testing

## Phase 5: Deployment & Submission

### 13. Deployment Preparation
- [ ] 13.1 Update environment variables
  - [ ] 13.1.1 Add email service credentials
  - [ ] 13.1.2 Add terms version number
- [ ] 13.2 Run database migrations on production
- [ ] 13.3 Deploy backend to Railway
  - [ ] 13.3.1 Verify deployment success
  - [ ] 13.3.2 Test API endpoints
  - [ ] 13.3.3 Monitor logs for errors
- [ ] 13.4 Build and deploy frontend to TestFlight
  - [ ] 13.4.1 Update app version number
  - [ ] 13.4.2 Build iOS app
  - [ ] 13.4.3 Upload to TestFlight
  - [ ] 13.4.4 Test on real device

### 14. Apple Submission
- [ ] 14.1 Prepare App Store submission
  - [ ] 14.1.1 Update app description
  - [ ] 14.1.2 Add screenshots showing new features
  - [ ] 14.1.3 Update privacy policy
  - [ ] 14.1.4 Update terms of service
- [ ] 14.2 Submit to Apple for review
- [ ] 14.3 Respond to Apple's feedback (if any)
- [ ] 14.4 Monitor for approval

### 15. Post-Deployment Monitoring
- [ ] 15.1 Monitor error logs
- [ ] 15.2 Monitor account deletion requests
- [ ] 15.3 Monitor report submissions
- [ ] 15.4 Monitor block actions
- [ ] 15.5 Monitor email delivery
- [ ] 15.6 Fix any production issues

## Notes

### Priority Levels
- **High Priority**: Tasks 1-8 (Core compliance features)
- **Medium Priority**: Tasks 10-12 (Testing)
- **Low Priority**: Task 9 (Admin dashboard - can be done later)

### Estimated Timeline
- Phase 1 (Backend): 3-4 days
- Phase 2 (Frontend): 4-5 days
- Phase 3 (Admin - Optional): 2-3 days
- Phase 4 (Testing): 2-3 days
- Phase 5 (Deployment): 1-2 days
- **Total**: 12-17 days (9-12 days without admin dashboard)

### Dependencies
- Clerk SDK for user deletion
- Email service (already configured)
- Prisma for database operations
- Existing moderation system (strikes, bans)

### Risk Mitigation
- Test account deletion thoroughly on staging first
- Implement 30-day grace period for account deletion
- Add comprehensive error handling
- Log all critical actions for audit
- Monitor production closely after deployment
