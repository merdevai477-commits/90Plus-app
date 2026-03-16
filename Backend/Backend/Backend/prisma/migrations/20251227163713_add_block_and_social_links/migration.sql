-- AlterTable
ALTER TABLE "users" ADD COLUMN     "socialLinks" JSONB DEFAULT '[]';

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_votes" (
    "id" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthYear" TEXT,

    CONSTRAINT "ranking_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_of_month_streaks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consecutiveMonths" INTEGER NOT NULL DEFAULT 0,
    "lastMonthYear" TEXT,
    "diamondAwarded" BOOLEAN NOT NULL DEFAULT false,
    "diamondAwardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_of_month_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_searches" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "queryType" TEXT NOT NULL DEFAULT 'general',
    "teams" JSONB,
    "players" JSONB,
    "leagues" JSONB,
    "matches" JSONB,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "searchCount" INTEGER NOT NULL DEFAULT 1,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "popular_searches" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 1,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "popular_searches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blocks_blockerId_idx" ON "blocks"("blockerId");

-- CreateIndex
CREATE INDEX "blocks_blockedId_idx" ON "blocks"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blockerId_blockedId_key" ON "blocks"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "player_votes_voterId_idx" ON "player_votes"("voterId");

-- CreateIndex
CREATE INDEX "player_votes_playerId_idx" ON "player_votes"("playerId");

-- CreateIndex
CREATE INDEX "player_votes_voteType_idx" ON "player_votes"("voteType");

-- CreateIndex
CREATE UNIQUE INDEX "player_votes_voterId_playerId_key" ON "player_votes"("voterId", "playerId");

-- CreateIndex
CREATE INDEX "ranking_badges_userId_idx" ON "ranking_badges"("userId");

-- CreateIndex
CREATE INDEX "ranking_badges_badgeType_idx" ON "ranking_badges"("badgeType");

-- CreateIndex
CREATE INDEX "ranking_badges_category_idx" ON "ranking_badges"("category");

-- CreateIndex
CREATE INDEX "ranking_badges_earnedAt_idx" ON "ranking_badges"("earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "team_of_month_streaks_userId_key" ON "team_of_month_streaks"("userId");

-- CreateIndex
CREATE INDEX "team_of_month_streaks_userId_idx" ON "team_of_month_streaks"("userId");

-- CreateIndex
CREATE INDEX "team_of_month_streaks_consecutiveMonths_idx" ON "team_of_month_streaks"("consecutiveMonths");

-- CreateIndex
CREATE UNIQUE INDEX "cached_searches_query_key" ON "cached_searches"("query");

-- CreateIndex
CREATE INDEX "cached_searches_query_idx" ON "cached_searches"("query");

-- CreateIndex
CREATE INDEX "cached_searches_queryType_idx" ON "cached_searches"("queryType");

-- CreateIndex
CREATE INDEX "cached_searches_searchCount_idx" ON "cached_searches"("searchCount");

-- CreateIndex
CREATE INDEX "cached_searches_lastSearchedAt_idx" ON "cached_searches"("lastSearchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "popular_searches_query_key" ON "popular_searches"("query");

-- CreateIndex
CREATE INDEX "popular_searches_searchCount_idx" ON "popular_searches"("searchCount");

-- CreateIndex
CREATE INDEX "popular_searches_lastSearchedAt_idx" ON "popular_searches"("lastSearchedAt");

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
