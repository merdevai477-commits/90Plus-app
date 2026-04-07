-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MATCH_FAVORITE';
ALTER TYPE "NotificationType" ADD VALUE 'REPLY';
ALTER TYPE "NotificationType" ADD VALUE 'MENTION';

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "brandLogo" TEXT,
ADD COLUMN     "clubLogo" TEXT,
ADD COLUMN     "expoPushToken" TEXT,
ADD COLUMN     "lastDailySpin" TIMESTAMP(3),
ADD COLUMN     "reelDeleteCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "favorite_matches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiMatchId" INTEGER NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeTeamLogo" TEXT,
    "awayTeamLogo" TEXT,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "leagueName" TEXT,
    "lastHomeScore" INTEGER,
    "lastAwayScore" INTEGER,
    "lastStatus" TEXT,
    "notifiedStart" BOOLEAN NOT NULL DEFAULT false,
    "notifiedEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "favorite_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_spin_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coinsWon" INTEGER NOT NULL,
    "spinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_spin_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_fixtures" (
    "id" TEXT NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "leagueName" TEXT NOT NULL,
    "leagueLogo" TEXT,
    "leagueCountry" TEXT,
    "leagueSeason" INTEGER,
    "leagueRound" TEXT,
    "homeTeamId" INTEGER NOT NULL,
    "homeTeamName" TEXT NOT NULL,
    "homeTeamLogo" TEXT,
    "awayTeamId" INTEGER NOT NULL,
    "awayTeamName" TEXT NOT NULL,
    "awayTeamLogo" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "homeHalftimeScore" INTEGER,
    "awayHalftimeScore" INTEGER,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "matchTimestamp" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "statusLong" TEXT,
    "venue" TEXT,
    "referee" TEXT,
    "fullData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_players" (
    "id" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "firstname" TEXT,
    "lastname" TEXT,
    "photo" TEXT,
    "nationality" TEXT,
    "nationalityFlag" TEXT,
    "age" INTEGER,
    "birthDate" TEXT,
    "birthPlace" TEXT,
    "birthCountry" TEXT,
    "height" TEXT,
    "weight" TEXT,
    "teamId" INTEGER,
    "teamName" TEXT,
    "teamLogo" TEXT,
    "position" TEXT,
    "seasonStats" JSONB,
    "fullData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_teams" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "logo" TEXT,
    "country" TEXT,
    "founded" INTEGER,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "venueCity" TEXT,
    "venueCapacity" INTEGER,
    "venueImage" TEXT,
    "fullData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_h2h" (
    "id" TEXT NOT NULL,
    "team1Id" INTEGER NOT NULL,
    "team2Id" INTEGER NOT NULL,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "team1Wins" INTEGER NOT NULL DEFAULT 0,
    "team2Wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "lastMatches" JSONB NOT NULL,
    "fullData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_h2h_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_leagues" (
    "id" TEXT NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "logo" TEXT,
    "type" TEXT DEFAULT 'league',
    "fullData" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_leagues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorite_matches_userId_idx" ON "favorite_matches"("userId");

-- CreateIndex
CREATE INDEX "favorite_matches_apiMatchId_idx" ON "favorite_matches"("apiMatchId");

-- CreateIndex
CREATE INDEX "favorite_matches_matchDate_idx" ON "favorite_matches"("matchDate");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_matches_userId_apiMatchId_key" ON "favorite_matches"("userId", "apiMatchId");

-- CreateIndex
CREATE INDEX "daily_spin_history_userId_idx" ON "daily_spin_history"("userId");

-- CreateIndex
CREATE INDEX "daily_spin_history_spinDate_idx" ON "daily_spin_history"("spinDate");

-- CreateIndex
CREATE UNIQUE INDEX "cached_fixtures_fixtureId_key" ON "cached_fixtures"("fixtureId");

-- CreateIndex
CREATE INDEX "cached_fixtures_matchDate_idx" ON "cached_fixtures"("matchDate");

-- CreateIndex
CREATE INDEX "cached_fixtures_matchTimestamp_idx" ON "cached_fixtures"("matchTimestamp");

-- CreateIndex
CREATE INDEX "cached_fixtures_leagueId_idx" ON "cached_fixtures"("leagueId");

-- CreateIndex
CREATE INDEX "cached_fixtures_status_idx" ON "cached_fixtures"("status");

-- CreateIndex
CREATE INDEX "cached_fixtures_homeTeamId_idx" ON "cached_fixtures"("homeTeamId");

-- CreateIndex
CREATE INDEX "cached_fixtures_awayTeamId_idx" ON "cached_fixtures"("awayTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "cached_players_playerId_key" ON "cached_players"("playerId");

-- CreateIndex
CREATE INDEX "cached_players_teamId_idx" ON "cached_players"("teamId");

-- CreateIndex
CREATE INDEX "cached_players_nationality_idx" ON "cached_players"("nationality");

-- CreateIndex
CREATE INDEX "cached_players_position_idx" ON "cached_players"("position");

-- CreateIndex
CREATE UNIQUE INDEX "cached_teams_teamId_key" ON "cached_teams"("teamId");

-- CreateIndex
CREATE INDEX "cached_teams_country_idx" ON "cached_teams"("country");

-- CreateIndex
CREATE INDEX "cached_h2h_team1Id_idx" ON "cached_h2h"("team1Id");

-- CreateIndex
CREATE INDEX "cached_h2h_team2Id_idx" ON "cached_h2h"("team2Id");

-- CreateIndex
CREATE UNIQUE INDEX "cached_h2h_team1Id_team2Id_key" ON "cached_h2h"("team1Id", "team2Id");

-- CreateIndex
CREATE UNIQUE INDEX "cached_leagues_leagueId_key" ON "cached_leagues"("leagueId");

-- CreateIndex
CREATE INDEX "cached_leagues_name_idx" ON "cached_leagues"("name");

-- CreateIndex
CREATE INDEX "cached_leagues_country_idx" ON "cached_leagues"("country");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "follows_createdAt_idx" ON "follows"("createdAt");

-- CreateIndex
CREATE INDEX "follows_followingId_createdAt_idx" ON "follows"("followingId", "createdAt");

-- CreateIndex
CREATE INDEX "likes_createdAt_idx" ON "likes"("createdAt");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_matches" ADD CONSTRAINT "favorite_matches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_spin_history" ADD CONSTRAINT "daily_spin_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
