# Apple Demo Account Fix - Bugfix Design

## Overview

This bugfix addresses Apple Review rejection under Guideline 2.1 (Information Needed) by ensuring the demo account (aibuilder80@gmail.com) works reliably for Apple reviewers. The fix implements a comprehensive protection system that:

1. Creates/verifies the demo account in both Clerk and the database
2. Protects the account from deletion, suspension, strikes, and bans
3. Blocks moderation actions targeting the demo account
4. Populates sample data to demonstrate all app features
5. Ensures seamless authentication and full feature access

The approach uses a database flag (`isDemoAccount`) to identify protected accounts and middleware checks to prevent any modifications. This ensures Apple reviewers can always access the app during the review period without encountering authentication failures or restricted features.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when Apple reviewers attempt to sign in with demo account credentials and authentication fails or features are restricted
- **Property (P)**: The desired behavior - demo account authenticates successfully, has full feature access, and is protected from all moderation actions
- **Preservation**: Existing authentication, moderation, and account management flows for regular users must remain unchanged
- **isDemoAccount**: Boolean flag in User model that identifies protected demo accounts
- **Demo Account**: Special account (aibuilder80@gmail.com) used by Apple reviewers, protected from all modifications
- **Clerk**: Authentication service that manages user sessions and JWT tokens
- **Moderation Actions**: Strikes, suspensions, bans, warnings, and account deletions
- **Sample Data**: Pre-populated reels, quiz attempts, follows, and other content to demonstrate features

## Bug Details

### Fault Condition

The bug manifests when Apple reviewers attempt to sign in with the demo account credentials (aibuilder80@gmail.com / 1872004ME). The authentication system either fails to find the account, encounters moderation restrictions, or the account has been deleted/modified by normal app operations.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AuthenticationAttempt
  OUTPUT: boolean
  
  RETURN input.email == "aibuilder80@gmail.com"
         AND (
           NOT accountExistsInClerk(input.email) OR
           NOT accountExistsInDatabase(input.email) OR
           accountHasModeration(input.email) OR
           accountIsDeleted(input.email) OR
           accountLacksPermissions(input.email)
         )
