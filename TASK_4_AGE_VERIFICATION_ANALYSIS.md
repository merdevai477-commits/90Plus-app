# ⚖️ TASK 4/12 - Age Verification System - Analysis

**Date**: March 30, 2026  
**Status**: In Progress  
**Priority**: LEGAL CRITICAL  
**Compliance**: COPPA, GDPR-K, Apple App Store

---

## 📋 Legal Requirements

### COPPA (Children's Online Privacy Protection Act)
- **Under 13**: Cannot collect personal information without verifiable parental consent
- **13-17**: Limited data collection, parental notification recommended
- **18+**: Full access

### Apple App Store Guidelines
- **4.1.1**: Apps must comply with all legal requirements for children's privacy
- **5.1.4**: Kids Category apps must include a privacy policy
- **Must have**: Age gate before any data collection

### GDPR-K (GDPR for Kids)
- **Under 16**: Requires parental consent (varies by country)
- **Data minimization**: Collect only necessary data
- **Right to erasure**: Must allow account deletion

---

## 🎯 Current State

### Issues:
1. ❌ No age verification system
2. ❌ No age gate screen
3. ❌ No parental consent flow
4. ❌ No age-based content restrictions
5. ❌ No age tier tracking in database
6. ❌ Legal liability risk

### Existing User Model:
```prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  username    String   @unique
  // ... other fields
  // ❌ Missing: dateOfBirth, ageVerifiedAt, ageTier, parentalConsent
}
```

---

## 🔧 Solution Architecture

### 1. Age Tiers
```typescript
enum AgeTier {
  BLOCKED  // Under 13 - No access
  TEEN     // 13-17 - Limited access
  ADULT    // 18+ - Full access
}
```

### 2. User Flow

**New User**:
```
1. Splash Screen
2. Age Gate Screen (MANDATORY)
   ├─ Under 13 → Block with message
   ├─ 13-17 → Parental Consent Flow
   └─ 18+ → Continue to Sign Up
3. Sign Up / Sign In
4. App Content
```

**Existing User (Migration)**:
```
1. Login
2. Check if ageVerifiedAt exists
   ├─ No → Redirect to Age Gate
   └─ Yes → Continue
```

### 3. Parental Consent Flow (13-17)

```
1. Teen enters DOB (13-17)
2. ParentalConsentScreen
   ├─ Enter parent email
   ├─ Send verification email
   ├─ Show waiting screen
   └─ Parent clicks link in email
3. Parent confirms consent
4. Teen account activated
5. Timeout after 48 hours if no response
```

### 4. Content Restrictions

| Feature | BLOCKED (<13) | TEEN (13-17) | ADULT (18+) |
|---------|---------------|--------------|-------------|
| View Content | ❌ | ✅ Limited | ✅ Full |
| Create Reels | ❌ | ✅ Moderated | ✅ |
| Comments | ❌ | ✅ Moderated | ✅ |
| Chat/DM | ❌ | ❌ | ✅ |
| Follow Users | ❌ | ✅ Limited | ✅ |
| Real Money | ❌ | ❌ | ✅ |
| Profile Public | ❌ | ❌ Default | ✅ Default |
| Location Sharing | ❌ | ❌ | ✅ Optional |

---

## 📊 Database Schema Changes

### User Model Updates:
```prisma
model User {
  // ... existing fields
  
  // Age Verification
  dateOfBirth     DateTime?
  ageVerifiedAt   DateTime?
  ageTier         AgeTier?
  
  // Parental Consent (for TEEN tier)
  parentalConsent Boolean @default(false)
  parentEmail     String?
  parentalConsentRequestedAt DateTime?
  parentalConsentConfirmedAt DateTime?
  
  // Relations
  parentalConsentRequests ParentalConsentRequest[]
}

model ParentalConsentRequest {
  id              String   @id @default(uuid())
  userId          String
  parentEmail     String
  token           String   @unique
  status          ConsentStatus @default(PENDING)
  requestedAt     DateTime @default(now())
  confirmedAt     DateTime?
  expiresAt       DateTime // 48 hours from requestedAt
  ipAddress       String?
  userAgent       String?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([token])
  @@index([status])
  @@index([expiresAt])
}

enum AgeTier {
  BLOCKED  // Under 13
  TEEN     // 13-17
  ADULT    // 18+
}

enum ConsentStatus {
  PENDING
  CONFIRMED
  EXPIRED
  REJECTED
}
```

