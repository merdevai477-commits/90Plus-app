-- CreateEnum
CREATE TYPE "TopScorersFiveGameweekStatus" AS ENUM ('OPEN', 'LOCKED', 'LIVE', 'CALCULATING', 'COMPLETED');

-- CreateTable
CREATE TABLE "top_scorers_five_players" (
    "id" TEXT NOT NULL,
    "leagueKey" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "clubNameAr" TEXT NOT NULL,
    "clubNameEn" TEXT,
    "teamId" INTEGER,
    "externalPlayerId" INTEGER,
    "photoUrl" TEXT,
    "position" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "resolvedAt" TIMESTAMP(3),
    "resolveNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "top_scorers_five_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "top_scorers_five_gameweeks" (
    "id" TEXT NOT NULL,
    "leagueKey" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "lockAt" TIMESTAMP(3) NOT NULL,
    "status" "TopScorersFiveGameweekStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "top_scorers_five_gameweeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "top_scorers_five_fixtures" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "homeTeamName" TEXT,
    "awayTeamName" TEXT,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NS',
    "processedAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "top_scorers_five_fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "top_scorers_five_selections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "leagueKey" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "top_scorers_five_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "top_scorers_five_performances" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'FINISHED',
    "fixtureDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "top_scorers_five_performances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "top_scorers_five_players_leagueKey_active_sortOrder_idx" ON "top_scorers_five_players"("leagueKey", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "top_scorers_five_players_leagueKey_nameAr_key" ON "top_scorers_five_players"("leagueKey", "nameAr");

-- CreateIndex
CREATE UNIQUE INDEX "top_scorers_five_players_leagueKey_externalPlayerId_key" ON "top_scorers_five_players"("leagueKey", "externalPlayerId");

-- CreateIndex
CREATE INDEX "top_scorers_five_gameweeks_status_endAt_idx" ON "top_scorers_five_gameweeks"("status", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "top_scorers_five_gameweeks_leagueKey_weekKey_key" ON "top_scorers_five_gameweeks"("leagueKey", "weekKey");

-- CreateIndex
CREATE INDEX "top_scorers_five_fixtures_gameweekId_processedAt_idx" ON "top_scorers_five_fixtures"("gameweekId", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "top_scorers_five_fixtures_gameweekId_fixtureId_key" ON "top_scorers_five_fixtures"("gameweekId", "fixtureId");

-- CreateIndex
CREATE INDEX "top_scorers_five_selections_gameweekId_playerId_idx" ON "top_scorers_five_selections"("gameweekId", "playerId");

-- CreateIndex
CREATE INDEX "top_scorers_five_selections_userId_idx" ON "top_scorers_five_selections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "top_scorers_five_selections_userId_gameweekId_leagueKey_key" ON "top_scorers_five_selections"("userId", "gameweekId", "leagueKey");

-- CreateIndex
CREATE INDEX "top_scorers_five_performances_playerId_idx" ON "top_scorers_five_performances"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "top_scorers_five_performances_gameweekId_playerId_fixtureId_key" ON "top_scorers_five_performances"("gameweekId", "playerId", "fixtureId");

-- AddForeignKey
ALTER TABLE "top_scorers_five_fixtures" ADD CONSTRAINT "top_scorers_five_fixtures_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "top_scorers_five_gameweeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_scorers_five_selections" ADD CONSTRAINT "top_scorers_five_selections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_scorers_five_selections" ADD CONSTRAINT "top_scorers_five_selections_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "top_scorers_five_gameweeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_scorers_five_selections" ADD CONSTRAINT "top_scorers_five_selections_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "top_scorers_five_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_scorers_five_performances" ADD CONSTRAINT "top_scorers_five_performances_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "top_scorers_five_gameweeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_scorers_five_performances" ADD CONSTRAINT "top_scorers_five_performances_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "top_scorers_five_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