END FUNCTION
```

### Examples

- **Example 1**: Reviewer attempts login → Account not found in Clerk → Authentication fails with "User not found"
- **Example 2**: Reviewer attempts login → Account exists but has `isDeleted=true` → Authentication fails or account inaccessible
- **Example 3**: Reviewer attempts login → Account has 3 strikes and is suspended → Features are restricted, reviewer cannot test full functionality
- **Example 4**: Reviewer attempts login → Account exists but has no sample data → Reviewer sees empty screens and cannot evaluate features
- **Edge Case**: Admin accidentally deletes demo account during maintenance → Next Apple review fails authentication

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Regular user authentication through Clerk must continue to work exactly as before
- Moderation actions (strikes, suspensions, bans) must continue to apply to regular users
- Account deletion with 30-day grace period must continue for regular users
- User registration and account creation must continue without demo protection
- Role-based access control must continue to enforce permissions for non-demo accounts
- Database seed script in development must continue to clear and recreate test data
- All existing API endpoints and middleware must function identically for regular users

**Scope:**
All inputs that do NOT involve the demo account (aibuilder80@gmail.com) should be completely unaffected by this fix. This includes:
- Authentication attempts with other email addresses
- Moderation actions on regular user accounts
- Account deletion requests from regular users
- User registration and profile updates
- Quiz attempts, reel uploads, and social interactions from regular users

## Hypothesized Root Cause

Based on the bug description and requirements analysis, the most likely issues are:

1. **Missing Account Creation**: The demo account was never created in production, or was created in Clerk but not synced to the database
   - Clerk authentication succeeds but database lookup fails
   - No user record exists to attach sessions and data to

2. **Account Modification/Deletion**: The demo account exists but has been modified by normal app operations
   - Account marked as deleted (`isDeleted=true`) through account deletion flow
   - Account has strikes, suspensions, or bans from moderation actions
   - Account scheduled for deletion (`scheduledDeletionAt` set)

3. **Lack of Protection Mechanism**: No system exists to identify and protect special accounts
   - Demo account can be deleted like any regular account
   - Moderation actions can be applied to demo account
   - No flag or identifier distinguishes demo accounts from regular users

4. **Missing Sample Data**: Demo account exists but has no content to demonstrate features
   - Empty reels feed, no quiz attempts, no follows
   - Apple reviewers see blank screens and cannot evaluate functionality

## Correctness Properties

Property 1: Fault Condition - Demo Account Authentication and Protection

_For any_ authentication attempt where the email is "aibuilder80@gmail.com", the system SHALL ensure the account exists in both Clerk and the database, has no moderation restrictions (strikes, suspensions, bans, deletion flags), has full permissions, is marked with `isDemoAccount=true`, and authenticates successfully with full feature access.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

Property 2: Preservation - Regular User Behavior

_For any_ authentication attempt, moderation action, or account operation where the target is NOT the demo account (email != "aibuilder80@gmail.com"), the system SHALL produce exactly the same behavior as the original code, preserving all existing authentication flows, moderation actions, account deletion processes, and user management operations.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

Property 3: Moderation Protection - Demo Account Immunity

_For any_ moderation action (strike creation, suspension, ban, account deletion) where the target user has `isDemoAccount=true`, the system SHALL block the action, return an error indicating the account is protected, and log the attempt for audit purposes.

**Validates: Requirements 2.5, 2.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the following changes are needed:

#### 1. Database Schema Changes

**File**: `Backend/prisma/schema.prisma`

**Model**: `User`

**Specific Changes**:
1. **Add isDemoAccount Field**: Add boolean field to identify protected demo accounts
   ```prisma
   isDemoAccount Boolean @default(false)
   ```
   - Default to `false` for all regular users
   - Set to `true` only for demo accounts
   - Add index for efficient queries: `@@index([isDemoAccount])`

2. **Create Migration**: Generate Prisma migration to add the field
   - Run `npm run prisma:migrate dev --name add_demo_account_flag`
   - Migration will add column with default value `false`

#### 2. Demo Account Service

**File**: `Backend/src/services/demo-account.service.ts` (NEW)

**Purpose**: Centralized service for demo account management

**Specific Changes**:
1. **Create DemoAccountService Class**: Implement service with methods:
   - `ensureDemoAccountExists()`: Create/verify demo account in Clerk and database
   - `isDemoAccount(userId: string)`: Check if user is a demo account
   - `isDemoAccountByEmail(email: string)`: Check by email
   - `populateSampleData(userId: string)`: Create sample reels, quiz attempts, follows
   - `verifyDemoAccountIntegrity()`: Health check for demo account status

2. **Clerk Integration**: Use `@clerk/clerk-sdk-node` to:
   - Check if demo account exists in Clerk
   - Create account if missing with correct credentials
   - Sync Clerk user ID to database

3. **Database Sync**: Ensure database record matches Clerk:
   - Create User record with `isDemoAccount=true`
   - Set `clerkUserId` to match Clerk
   - Clear any moderation flags (strikes, suspensions, bans, deletion)

4. **Sample Data Population**: Create realistic demo content:
   - 5-10 sample reels with views, likes, comments
   - Quiz attempts across multiple categories
   - Follow relationships with other users
   - Coin transactions and achievements
   - Notifications to demonstrate notification system

#### 3. Moderation Protection Middleware

**File**: `Backend/src/middleware/demo-protection.middleware.ts` (NEW)

**Purpose**: Block moderation actions on demo accounts

**Specific Changes**:
1. **Create checkDemoAccountProtection Middleware**: Intercept moderation actions
   - Extract target user ID from request (params, body, query)
   - Check if target user has `isDemoAccount=true`
   - If protected, return 403 error with message "Cannot modify demo account"
   - Log attempt to audit log for security monitoring

2. **Apply to Moderation Routes**: Add middleware to:
   - Strike creation endpoints
   - Suspension endpoints
   - Ban endpoints
   - Account deletion endpoints
   - Warning issuance endpoints

#### 4. Account Deletion Protection

**File**: `Backend/src/services/account-deletion.service.ts`

**Function**: `initiateAccountDeletion`

**Specific Changes**:
1. **Add Demo Account Check**: Before processing deletion:
   ```typescript
   // Check if user is demo account
   const user = await prisma.user.findUnique({
     where: { id: userId },
     select: { isDemoAccount: true }
   });
   
   if (user?.isDemoAccount) {
     throw new Error('Cannot delete demo account');
   }
   ```

2. **Early Return**: Prevent any deletion operations on demo accounts
3. **Audit Logging**: Log deletion attempts on demo accounts

#### 5. Moderation Controller Updates

**File**: `Backend/src/controllers/moderation.controller.ts`

**Functions**: All moderation action functions

**Specific Changes**:
1. **Add Demo Check to Strike Creation**: Before creating strikes:
   ```typescript
   const targetUser = await prisma.user.findUnique({
     where: { id: reportedUserId },
     select: { isDemoAccount: true }
   });
   
   if (targetUser?.isDemoAccount) {
     return res.status(403).json({
       status: 'ERROR',
       message: 'Cannot apply moderation actions to demo account',
       code: 'DEMO_ACCOUNT_PROTECTED'
     });
   }
   ```

2. **Apply to All Moderation Actions**: Add similar checks to:
   - `createStrike()`
   - `suspendUser()`
   - `banUser()`
   - `issueWarning()`

#### 6. Startup Initialization

**File**: `Backend/src/main.ts`

**Location**: After database connection, before server start

**Specific Changes**:
1. **Add Demo Account Initialization**: Call service on startup:
   ```typescript
   // Ensure demo account exists and is properly configured
   if (process.env.NODE_ENV === 'production') {
     await DemoAccountService.ensureDemoAccountExists();
     logger.info('✅ Demo account verified and ready');
   }
   ```

2. **Environment Check**: Only run in production to avoid conflicts with development seed data

3. **Error Handling**: Log errors but don't block server startup

#### 7. Seed Script Update

**File**: `Backend/prisma/seed.ts`

**Purpose**: Ensure seed doesn't interfere with demo account in production

**Specific Changes**:
1. **Add Environment Check**: Skip demo account operations in development:
   ```typescript
   // Don't delete demo accounts in production
   if (process.env.NODE_ENV !== 'production') {
     await prisma.user.deleteMany();
   } else {
     await prisma.user.deleteMany({
       where: { isDemoAccount: false }
     });
   }
   ```

2. **Preserve Demo Data**: Ensure seed script doesn't clear demo account or its data

## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach:
1. **Exploratory Testing**: Verify the bug exists on unfixed code by attempting demo account login
2. **Fix Verification**: Confirm demo account works after implementing protection
3. **Preservation Testing**: Ensure regular user flows remain unchanged

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Attempt to authenticate with demo account credentials on unfixed production code. Check database for account existence, moderation status, and sample data. Run these tests to observe failures and understand the root cause.

**Test Cases**:
1. **Authentication Test**: Attempt login with aibuilder80@gmail.com (will fail on unfixed code)
   - Expected: Authentication fails with "User not found" or similar error
   - Confirms: Account doesn't exist or is inaccessible

2. **Database Check Test**: Query database for demo account record (will fail on unfixed code)
   - Expected: No user record found, or record has `isDeleted=true`
   - Confirms: Account missing or marked as deleted

3. **Moderation Status Test**: Check if demo account has strikes/suspensions (may fail on unfixed code)
   - Expected: Account may have strikes, suspensions, or bans
   - Confirms: No protection mechanism exists

4. **Sample Data Test**: Check if demo account has reels, quiz attempts, follows (will fail on unfixed code)
   - Expected: Empty data, no content to demonstrate features
   - Confirms: Sample data not populated

**Expected Counterexamples**:
- Demo account authentication fails with 401 Unauthorized
- Database query returns null or deleted account
- Possible causes: account never created, account deleted, account has moderation restrictions, Clerk/database sync issue

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (demo account authentication), the fixed system produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := authenticateUser_fixed(input)
  ASSERT result.authenticated == true
  ASSERT result.user.isDemoAccount == true
  ASSERT result.user.isDeleted == false
  ASSERT result.user.isSuspended == false
  ASSERT result.user.isBanned == false
  ASSERT result.user.strikes.length == 0
  ASSERT result.user.hasFullAccess == true
END FOR
```

