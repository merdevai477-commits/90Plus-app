-- CreateIndex
CREATE INDEX "cached_teams_name_idx" ON "cached_teams"("name");

-- CreateIndex
CREATE INDEX "cached_teams_updatedAt_idx" ON "cached_teams"("updatedAt");

-- CreateIndex
CREATE INDEX "predictions_isCorrect_idx" ON "predictions"("isCorrect");

-- CreateIndex
CREATE INDEX "predictions_userId_isCorrect_idx" ON "predictions"("userId", "isCorrect");

-- CreateIndex
CREATE INDEX "reels_sharesCount_idx" ON "reels"("sharesCount");

-- CreateIndex
CREATE INDEX "reels_createdAt_views_idx" ON "reels"("createdAt", "views");

-- CreateIndex
CREATE INDEX "reels_createdAt_sharesCount_idx" ON "reels"("createdAt", "sharesCount");
