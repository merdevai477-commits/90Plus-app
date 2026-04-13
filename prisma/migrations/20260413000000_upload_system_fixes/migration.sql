-- Migration: upload_system_fixes
-- Fix 1: Add ReelStatus enum + new Reel fields (processedVideoUrl, processedVideoKey, status)
-- Fix 2: Add R2OrphanTracker model
-- Fix 7: Add storageUsedBytes + storageQuotaBytes to User
-- Fix 12: Add UploadEvent model

-- ─── ReelStatus enum ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ReelStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── Reel: new columns ────────────────────────────────────────────────────────
ALTER TABLE "reels"
  ADD COLUMN IF NOT EXISTS "processedVideoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "processedVideoKey" TEXT,
  ADD COLUMN IF NOT EXISTS "fileSizeBytes"     BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "status" "ReelStatus" NOT NULL DEFAULT 'PROCESSING';

-- Back-fill existing reels as READY (they were already live)
UPDATE "reels" SET "status" = 'READY' WHERE "status" = 'PROCESSING';

-- ─── User: storage quota ──────────────────────────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "storageUsedBytes"  BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "storageQuotaBytes" BIGINT NOT NULL DEFAULT 5368709120;

-- ─── R2OrphanTracker ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "r2_orphan_tracker" (
  "id"            TEXT NOT NULL,
  "storagePath"   TEXT NOT NULL,
  "bucket"        TEXT NOT NULL,
  "fileSizeBytes" BIGINT NOT NULL DEFAULT 0,
  "uploadedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved"      BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt"    TIMESTAMP(3),

  CONSTRAINT "r2_orphan_tracker_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "r2_orphan_tracker_storagePath_key"
  ON "r2_orphan_tracker"("storagePath");

CREATE INDEX IF NOT EXISTS "r2_orphan_tracker_resolved_idx"
  ON "r2_orphan_tracker"("resolved");

CREATE INDEX IF NOT EXISTS "r2_orphan_tracker_uploadedAt_idx"
  ON "r2_orphan_tracker"("uploadedAt");

-- ─── UploadEventType enum ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "UploadEventType" AS ENUM ('AVATAR', 'COVER', 'REEL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── UploadEventStatus enum ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "UploadEventStatus" AS ENUM ('SUCCESS', 'FAILED', 'TIMEOUT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── UploadEvent ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "upload_events" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "type"        "UploadEventType" NOT NULL,
  "status"      "UploadEventStatus" NOT NULL,
  "fileSizeMB"  DOUBLE PRECISION NOT NULL,
  "durationMs"  INTEGER NOT NULL,
  "errorCode"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "upload_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "upload_events_userId_idx"   ON "upload_events"("userId");
CREATE INDEX IF NOT EXISTS "upload_events_type_idx"     ON "upload_events"("type");
CREATE INDEX IF NOT EXISTS "upload_events_status_idx"   ON "upload_events"("status");
CREATE INDEX IF NOT EXISTS "upload_events_createdAt_idx" ON "upload_events"("createdAt");
