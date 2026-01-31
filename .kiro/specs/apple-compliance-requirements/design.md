# Apple Compliance Requirements - Design Document

## 1. System Architecture

### 1.1 Overview
The system will implement two major features:
1. **Account Deletion Flow**: Complete user account deletion with data cleanup
2. **Enhanced Content Moderation**: Terms acceptance, reporting, and blocking features

### 1.2 Components

#### Frontend Components (React Native)
- `AccountDeletionModal.tsx` - Account deletion confirmation flow
- `TermsOfServiceModal.tsx` - EULA/Terms display and acceptance
- `ReportContentModal.tsx` - Content reporting interface
- `BlockedUsersScreen.tsx` - Manage blocked users
- Enhanced Settings screen with new options

#### Backend Services
- `AccountDeletionService` - Handle account deletion logic
- `TermsService` - Manage terms acceptance
- Enhanced `ModerationService` - Content reporting and blocking
- `EmailService` - Send deletion confirmations

#### Database Changes
- New `TermsAcceptance` table
- New `Block` table (already exists in schema)
- Enhanced `Report` table functionality
- Account deletion tracking

## 2. Feature Design

### 2.1 Account Deletion Flow

#### 2.1.1 User Interface Flow
```
Settings Screen
  ↓
[Delete Account Button] (Red/Danger style)
  ↓
Account Deletion Modal (Step 1)
  - Warning message about data loss
  - List of data that will be deleted
  - "Continue" and "Cancel" buttons
  ↓
Account Deletion Modal (Step 2)
  - Password/Biometric confirmation
  - Final confirmation checkbox
  - "Delete My Account" button
  ↓
Processing Screen
  - Loading indicator
  - "Deleting your account..."
  ↓
Confirmation Screen
  - Success message
  - Email confirmation sent
  - Auto-logout and redirect to auth
```

#### 2.1.2 Data Deletion Scope
The following data will be deleted:
- User profile (username, email, avatar, cover)
- All uploaded reels (videos)
- All comments
- All likes
- All predictions
- All quiz progress
- All notifications
- All follows/followers
- All reports made by user
- All blocks
- Clerk user account

Data that will be retained (anonymized):
- Audit logs (for legal compliance)
- Aggregated analytics (no PII)

#### 2.1.3 Backend Implementation

**API Endpoint:**
```typescript
DELETE /api/users/me
Authorization: Bearer <token>
Body: {
  password?: string,
  confirmDeletion: boolean
}
```

**Service Logic:**
```typescript
class AccountDeletionService {
  async deleteAccount(userId: string, clerkUserId: string) {
    // 1. Soft delete user (mark as deleted)
    // 2. Schedule permanent deletion (30 days)
    // 3. Delete Clerk account
    // 4. Cascade delete related data
    // 5. Send confirmation email
    // 6. Log audit trail
  }
  
  async permanentlyDeleteAccount(userId: string) {
    // Called by cron job after 30 days
    // Hard delete all user data
  }
}
```

**Database Changes:**
```prisma
model User {
  // ... existing fields
  isDeleted       Boolean   @default(false)
  deletedAt       DateTime?
  scheduledDeletionAt DateTime?
}
```

### 2.2 Terms of Service (EULA)

#### 2.2.1 Terms Display
- Show terms during signup (before account creation)
- User must scroll to bottom to enable "Accept" button
- Checkbox: "I agree to the Terms of Service"
- Link to full terms in Settings

#### 2.2.2 Terms Content
The terms must include:
- Zero tolerance policy for objectionable content
- Definition of abusive behavior
- Consequences of violations (strikes, suspension, ban)
- User responsibilities
- Content ownership and rights
- Privacy policy reference

#### 2.2.3 Backend Implementation

**Database Schema:**
```prisma
model TermsAcceptance {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  version     String   // e.g., "1.0"
  acceptedAt  DateTime @default(now())
  ipAddress   String?
  
  @@unique([userId, version])
  @@index([userId])
}
```

**API Endpoints:**
```typescript
GET /api/terms/latest
POST /api/terms/accept
GET /api/terms/user-acceptance
```

### 2.3 Enhanced Content Reporting

#### 2.3.1 Report Button Placement
- Reels: Three-dot menu → "Report"
- Comments: Long-press → "Report"
- User Profiles: Three-dot menu → "Report User"

