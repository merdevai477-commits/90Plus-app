-- CreateTable
CREATE TABLE IF NOT EXISTS "cached_transfers" (
    "id" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerPhoto" TEXT,
    "teamInId" INTEGER,
    "teamInName" TEXT,
    "teamInLogo" TEXT,
    "teamOutId" INTEGER,
    "teamOutName" TEXT,
    "teamOutLogo" TEXT,
    "transferType" TEXT,
    "transferDate" TEXT NOT NULL,
    "transferValue" DOUBLE PRECISION,
    "leagueId" INTEGER,
    "leagueName" TEXT,
    "leagueLogo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cached_transfers_playerId_idx" ON "cached_transfers"("playerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cached_transfers_teamInId_idx" ON "cached_transfers"("teamInId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cached_transfers_teamOutId_idx" ON "cached_transfers"("teamOutId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cached_transfers_leagueId_idx" ON "cached_transfers"("leagueId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cached_transfers_transferDate_idx" ON "cached_transfers"("transferDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cached_transfers_transferType_idx" ON "cached_transfers"("transferType");

