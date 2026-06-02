-- Age Verification (COPPA)

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ageVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ageTier" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentalConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentEmail" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentalConsentRequestedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentalConsentConfirmedAt" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "AgeTier" AS ENUM ('BLOCKED', 'TEEN', 'ADULT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "users" ALTER COLUMN "ageTier" TYPE "AgeTier" USING "ageTier"::"AgeTier";

CREATE TABLE IF NOT EXISTS "parental_consent_requests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentEmail" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "parental_consent_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "parental_consent_requests_token_key" ON "parental_consent_requests"("token");

DO $$ BEGIN
  ALTER TABLE "parental_consent_requests"
    ADD CONSTRAINT "parental_consent_requests_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "parental_consent_requests_userId_idx" ON "parental_consent_requests"("userId");
CREATE INDEX IF NOT EXISTS "parental_consent_requests_token_idx" ON "parental_consent_requests"("token");
CREATE INDEX IF NOT EXISTS "parental_consent_requests_status_idx" ON "parental_consent_requests"("status");
CREATE INDEX IF NOT EXISTS "parental_consent_requests_expiresAt_idx" ON "parental_consent_requests"("expiresAt");
CREATE INDEX IF NOT EXISTS "parental_consent_requests_parentEmail_idx" ON "parental_consent_requests"("parentEmail");

CREATE INDEX IF NOT EXISTS "users_ageVerifiedAt_idx" ON "users"("ageVerifiedAt");
CREATE INDEX IF NOT EXISTS "users_ageTier_idx" ON "users"("ageTier");
CREATE INDEX IF NOT EXISTS "users_parentalConsent_idx" ON "users"("parentalConsent");