#### 2.3.2 Report Flow
```
[Report Button]
  ↓
Report Modal
  - Select reason (radio buttons):
    • Spam
    • Harassment
    • Inappropriate Content
    • Violence
    • Hate Speech
    • Copyright Violation
    • Other
  - Optional: Additional details (text input)
  - "Submit Report" button
  ↓
Confirmation
  - "Thank you for reporting"
  - "We'll review this within 24 hours"
```

#### 2.3.3 Backend Enhancement

**Existing Report Model (already in schema):**
```prisma
model Report {
  id                String        @id @default(uuid())
  reporterId        String
  reporter          User          @relation("ReportsMade", fields: [reporterId], references: [id])
  reportedUserId    String?
  reportedUser      User?         @relation("ReportsReceived", fields: [reportedUserId], references: [id])
  reportedReelId    String?
  reportedReel      Reel?         @relation(fields: [reportedReelId], references: [id])
  reportedCommentId String?
  reportedComment   Comment?      @relation(fields: [reportedCommentId], references: [id])
  type              ReportType
  reason            String
  status            ReportStatus  @default(PENDING)
  priority          ReportPriority @default(MEDIUM)
  reviewedBy        String?
  reviewedAt        DateTime?
  createdAt         DateTime      @default(now())
  
  @@index([reporterId])
  @@index([reportedUserId])
  @@index([status])
  @@index([priority])
}
```

**Enhanced API:**
```typescript
POST /api/reports/reel/:reelId
POST /api/reports/comment/:commentId
POST /api/reports/user/:userId
GET /api/reports/my-reports (user's submitted reports)
```

### 2.4 User Blocking System

#### 2.4.1 Block Flow
```
User Profile / Content
  ↓
[Block User Button]
  ↓
Confirmation Dialog
  - "Block @username?"
  - "They won't be able to see your content"
  - "Block" and "Cancel" buttons
  ↓
Success
  - "User blocked"
  - User removed from followers/following
```

#### 2.4.2 Block Effects
When User A blocks User B:
- B cannot see A's reels
- B cannot comment on A's content
- B cannot follow A
- Existing follow relationships are removed
- B's content is hidden from A's feed

#### 2.4.3 Backend Implementation

**Existing Block Model (already in schema):**
```prisma
model Block {
  id        String   @id @default(uuid())
  blockerId String
  blocker   User     @relation("BlocksMade", fields: [blockerId], references: [id], onDelete: Cascade)
  blockedId String
  blocked   User     @relation("BlocksReceived", fields: [blockedId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  
  @@unique([blockerId, blockedId])
  @@index([blockerId])
  @@index([blockedId])
}
```

**API Endpoints (already exist):**
```typescript
POST /api/users/block/:userId
DELETE /api/users/block/:userId
GET /api/users/blocked (list of blocked users)
```

**Query Modifications:**
All content queries must filter blocked users:
```typescript
// Example: Get reels feed
const reels = await prisma.reel.findMany({
  where: {
    isDeleted: false,
    userId: {
      notIn: blockedUserIds // Filter out blocked users
    }
  }
});
```

### 2.5 Admin Moderation Dashboard

#### 2.5.1 Dashboard Features
- View all pending reports (sorted by priority)
- Filter by report type, status, priority
- Quick actions: Approve, Delete Content, Warn User, Ban User
- View user's strike history
- View reported content preview

#### 2.5.2 Admin Actions
```typescript
enum AdminAction {
  APPROVE_CONTENT = 'APPROVE_CONTENT',
  DELETE_CONTENT = 'DELETE_CONTENT',
  WARN_USER = 'WARN_USER',
  SUSPEND_USER = 'SUSPEND_USER',
  BAN_USER = 'BAN_USER',
  REJECT_REPORT = 'REJECT_REPORT'
}
```

#### 2.5.3 API Endpoints
```typescript
GET /api/admin/reports (list all reports)
GET /api/admin/reports/:id (get report details)
POST /api/admin/reports/:id/action (take action on report)
GET /api/admin/users/:id/strikes (get user's strike history)
```

## 3. Technical Implementation Details

### 3.1 Frontend Components

