-- King of Coaches: 11-player squad, coach, and a 100M wallet.

CREATE TYPE "CoachKingLine" AS ENUM ('GK', 'DEF', 'MID', 'FWD');

CREATE TYPE "CoachKingGameweekStatus" AS ENUM ('OPEN', 'LOCKED', 'LIVE', 'CALCULATING', 'COMPLETED');

CREATE TABLE "coach_king_players" (
    "id" TEXT NOT NULL,
    "leagueKey" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "clubNameAr" TEXT NOT NULL,
    "clubNameEn" TEXT,
    "externalPlayerId" INTEGER NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "photoUrl" TEXT,
    "position" TEXT,
    "line" "CoachKingLine" NOT NULL,
    "shirtNumber" INTEGER,
    "priceMilli" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_king_players_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_king_coaches" (
    "id" TEXT NOT NULL,
    "leagueKey" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "clubNameAr" TEXT NOT NULL,
    "clubNameEn" TEXT,
    "externalCoachId" INTEGER NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "photoUrl" TEXT,
    "priceMilli" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_king_coaches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_king_wallets" (
    "userId" TEXT NOT NULL,
    "balanceMilli" INTEGER NOT NULL DEFAULT 1000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_king_wallets_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "coach_king_gameweeks" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "lockAt" TIMESTAMP(3) NOT NULL,
    "status" "CoachKingGameweekStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_king_gameweeks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_king_fixtures" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "homeTeamName" TEXT,
    "awayTeamName" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NS',
    "processedAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_king_fixtures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_king_squads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "coachId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "spentMilli" INTEGER NOT NULL DEFAULT 0,
    "payoutMilli" INTEGER NOT NULL DEFAULT 0,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_king_squads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_king_squad_slots" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "coach_king_squad_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_king_performances" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "yellows" INTEGER NOT NULL DEFAULT 0,
    "reds" INTEGER NOT NULL DEFAULT 0,
    "ownGoals" INTEGER NOT NULL DEFAULT 0,
    "cleanSheet" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,
    "fixtureDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_king_performances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_king_coach_scores" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "fixtureDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_king_coach_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coach_king_players_externalPlayerId_key" ON "coach_king_players"("externalPlayerId");
CREATE INDEX "coach_king_players_line_active_priceMilli_idx" ON "coach_king_players"("line", "active", "priceMilli");
CREATE INDEX "coach_king_players_teamId_idx" ON "coach_king_players"("teamId");

CREATE UNIQUE INDEX "coach_king_coaches_externalCoachId_key" ON "coach_king_coaches"("externalCoachId");
CREATE INDEX "coach_king_coaches_teamId_idx" ON "coach_king_coaches"("teamId");

CREATE UNIQUE INDEX "coach_king_gameweeks_weekKey_key" ON "coach_king_gameweeks"("weekKey");
CREATE INDEX "coach_king_gameweeks_status_endAt_idx" ON "coach_king_gameweeks"("status", "endAt");

CREATE UNIQUE INDEX "coach_king_fixtures_gameweekId_fixtureId_key" ON "coach_king_fixtures"("gameweekId", "fixtureId");
CREATE INDEX "coach_king_fixtures_gameweekId_processedAt_idx" ON "coach_king_fixtures"("gameweekId", "processedAt");

CREATE UNIQUE INDEX "coach_king_squads_userId_gameweekId_key" ON "coach_king_squads"("userId", "gameweekId");
CREATE INDEX "coach_king_squads_gameweekId_idx" ON "coach_king_squads"("gameweekId");

CREATE UNIQUE INDEX "coach_king_squad_slots_squadId_slotKey_key" ON "coach_king_squad_slots"("squadId", "slotKey");
CREATE INDEX "coach_king_squad_slots_playerId_idx" ON "coach_king_squad_slots"("playerId");

CREATE UNIQUE INDEX "coach_king_performances_gameweekId_playerId_fixtureId_key" ON "coach_king_performances"("gameweekId", "playerId", "fixtureId");
CREATE INDEX "coach_king_performances_playerId_idx" ON "coach_king_performances"("playerId");

CREATE UNIQUE INDEX "coach_king_coach_scores_gameweekId_coachId_fixtureId_key" ON "coach_king_coach_scores"("gameweekId", "coachId", "fixtureId");
CREATE INDEX "coach_king_coach_scores_coachId_idx" ON "coach_king_coach_scores"("coachId");

ALTER TABLE "coach_king_wallets" ADD CONSTRAINT "coach_king_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_king_fixtures" ADD CONSTRAINT "coach_king_fixtures_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "coach_king_gameweeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_king_squads" ADD CONSTRAINT "coach_king_squads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_king_squads" ADD CONSTRAINT "coach_king_squads_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "coach_king_gameweeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_king_squads" ADD CONSTRAINT "coach_king_squads_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_king_coaches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coach_king_squad_slots" ADD CONSTRAINT "coach_king_squad_slots_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "coach_king_squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_king_squad_slots" ADD CONSTRAINT "coach_king_squad_slots_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "coach_king_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coach_king_performances" ADD CONSTRAINT "coach_king_performances_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "coach_king_gameweeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_king_performances" ADD CONSTRAINT "coach_king_performances_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "coach_king_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_king_coach_scores" ADD CONSTRAINT "coach_king_coach_scores_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "coach_king_gameweeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_king_coach_scores" ADD CONSTRAINT "coach_king_coach_scores_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_king_coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