**Test Cases**:
1. **Demo Account Authentication**: Login with aibuilder80@gmail.com
   - Expected: Authentication succeeds, JWT token issued, full access granted
   - Validates: Property 1 (Fault Condition)

2. **Demo Account Database Record**: Query database for demo account
   - Expected: User record exists with `isDemoAccount=true`, no moderation flags
   - Validates: Property 1 (Fault Condition)

3. **Demo Account Sample Data**: Check for reels, quiz attempts, follows
   - Expected: Sample data exists, demonstrates all features
   - Validates: Requirement 2.8

4. **Moderation Protection**: Attempt to create strike on demo account
   - Expected: Action blocked with 403 error, audit log entry created
   - Validates: Property 3 (Moderation Protection)

5. **Account Deletion Protection**: Attempt to delete demo account
   - Expected: Deletion blocked with error message
   - Validates: Property 3 (Moderation Protection)

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (regular user operations), the fixed system produces the same result as the original system.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT authenticateUser_original(input) == authenticateUser_fixed(input)
  ASSERT applyModeration_original(input) == applyModeration_fixed(input)
  ASSERT deleteAccount_original(input) == deleteAccount_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-demo inputs

**Test Plan**: Observe behavior on UNFIXED code first for regular user operations, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Regular User Authentication**: Observe that regular users can authenticate successfully on unfixed code, then verify this continues after fix
   - Test with various email addresses (not aibuilder80@gmail.com)
   - Verify authentication flow identical

