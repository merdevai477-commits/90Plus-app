-- Remove default values from profile fields
ALTER TABLE "users" ALTER COLUMN "position" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "countryFlag" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "age" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "height" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "weight" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "preferredFoot" DROP DEFAULT;

-- Add location field if not exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location" TEXT;

-- Add profile completion tracking fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profileCompletionSteps" JSONB DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profileCompletionPercentage" INTEGER DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firstVideoUploaded" BOOLEAN DEFAULT false;

-- Update existing users to have 0% completion (they need to complete profile)
UPDATE "users" SET "profileCompletionPercentage" = 0 WHERE "profileCompletionPercentage" IS NULL;
