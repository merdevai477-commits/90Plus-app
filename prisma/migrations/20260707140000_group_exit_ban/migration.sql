-- Track group leave/delete frequency and temporary bans
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "groupExitCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "groupBannedUntil" TIMESTAMP(3);
