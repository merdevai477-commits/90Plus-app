-- Fix SEC-3: Add predictedHomeScore and predictedAwayScore to predictions table
-- These replace the incorrect use of homeTeam/awayTeam fields for storing scores

ALTER TABLE "predictions"
  ADD COLUMN IF NOT EXISTS "predictedHomeScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "predictedAwayScore" INTEGER;
