-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "communitySafetyFlag" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "communityNsfwAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "communityReportHits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "communitySafetyFlagAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_communitySafetyFlag_idx" ON "users"("communitySafetyFlag");
