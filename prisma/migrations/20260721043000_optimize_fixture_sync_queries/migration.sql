-- Calendar/alignment queries filter by league and season, then scan kickoff order.
CREATE INDEX IF NOT EXISTS "cached_fixtures_leagueId_leagueSeason_matchDate_idx"
ON "cached_fixtures"("leagueId", "leagueSeason", "matchDate");

-- The synthetic-live worker drains least-recently-updated rows first. This
-- non-partial equivalent is also representable in Prisma schema, so Railway's
-- current `prisma db push` path creates the required runtime index.
CREATE INDEX IF NOT EXISTS "cached_fixtures_synthetic_live_queue_idx"
ON "cached_fixtures"("updatedAt", "matchDate");