---

## 🎨 UI/UX Design

### 1. Age Gate Screen
```
┌─────────────────────────────┐
│                             │
│      🎂 Welcome to 90Plus   │
│                             │
│   To continue, please       │
│   verify your age           │
│                             │
│   ┌─────────────────────┐  │
│   │ Date of Birth       │  │
│   │ DD / MM / YYYY      │  │
│   └─────────────────────┘  │
│                             │
│   [Continue]                │
│                             │
│   Why we ask: COPPA         │
│   compliance & safety       │
│                             │
└─────────────────────────────┘
```

### 2. Under 13 Block Screen
```
┌─────────────────────────────┐
│                             │
│      😔 Sorry!              │
│                             │
│   You must be at least      │
│   13 years old to use       │
│   90Plus                    │
│                             │
│   This is required by law   │
│   (COPPA compliance)        │
│                             │
│   [Exit App]                │
│                             │
└─────────────────────────────┘
```

### 3. Parental Consent Screen (13-17)
```
┌─────────────────────────────┐
│                             │
│   👨‍👩‍👧 Parental Consent      │
│                             │
│   You're 13-17 years old.   │
│   We need your parent's     │
│   permission to continue.   │
│                             │
│   ┌─────────────────────┐  │
│   │ Parent's Email      │  │
│   │ parent@example.com  │  │
│   └─────────────────────┘  │
│                             │
│   [Send Request]            │
│                             │
│   We'll email your parent   │
│   for verification          │
│                             │
└─────────────────────────────┘
```

### 4. Waiting for Consent Screen
```
┌─────────────────────────────┐
│                             │
│   ⏳ Waiting for Parent      │
│                             │
│   We sent an email to:      │
│   parent@example.com        │
│                             │
│   Please ask your parent    │
│   to check their email      │
│   and confirm.              │
│                             │
│   ⏱️ Expires in: 47h 23m     │
│                             │
│   [Resend Email]            │
│   [Change Email]            │
│                             │
└─────────────────────────────┘
```

---

## 🔐 Security Considerations

