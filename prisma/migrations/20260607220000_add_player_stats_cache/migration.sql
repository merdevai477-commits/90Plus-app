-- CreateTable
CREATE TABLE "player_stats_cache" (
    "id" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerAliases" TEXT[],
    "apiPlayerId" INTEGER,
    "competition" TEXT,
    "season" TEXT NOT NULL,
    "statType" TEXT NOT NULL,
    "statValue" JSONB NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "questionAsked" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_stats_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_name_mapping" (
    "id" TEXT NOT NULL,
    "arabicName" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "aliases" TEXT[],
    "apiPlayerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_name_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_stats_cache_playerName_idx" ON "player_stats_cache"("playerName");

-- CreateIndex
CREATE INDEX "player_stats_cache_expiresAt_idx" ON "player_stats_cache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "player_name_mapping_apiPlayerId_key" ON "player_name_mapping"("apiPlayerId");

-- CreateIndex
CREATE INDEX "player_name_mapping_arabicName_idx" ON "player_name_mapping"("arabicName");

-- CreateIndex
CREATE INDEX "player_name_mapping_englishName_idx" ON "player_name_mapping"("englishName");
