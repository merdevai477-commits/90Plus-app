-- Add EULA fields to User model
-- Apple Compliance - Guideline 1.2

ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "eulaAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "eulaAcceptedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "eulaVersion" TEXT;

-- Create index for EULA queries
CREATE INDEX IF NOT EXISTS "idx_users_eula_accepted" ON "users"("eulaAccepted");
