-- Top Scorers Five: lineups carry into each new gameweek. Stamped once the copy
-- has run so it happens once per gameweek. Additive only, safe to re-run.

ALTER TABLE "top_scorers_five_gameweeks" ADD COLUMN IF NOT EXISTS "lineupCarriedAt" TIMESTAMP(3);