### 1. Age Verification
- ✅ Store DOB securely (encrypted)
- ✅ Calculate age server-side (don't trust client)
- ✅ Prevent age manipulation (one-time verification)
- ✅ Audit log for age changes

### 2. Parental Consent
- ✅ Unique token per request (UUID)
- ✅ Token expires after 48 hours
- ✅ Rate limit consent requests (max 3 per day)
- ✅ Verify parent email (send confirmation)
- ✅ Log IP address and user agent

### 3. Data Protection
- ✅ Encrypt DOB in database
- ✅ Minimal data collection for TEEN tier
- ✅ Auto-delete expired consent requests
- ✅ GDPR-compliant data handling

---

## 📝 API Endpoints

### 1. POST /api/auth/verify-age
**Request**:
```json
{
  "dateOfBirth": "2005-03-15",
  "userId": "user-uuid"
}
```

**Response**:
```json
{
  "status": "SUCCESS",
  "ageTier": "TEEN",
  "requiresParentalConsent": true,
  "message": "Parental consent required"
}
```

### 2. POST /api/auth/request-parental-consent
**Request**:
```json
{
  "userId": "user-uuid",
  "parentEmail": "parent@example.com"
}
```

**Response**:
```json
{
  "status": "SUCCESS",
  "requestId": "request-uuid",
  "expiresAt": "2026-04-01T12:00:00Z",
  "message": "Consent request sent to parent"
}
```

### 3. POST /api/auth/confirm-parental-consent/:token
**Request**: (from email link)
```
GET /api/auth/confirm-parental-consent/abc123token
```

**Response**:
```html
<!-- Success page -->
<html>
  <body>
    <h1>✅ Consent Confirmed</h1>
    <p>Your child can now use 90Plus.</p>
  </body>
</html>
```

### 4. GET /api/auth/age-status
**Response**:
```json
{
  "status": "SUCCESS",
  "ageVerified": true,
  "ageTier": "TEEN",
  "parentalConsent": true,
  "restrictions": {
    "canChat": false,
    "canCreateReels": true,
    "canComment": true,
    "canFollow": true
  }
}
```

---

## 🛡️ Middleware

### requireAgeVerification
```typescript
export const requireAgeVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userId = req.userId; // From auth middleware
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ageVerifiedAt: true,
      ageTier: true,
      parentalConsent: true,
    },
  });
  
  // Not verified
  if (!user?.ageVerifiedAt) {
    return res.status(403).json({
      status: 'ERROR',
      code: 'AGE_NOT_VERIFIED',
      message: 'Age verification required',
    });
  }
  
  // Blocked tier
  if (user.ageTier === 'BLOCKED') {
    return res.status(403).json({
      status: 'ERROR',
      code: 'AGE_RESTRICTED',
      message: 'Access denied for users under 13',
    });
  }
  
  // Teen without parental consent
  if (user.ageTier === 'TEEN' && !user.parentalConsent) {
    return res.status(403).json({
      status: 'ERROR',
      code: 'PARENTAL_CONSENT_REQUIRED',
      message: 'Parental consent required',
    });
  }
  
  next();
};
```

### requireAdultTier
```typescript
export const requireAdultTier = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userId = req.userId;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ageTier: true },
  });
  
  if (user?.ageTier !== 'ADULT') {
    return res.status(403).json({
      status: 'ERROR',
      code: 'ADULT_ONLY',
      message: 'This feature is only available for users 18+',
    });
  }
  
  next();
};
```

---

## 🚀 Implementation Plan

### Phase 1: Database Schema ✅
1. Add age verification fields to User model
2. Create ParentalConsentRequest model
3. Create migration
4. Run migration

### Phase 2: Backend APIs ✅
1. Create age verification controller
2. Create parental consent controller
3. Add middleware (requireAgeVerification, requireAdultTier)
4. Add routes
5. Add email templates

### Phase 3: Frontend Screens ✅
1. Create AgeGateScreen
2. Create ParentalConsentScreen
3. Create WaitingForConsentScreen
4. Create BlockedScreen
5. Add navigation logic

### Phase 4: Integration ✅
1. Add age gate to app startup
2. Update existing user flow
3. Add content restrictions
4. Test all flows

### Phase 5: Testing & Compliance ✅
1. Test all age tiers
2. Test parental consent flow
3. Verify COPPA compliance
4. Legal review
5. Apple App Store review

---

## 📊 Success Criteria

- [ ] Age gate appears before any content
- [ ] Under 13 users are blocked
- [ ] 13-17 users require parental consent
- [ ] 18+ users have full access
- [ ] Parental consent email works
- [ ] Content restrictions enforced
- [ ] Cannot bypass age gate
- [ ] Existing users prompted for age
- [ ] COPPA compliant
- [ ] Apple App Store approved

---

## ⚠️ Risks & Mitigation

### Risk 1: Users lie about age
**Mitigation**: 
- One-time verification (cannot change)
- Audit log for age changes
- Report suspicious accounts

### Risk 2: Parent email not received
**Mitigation**:
- Resend option
- Change email option
- Support contact

### Risk 3: Existing users bypass
**Mitigation**:
- Force age verification on next login
- Block API access until verified
- Clear messaging

### Risk 4: Legal compliance gaps
**Mitigation**:
- Legal review before launch
- Regular compliance audits
- Update as laws change

---

**Analysis by**: Kiro AI Assistant  
**Date**: March 30, 2026  
**Status**: Ready for Implementation
