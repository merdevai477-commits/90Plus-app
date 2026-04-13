-- Migration: add_mux_fields
-- Adds Mux Video integration fields to the Reel model.
-- Existing reels keep their R2 fields (videoStoragePath, processedVideoUrl, etc.)
-- New reels use muxUploadId → muxAssetId → muxPlaybackId flow.

ALTER TABLE "reels"
  ADD COLUMN IF NOT EXISTS "muxUploadId"   TEXT,
  ADD COLUMN IF NOT EXISTS "muxAssetId"    TEXT,
  ADD COLUMN IF NOT EXISTS "muxPlaybackId" TEXT;

-- Index for webhook lookup by upload ID (most common lookup path)
CREATE INDEX IF NOT EXISTS "reels_muxUploadId_idx"   ON "reels"("muxUploadId");
CREATE INDEX IF NOT EXISTS "reels_muxAssetId_idx"    ON "reels"("muxAssetId");
CREATE INDEX IF NOT EXISTS "reels_muxPlaybackId_idx" ON "reels"("muxPlaybackId");
