-- Migration: add_orphaned_uploads
-- Adds orphaned_uploads table for tracking failed R2 uploads

CREATE TABLE IF NOT EXISTS "orphaned_uploads" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "storagePath" TEXT NOT NULL,
    "bucket"      TEXT NOT NULL,
    "error"       TEXT NOT NULL,
    "resolved"    BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orphaned_uploads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "orphaned_uploads_resolved_idx" ON "orphaned_uploads"("resolved");
CREATE INDEX IF NOT EXISTS "orphaned_uploads_createdAt_idx" ON "orphaned_uploads"("createdAt");