#### 3.1.1 AccountDeletionModal.tsx
```typescript
interface AccountDeletionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

// Features:
// - Two-step confirmation
// - Password/biometric verification
// - Data deletion list display
// - Loading state during deletion
```

#### 3.1.2 TermsOfServiceModal.tsx
```typescript
interface TermsOfServiceModalProps {
  visible: boolean;
  onAccept: () => Promise<void>;
  onDecline: () => void;
  required: boolean; // true during signup
}

// Features:
// - Scrollable terms content
// - Accept button enabled only after scrolling to bottom
// - Checkbox for explicit acceptance
// - Version tracking
```

#### 3.1.3 ReportContentModal.tsx
```typescript
interface ReportContentModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'reel' | 'comment' | 'user';
  contentId: string;
  onSubmit: (reason: string, details?: string) => Promise<void>;
}

// Features:
// - Reason selection (radio buttons)
// - Optional details input
// - Submit button with loading state
// - Success confirmation
```

### 3.2 Backend Services

#### 3.2.1 AccountDeletionService
```typescript
class AccountDeletionService {
  // Soft delete user and schedule permanent deletion
  async initiateAccountDeletion(userId: string, clerkUserId: string): Promise<void>
  
  // Permanently delete user data (called by cron job)
  async permanentlyDeleteAccount(userId: string): Promise<void>
  
  // Cancel deletion (if user logs in within grace period)
  async cancelAccountDeletion(userId: string): Promise<void>
  
  // Send deletion confirmation email
  async sendDeletionConfirmationEmail(email: string, username: string): Promise<void>
  
  // Delete Clerk user
  async deleteClerkUser(clerkUserId: string): Promise<void>
  
  // Cascade delete related data
  async deleteUserData(userId: string): Promise<void>
}
```

#### 3.2.2 TermsService
```typescript
class TermsService {
  // Get latest terms version
  async getLatestTerms(): Promise<{ version: string; content: string }>
  
  // Record user acceptance
  async recordAcceptance(userId: string, version: string, ipAddress?: string): Promise<void>
  
  // Check if user accepted latest terms
  async hasAcceptedLatestTerms(userId: string): Promise<boolean>
  
  // Get user's acceptance history
  async getUserAcceptanceHistory(userId: string): Promise<TermsAcceptance[]>
}
```

#### 3.2.3 Enhanced ModerationService
```typescript
class ModerationService {
  // Create report (already exists, enhance with duplicate check)
  async createReport(params: CreateReportParams): Promise<Report>
  
  // Check for duplicate reports
  async checkDuplicateReport(params: DuplicateCheckParams): Promise<boolean>
  
  // Calculate report priority
  async calculateReportPriority(params: PriorityParams): Promise<ReportPriority>
  
  // Process report (create strike, check thresholds)
  async processReport(reportId: string): Promise<void>
  
  // Auto-delete content
  async autoDeleteContent(contentId: string, contentType: 'reel' | 'comment'): Promise<void>
  
  // Suspend user
  async suspendUser(userId: string, reason: string, durationDays: number): Promise<void>
}
```

### 3.3 Database Migrations

#### 3.3.1 Add TermsAcceptance Table
```sql
CREATE TABLE "TermsAcceptance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "TermsAcceptance_userId_version_key" ON "TermsAcceptance"("userId", "version");
CREATE INDEX "TermsAcceptance_userId_idx" ON "TermsAcceptance"("userId");
```

#### 3.3.2 Add Account Deletion Fields
```sql
ALTER TABLE "User" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "scheduledDeletionAt" TIMESTAMP(3);

CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");
CREATE INDEX "User_scheduledDeletionAt_idx" ON "User"("scheduledDeletionAt");
```

### 3.4 Email Templates

#### 3.4.1 Account Deletion Confirmation
```html
Subject: Account Deletion Confirmation - 90Plus

Dear [Username],

Your account deletion request has been processed successfully.

What happens next:
- Your account is now deactivated
- All your data will be permanently deleted within 30 days
- You will receive a final confirmation email after permanent deletion

If you did not request this deletion, please contact us immediately at support@90plus.com

Thank you for using 90Plus.

Best regards,
The 90Plus Team
```

## 4. Security Considerations

