-- Calendar + live minute: elapsed column and composite index for date queries
ALTER TABLE "cached_fixtures" ADD COLUMN IF NOT EXISTS "elapsed" INTEGER;

CREATE INDEX IF NOT EXISTS "cached_fixtures_matchDate_status_idx"
  ON "cached_fixtures"("matchDate", "status");