2. **Regular User Moderation**: Observe that strikes, suspensions, bans work on regular users in unfixed code, then verify this continues after fix
   - Create strikes on regular users
   - Suspend and ban regular users
   - Verify moderation actions apply correctly

3. **Regular User Account Deletion**: Observe that account deletion works for regular users in unfixed code, then verify this continues after fix
   - Initiate account deletion for regular users
   - Verify 30-day grace period applies
   - Verify permanent deletion occurs

4. **User Registration**: Observe that new users can register in unfixed code, then verify this continues after fix
   - Register new accounts
   - Verify `isDemoAccount=false` by default
   - Verify no demo protection applied

### Unit Tests

- Test `DemoAccountService.isDemoAccount()` with demo and regular users
- Test `DemoAccountService.ensureDemoAccountExists()` creates account correctly
- Test `DemoAccountService.populateSampleData()` creates all required content
- Test demo protection middleware blocks moderation actions
- Test demo protection middleware allows actions on regular users
- Test account deletion service rejects demo account deletion
- Test moderation controller checks demo account before applying actions

### Property-Based Tests

- Generate random user IDs and verify moderation actions work for non-demo accounts
- Generate random authentication attempts and verify regular users authenticate correctly
- Generate random account deletion requests and verify regular users can delete accounts
- Test that `isDemoAccount` flag is never set to `true` during normal registration

### Integration Tests

- Test full authentication flow for demo account from login to feature access
- Test demo account can upload reels, take quizzes, follow users
- Test moderation actions are blocked end-to-end for demo account
- Test regular users can perform all actions without interference from demo protection
- Test server startup initializes demo account correctly
- Test database migration adds `isDemoAccount` field without breaking existing data