### 4.1 Account Deletion Security
- Require password/biometric confirmation
- Log all deletion requests for audit
- Implement rate limiting (max 1 deletion request per hour)
- Send email confirmation to user's registered email
- Implement 30-day grace period before permanent deletion

### 4.2 Content Moderation Security
- Rate limit report submissions (max 10 reports per hour per user)
- Detect and prevent report spam/abuse
- Log all moderation actions for audit
- Implement admin authentication for moderation dashboard
- Encrypt sensitive report data

### 4.3 Blocking Security
- Prevent block evasion (can't unblock and re-block rapidly)
- Rate limit block actions (max 20 blocks per hour)
- Log all block/unblock actions

## 5. Testing Strategy

### 5.1 Unit Tests
- AccountDeletionService methods
- TermsService methods
- ModerationService enhancements
- Email sending functionality

### 5.2 Integration Tests
- Complete account deletion flow
- Terms acceptance during signup
- Report submission and processing
- Block/unblock user flow

### 5.3 E2E Tests
- User deletes account from Settings
- User accepts terms during signup
- User reports content and receives confirmation
- User blocks another user and verifies effects

### 5.4 Manual Testing Checklist
- [ ] Account deletion removes all user data
- [ ] Deletion confirmation email is sent
- [ ] Terms are displayed during signup
- [ ] Terms acceptance is recorded
- [ ] Report button is visible on all content
- [ ] Report submission works for reels, comments, users
- [ ] Block user removes follow relationships
- [ ] Blocked user's content is hidden
- [ ] Admin dashboard shows all reports
- [ ] Admin actions work correctly

## 6. Deployment Plan

### 6.1 Phase 1: Database Migration
1. Run Prisma migration for TermsAcceptance table
2. Add account deletion fields to User table
3. Verify Block table exists (already in schema)

### 6.2 Phase 2: Backend Implementation
1. Implement AccountDeletionService
2. Implement TermsService
3. Enhance ModerationService
4. Add new API endpoints
5. Add email templates

### 6.3 Phase 3: Frontend Implementation
1. Create AccountDeletionModal component
2. Create TermsOfServiceModal component
3. Create ReportContentModal component
4. Create BlockedUsersScreen
5. Update Settings screen
6. Update signup flow to show terms

### 6.4 Phase 4: Testing
1. Run unit tests
2. Run integration tests
3. Perform manual testing
4. Fix bugs

### 6.5 Phase 5: Deployment
1. Deploy backend to Railway
2. Deploy frontend to TestFlight
3. Monitor for errors
4. Submit to Apple for review

## 7. Success Criteria

### 7.1 Account Deletion
- ✅ User can delete account from Settings in < 2 minutes
- ✅ All user data is deleted within 30 days
- ✅ Deletion confirmation email is sent
- ✅ User is logged out immediately after deletion

### 7.2 Terms of Service
- ✅ Terms are displayed during signup
- ✅ User must accept terms before creating account
- ✅ Terms are accessible from Settings
- ✅ Terms acceptance is recorded in database

### 7.3 Content Reporting
- ✅ Report button is visible on all content
- ✅ Report submission takes < 30 seconds
- ✅ User receives confirmation after reporting
- ✅ Reports are visible in admin dashboard

### 7.4 User Blocking
- ✅ User can block another user in < 10 seconds
- ✅ Blocked user's content is hidden
- ✅ Follow relationships are removed
- ✅ User can manage blocked users in Settings

## 8. Apple Compliance Checklist

### 8.1 Guideline 5.1.1(v) - Account Deletion
- ✅ Account deletion option is available in Settings
- ✅ Deletion process is straightforward (< 3 steps)
- ✅ User is warned about data loss
- ✅ Deletion is permanent (not just deactivation)
- ✅ Confirmation email is sent

### 8.2 Guideline 1.2 - User-Generated Content
- ✅ Terms of Service (EULA) is presented during signup
- ✅ Terms state zero tolerance for objectionable content
- ✅ Users can report abusive content
- ✅ Users can block abusive users
- ✅ Blocking removes content from user's feed
- ✅ Admin moderation system is in place

## 9. Future Enhancements (Out of Scope for v1)

- Data export before deletion (GDPR compliance)
- Appeal process for moderation decisions
- Multi-language support for terms
- Automated content filtering (AI/ML)
- User reputation system
- Community moderation (trusted users)
