-- CreateIndex
CREATE INDEX "favorite_matches_notifiedEnd_matchDate_idx" ON "favorite_matches"("notifiedEnd", "matchDate");

-- CreateIndex
CREATE INDEX "predictions_userId_createdAt_idx" ON "predictions"("userId", "createdAt");

