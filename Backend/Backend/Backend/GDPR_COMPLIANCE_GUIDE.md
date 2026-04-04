# GDPR Compliance System - Complete Guide

## 📋 Overview

This document provides a comprehensive guide to the GDPR compliance system implemented in the 90Plus backend. The system ensures compliance with the General Data Protection Regulation (GDPR) and Apple App Store requirements.

## 🎯 Features Implemented

### 1. Data Export (Article 20: Right to Data Portability)
- Users can request a complete export of their personal data
- Data is compiled into a JSON file and stored in Cloudflare R2
- Export includes: profile, reels, comments, likes, predictions, quiz attempts, transactions, achievements, follows, notifications, consent logs, and audit logs
- Files expire after 7 days for security
- Email notification when export is ready (TODO: implement email service)

### 2. Account Deletion (Article 17: Right to Erasure)
- Users can request account deletion with a 30-day grace period
- Users can cancel deletion during the grace period
- After 30 days, data is anonymized (not deleted) to preserve statistics
- Anonymization process:
  - Personal information replaced with anonymous identifiers
  - Content marked as deleted but kept for legal/moderation purposes
  - Statistical data preserved for analytics
  - Audit logs retained for 7 years (legal requirement)

### 3. Consent Management (Article 7: Conditions for Consent)
- Four consent types:
  - Analytics tracking
  - Push notifications
  - Email communications
  - Data sharing
- Users can grant/revoke consent at any time
- All consent changes are logged with timestamp and IP address
- Consent logs retained for legal compliance

### 4. GDPR Audit Logging
- All GDPR-related actions are logged:
  - Data export requests
  - Account deletion requests
  - Consent changes
  - Data access requests
- Logs include: user ID, action, details, IP address, user agent, timestamp
- Logs retained for legal compliance

## 🗄️ Database Schema

