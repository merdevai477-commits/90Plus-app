-- GDPR Compliance Migration
-- Adds data export, account deletion, and consent management tables
-- Date: 2026-03-30

-- Data Export Requests
CREATE TABLE "DataExportRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
  "fileUrl" TEXT,
  "fileSize" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedReason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  
  CONSTRAINT "DataExportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DataExportRequest_userId_idx" ON "DataExportRequest"("userId");
CREATE INDEX "DataExportRequest_status_idx" ON "DataExportRequest"("status");
CREATE INDEX "DataExportRequest_requestedAt_idx" ON "DataExportRequest"("requestedAt");

-- Account Deletion Requests
CREATE TABLE "AccountDeletionRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SCHEDULED, COMPLETED, CANCELLED
  "reason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledAt" TIMESTAMP(3), -- 30 days from request
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  
  CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AccountDeletionRequest_userId_idx" ON "AccountDeletionRequest"("userId");
CREATE INDEX "AccountDeletionRequest_status_idx" ON "AccountDeletionRequest"("status");
CREATE INDEX "AccountDeletionRequest_scheduledAt_idx" ON "AccountDeletionRequest"("scheduledAt");

-- Consent Management
CREATE TABLE "ConsentLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "consentType" TEXT NOT NULL, -- ANALYTICS, PUSH_NOTIFICATIONS, EMAIL_COMMUNICATIONS, DATA_SHARING
  "granted" BOOLEAN NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "version" TEXT, -- Privacy policy version
  
  CONSTRAINT "ConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ConsentLog_userId_idx" ON "ConsentLog"("userId");
CREATE INDEX "ConsentLog_consentType_idx" ON "ConsentLog"("consentType");
CREATE INDEX "ConsentLog_timestamp_idx" ON "ConsentLog"("timestamp");

-- Add consent fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "analyticsConsent" BOOLEAN DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pushNotificationsConsent" BOOLEAN DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailCommunicationsConsent" BOOLEAN DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dataSharingConsent" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyPolicyVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyPolicyAcceptedAt" TIMESTAMP(3);

-- Add deletion tracking to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionScheduledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Audit log for GDPR actions
CREATE TABLE "GDPRAuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL, -- DATA_EXPORT, ACCOUNT_DELETION, CONSENT_CHANGE, DATA_ACCESS
  "details" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "GDPRAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GDPRAuditLog_userId_idx" ON "GDPRAuditLog"("userId");
CREATE INDEX "GDPRAuditLog_action_idx" ON "GDPRAuditLog"("action");
CREATE INDEX "GDPRAuditLog_timestamp_idx" ON "GDPRAuditLog"("timestamp");

-- Comments
COMMENT ON TABLE "DataExportRequest" IS 'GDPR Article 20: Right to data portability';
COMMENT ON TABLE "AccountDeletionRequest" IS 'GDPR Article 17: Right to erasure (right to be forgotten)';
COMMENT ON TABLE "ConsentLog" IS 'GDPR Article 7: Conditions for consent';
COMMENT ON TABLE "GDPRAuditLog" IS 'GDPR Article 30: Records of processing activities';
