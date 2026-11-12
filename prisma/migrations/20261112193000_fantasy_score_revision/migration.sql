-- Nullable revision columns. Existing performance rows are not rewritten.
ALTER TABLE "top_scorers_five_fixtures" ADD COLUMN "sourceHash" TEXT;
ALTER TABLE "top_scorers_five_fixtures" ADD COLUMN "revisedAt" TIMESTAMP(3);

ALTER TABLE "coach_king_fixtures" ADD COLUMN "sourceHash" TEXT;
ALTER TABLE "coach_king_fixtures" ADD COLUMN "revisedAt" TIMESTAMP(3);

CREATE INDEX "top_scorers_five_performances_playerId_fixtureDate_idx" ON "top_scorers_five_performances"("playerId", "fixtureDate");
CREATE INDEX "top_scorers_five_squad_members_playerId_selectedAt_idx" ON "top_scorers_five_squad_members"("playerId", "selectedAt");
