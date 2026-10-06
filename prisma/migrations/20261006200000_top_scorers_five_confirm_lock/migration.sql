-- A confirmed pick is final for its gameweek. Existing rows stay unconfirmed,
-- so picks made before this rule can still be confirmed (or changed) once.
ALTER TABLE "top_scorers_five_selections" ADD COLUMN "confirmedAt" TIMESTAMP(3);

-- How the player took part in the fixture, read from the final lineups.
ALTER TABLE "top_scorers_five_performances" ADD COLUMN "participation" TEXT;
