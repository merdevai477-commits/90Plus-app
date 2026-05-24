-- 1. Add Reel.publishedAt (nullable; set when a reel becomes READY via webhook/heal)
ALTER TABLE "reels" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- 2. Index for feed ordering (publishedAt DESC NULLS LAST + createdAt DESC fallback)
CREATE INDEX IF NOT EXISTS "reels_publishedAt_idx" ON "reels"("publishedAt");

-- 3. Backfill publishedAt for existing READY reels so the feed keeps a sensible
--    order until the next webhook/heal updates the value. We pick the original
--    createdAt so legacy reels are not artificially promoted.
UPDATE "reels"
SET "publishedAt" = "createdAt"
WHERE "publishedAt" IS NULL AND "status" = 'READY';

-- 4. Expand NotificationType enum to match the TypeScript NotificationType in
--    src/services/notification.service.ts. Missing values currently cause
--    `prisma.notification.create()` to fail (e.g. VIDEO_PROCESSED).
--    Postgres requires each ADD VALUE to be its own statement and cannot run
--    inside a transaction block, hence the IF NOT EXISTS guards.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MATCH_GOAL';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MATCH_START';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MATCH_END';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MATCH_HALFTIME';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MATCH_YELLOW_CARD';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MATCH_RED_CARD';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PREDICTION_RESULT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FOLLOW_ACTIVITY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMENT_LIKE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GIFT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SHARE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VIDEO_PROCESSED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPORT_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MILESTONE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COIN_MILESTONE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LUCKY_WHEEL';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEADERBOARD_TOP10';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RE_ENGAGEMENT';
