-- ============================================
-- Age Verification System Migration
-- COPPA Compliance
-- Date: 2026-03-30
-- ============================================

-- Add Age Verification fields to User table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ageVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ageTier" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentalConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentEmail" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentalConsentRequestedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentalConsentConfirmedAt" TIMESTAMP(3);

-- Create AgeTier enum
DO $$ BEGIN
  CREATE TYPE "AgeTier" AS ENUM ('BLOCKED', 'TEEN', 'ADULT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create ConsentStatus enum
DO $$ BEGIN
  CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update ageTier column to use enum
ALTER TABLE "users" ALTER COLUMN "ageTier" TYPE "AgeTier" USING "ageTier"::"AgeTier";

-- Create ParentalConsentRequest table
CREATE TABLE IF NOT EXISTS "parental_consent_requests" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "parentEmail" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "parental_consent_requests_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for ParentalConsentRequest
CREATE INDEX IF NOT EXISTS "parental_consent_requests_userId_idx" ON "parental_consent_requests"("userId");
CREATE INDEX IF NOT EXISTS "parental_consent_requests_token_idx" ON "parental_consent_requests"("token");
CREATE INDEX IF NOT EXISTS "parental_consent_requests_status_idx" ON "parental_consent_requests"("status");
CREATE INDEX IF NOT EXISTS "parental_consent_requests_expiresAt_idx" ON "parental_consent_requests"("expiresAt");
CREATE INDEX IF NOT EXISTS "parental_consent_requests_parentEmail_idx" ON "parental_consent_requests"("parentEmail");

-- Create indexes for User age verification fields
CREATE INDEX IF NOT EXISTS "users_ageVerifiedAt_idx" ON "users"("ageVerifiedAt");
CREATE INDEX IF NOT EXISTS "users_ageTier_idx" ON "users"("ageTier");
CREATE INDEX IF NOT EXISTS "users_parentalConsent_idx" ON "users"("parentalConsent");

-- Add comments for documentation
COMMENT ON COLUMN "users"."dateOfBirth" IS 'User date of birth for age verification (COPPA compliance)';
COMMENT ON COLUMN "users"."ageVerifiedAt" IS 'Timestamp when age was verified';
COMMENT ON COLUMN "users"."ageTier" IS 'Age tier: BLOCKED (<13), TEEN (13-17), ADULT (18+)';
COMMENT ON COLUMN "users"."parentalConsent" IS 'Whether parental consent was obtained (for TEEN tier)';
COMMENT ON COLUMN "users"."parentEmail" IS 'Parent email for consent verification';

COMMENT ON TABLE "parental_consent_requests" IS 'Tracks parental consent requests for users aged 13-17 (COPPA compliance)';