### DataExportRequest
```prisma
model DataExportRequest {
  id           String   @id @default(uuid())
  userId       String
  status       String   // PENDING, PROCESSING, COMPLETED, FAILED
  fileUrl      String?
  fileSize     Int?
  expiresAt    DateTime?
  requestedAt  DateTime @default(now())
  completedAt  DateTime?
  failedReason String?
  ipAddress    String?
  userAgent    String?
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### AccountDeletionRequest
```prisma
model AccountDeletionRequest {
  id                  String   @id @default(uuid())
  userId              String
  status              String   // PENDING, SCHEDULED, COMPLETED, CANCELLED
  reason              String?
  requestedAt         DateTime @default(now())
  scheduledAt         DateTime?
  completedAt         DateTime?
  cancelledAt         DateTime?
  cancellationReason  String?
  ipAddress           String?
  userAgent           String?
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### ConsentLog
```prisma
model ConsentLog {
  id          String   @id @default(uuid())
  userId      String
  consentType String   // ANALYTICS, PUSH_NOTIFICATIONS, EMAIL_COMMUNICATIONS, DATA_SHARING
  granted     Boolean
  timestamp   DateTime @default(now())
  version     String   // Privacy policy version
  ipAddress   String?
  userAgent   String?
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### GDPRAuditLog
```prisma
model GDPRAuditLog {
  id        String   @id @default(uuid())
  userId    String
  action    String   // DATA_EXPORT, ACCOUNT_DELETION, CONSENT_CHANGE, DATA_ACCESS
  details   String
  timestamp DateTime @default(now())
  ipAddress String?
  userAgent String?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## 🔌 API Endpoints

### Consent Management

#### GET /api/gdpr/consent
Get user's current consent preferences.

**Authentication:** Required

**Response:**
```json
{
  "status": "SUCCESS",
  "consent": {
    "analytics": true,
    "pushNotifications": true,
    "emailCommunications": false,
    "dataSharing": false
  },
  "privacyPolicy": {
    "version": "1.0",
    "acceptedAt": "2026-03-31T10:00:00.000Z"
  }
}
```

#### POST /api/gdpr/consent
Update consent preference.

**Authentication:** Required

**Request Body:**
```json
{
  "consentType": "ANALYTICS",
  "granted": true
}
```

**Consent Types:**
- `ANALYTICS` - Analytics tracking
- `PUSH_NOTIFICATIONS` - Push notifications
- `EMAIL_COMMUNICATIONS` - Email communications
- `DATA_SHARING` - Data sharing with third parties

**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Consent updated successfully"
}
```

### Data Export

#### POST /api/gdpr/export-data
Request a data export.

**Authentication:** Required

**Rate Limit:** 3 requests per 24 hours

**Response:**
```json
{
  "status": "SUCCESS",
  "requestId": "uuid",
  "message": "Data export request created. You will receive an email when ready.",
  "estimatedTime": "5-10 minutes"
}
```

#### GET /api/gdpr/export-status/:requestId
Check export status.

**Authentication:** Required

**Response:**
```json
{
  "status": "SUCCESS",
  "exportRequest": {
    "id": "uuid",
    "status": "COMPLETED",
    "fileUrl": "https://exports.90plus.app/exports/uuid.json",
    "fileSize": 1024000,
    "expiresAt": "2026-04-07T10:00:00.000Z",
    "requestedAt": "2026-03-31T10:00:00.000Z",
    "completedAt": "2026-03-31T10:05:00.000Z"
  }
}
```

**Status Values:**
- `PENDING` - Request received, waiting to process
- `PROCESSING` - Currently collecting data
- `COMPLETED` - Export ready for download
- `FAILED` - Export failed (see failedReason)

### Account Deletion

#### POST /api/gdpr/delete-account
Request account deletion.

**Authentication:** Required

**Rate Limit:** 5 requests per 24 hours

**Request Body:**
```json
{
  "reason": "Optional reason for deletion"
}
```

**Response:**
```json
{
  "status": "SUCCESS",
  "requestId": "uuid",
  "scheduledAt": "2026-04-30T10:00:00.000Z",
  "gracePeriodDays": 30,
  "message": "Account deletion scheduled. You have 30 days to cancel."
}
```

#### POST /api/gdpr/cancel-deletion
Cancel account deletion.

**Authentication:** Required

**Request Body:**
```json
{
  "cancellationReason": "Optional reason for cancellation"
}
```

**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Account deletion cancelled successfully"
}
```

#### GET /api/gdpr/deletion-status
Get deletion status.

**Authentication:** Required

**Response:**
```json
{
  "status": "SUCCESS",
  "hasDeletionRequest": true,
  "deletionRequest": {
    "id": "uuid",
    "status": "SCHEDULED",
    "reason": "User requested deletion",
    "requestedAt": "2026-03-31T10:00:00.000Z",
    "scheduledAt": "2026-04-30T10:00:00.000Z"
  }
}
```

**Status Values:**
- `PENDING` - Request received
- `SCHEDULED` - Deletion scheduled (grace period active)
- `COMPLETED` - Account deleted/anonymized
- `CANCELLED` - Deletion cancelled by user

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Cloudflare R2 Storage (for GDPR data exports)
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=90plus-exports
R2_PUBLIC_URL=https://exports.90plus.app
```

### Cloudflare R2 Setup

1. Go to Cloudflare Dashboard > R2
2. Create a new bucket: `90plus-exports`
3. Create API token with R2 permissions
4. Configure lifecycle rules:
   - Delete objects after 7 days
5. (Optional) Set up custom domain for public access

### Cron Jobs

The system automatically sets up cron jobs in `main.ts`:

```typescript
// Check for scheduled deletions (every hour)
cron.schedule('0 * * * *', async () => {
  await processScheduledDeletions();
});

// Cleanup expired export files (daily at 3 AM)
cron.schedule('0 3 * * *', async () => {
  await cleanupOldExports();
});
```

## 🚀 Deployment

### 1. Run Deployment Script

```bash
cd Backend
chmod +x deploy-gdpr.sh
./deploy-gdpr.sh
```

The script will:
- Check environment variables
- Install dependencies
- Run database migrations
- Verify GDPR tables
- Build application
- (Optional) Start server and test endpoints

### 2. Manual Deployment Steps

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build application
npm run build

# Start server
npm start
```

### 3. Verify Deployment

```bash
# Set your test user token
export TEST_USER_TOKEN="your_clerk_token_here"

# Run test suite
npx ts-node test-gdpr-endpoints.ts
```

## 🧪 Testing

### Automated Testing

Run the comprehensive test suite:

```bash
export TEST_USER_TOKEN="your_clerk_token_here"
npx ts-node test-gdpr-endpoints.ts
```

The test suite covers:
- Consent management (get, update, invalid types)
- Data export (request, status, rate limiting)
- Account deletion (request, cancel, status)
- Authentication (unauthorized access)

### Manual Testing with cURL

#### Test Consent Management
```bash
# Get consent
curl -X GET http://localhost:3000/api/gdpr/consent \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update consent
curl -X POST http://localhost:3000/api/gdpr/consent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"consentType":"ANALYTICS","granted":true}'
```

#### Test Data Export
```bash
# Request export
curl -X POST http://localhost:3000/api/gdpr/export-data \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check status
curl -X GET http://localhost:3000/api/gdpr/export-status/REQUEST_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test Account Deletion
```bash
# Request deletion
curl -X POST http://localhost:3000/api/gdpr/delete-account \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Testing"}'

# Cancel deletion
curl -X POST http://localhost:3000/api/gdpr/cancel-deletion \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cancellationReason":"Changed my mind"}'
```

## 📱 Frontend Integration

### Privacy Settings Screen

The frontend includes a complete privacy settings screen at:
- `front/app/(tabs)/privacy-settings.tsx`

Features:
- View collected data categories
- Request data export with progress tracking
- Request account deletion with confirmation
- Cancel scheduled deletion
- Manage consent preferences
- View privacy policy and terms

### React Native Hooks

```typescript
// useDataExport hook
const { requestExport, checkStatus, isLoading, error } = useDataExport();

// useAccountDeletion hook
const { requestDeletion, cancelDeletion, status, isLoading } = useAccountDeletion();

// useConsent hook
const { consent, updateConsent, isLoading } = useConsent();
```

## 🔒 Security Considerations

### Data Protection
- All GDPR endpoints require authentication
- Rate limiting prevents abuse
- IP addresses and user agents logged for audit
- Sensitive data excluded from exports (passwords, tokens)
- Export files expire after 7 days
- Signed URLs for secure file access

### Data Anonymization
- Personal data replaced with anonymous identifiers
- Content marked as deleted but preserved for legal purposes
- Statistical data retained for analytics
- Audit logs retained for 7 years (legal requirement)
- Referential integrity maintained

### Compliance
- GDPR Article 15: Right of access ✅
- GDPR Article 17: Right to erasure ✅
- GDPR Article 20: Right to data portability ✅
- GDPR Article 7: Conditions for consent ✅
- Apple App Store: Account deletion requirement ✅

## 📊 Monitoring

### Metrics to Track
- Data export requests per day
- Export processing time
- Export success/failure rate
- Account deletion requests per day
- Deletion cancellation rate
- Consent changes per day
- Storage usage (R2 bucket)

### Logging
All GDPR operations are logged with:
- User ID
- Action type
- Timestamp
- IP address
- User agent
- Result (success/failure)

Check logs:
```bash
# View GDPR logs
grep "GDPR" logs/app.log

# View anonymization logs
grep "Anonymization" logs/app.log
```

## 🐛 Troubleshooting

### Export Not Processing
1. Check R2 credentials in `.env`
2. Verify R2 bucket exists and is accessible
3. Check server logs for errors
4. Verify cron jobs are running

### Deletion Not Completing
1. Check scheduled deletions cron job
2. Verify database connection
3. Check for foreign key constraints
4. Review anonymization service logs

### Consent Not Updating
1. Verify authentication token
2. Check consent type is valid
3. Review database constraints
4. Check for middleware errors

## 📚 Additional Resources

- [GDPR Official Text](https://gdpr-info.eu/)
- [Apple App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Prisma Documentation](https://www.prisma.io/docs/)

## 🤝 Support

For issues or questions:
1. Check this guide first
2. Review server logs
3. Run test suite to identify issues
4. Check environment variables
5. Verify database migrations

## ✅ Checklist

Before going to production:

- [ ] Environment variables configured
- [ ] Cloudflare R2 bucket created and configured
- [ ] Database migrations run successfully
- [ ] All tests passing
- [ ] Privacy policy updated and accessible
- [ ] Terms of service updated and accessible
- [ ] Email service configured (for notifications)
- [ ] Monitoring and logging set up
- [ ] Cron jobs verified
- [ ] Frontend privacy settings screen tested
- [ ] Apple App Store account deletion URL configured
- [ ] GDPR compliance reviewed by legal team

## 📝 License

This GDPR compliance system is part of the 90Plus application.

---

**Last Updated:** March 31, 2026
**Version:** 1.0.0
**Author:** Kiro AI Assistant
