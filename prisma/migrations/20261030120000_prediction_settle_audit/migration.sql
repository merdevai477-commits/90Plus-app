-- Additive audit columns for King prediction settlement (P0).
-- Nullable only; no backfill.

ALTER TABLE "predictions"
  ADD COLUMN IF NOT EXISTS "settledHomeScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "settledAwayScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "settledStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "settledWinner" TEXT,
  ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);
