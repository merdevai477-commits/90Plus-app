-- Unified notification platform: new NotificationType enum values + new
-- NotificationPreferences toggles for the 15-scenario rollout.
--
-- Each `ALTER TYPE ... ADD VALUE` runs in its own implicit transaction because
-- Postgres does not allow enum values to be added inside a transaction block
-- with other DDL. The IF NOT EXISTS guard makes the migration idempotent in
-- staging and prod.

-- 1. NotificationType enum: net-new values.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPORT_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LUCKY_WHEEL_RENEWED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEADERBOARD_TOP3';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AVATAR_UPLOAD';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AI_CHECKIN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COOLDOWN_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DAILY_QUIZ_RENEWED';

-- 2. NotificationPreferences: new per-category toggles.
--    Defaults match the Prisma schema so backfill is automatic on insert.
ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "matchCards"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "matchSubs"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "matchVar"       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "matchLineups"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "socialShare"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "dailyQuiz"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cooldown"       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "levelUp"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "reportUpdates"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "avatarUpload"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "videoProcessed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "leaderboard"    BOOLEAN NOT NULL DEFAULT true,
  -- Opt-in by design (avoids surprise AI pushes).
  ADD COLUMN IF NOT EXISTS "aiCoach"        BOOLEAN NOT NULL DEFAULT false;
