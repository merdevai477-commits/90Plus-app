-- AlterTable: extend player_info with proactive-refresh metadata (additive, nullable / defaulted)
ALTER TABLE "player_info" ADD COLUMN IF NOT EXISTS "teamId" INTEGER;
ALTER TABLE "player_info" ADD COLUMN IF NOT EXISTS "lastRefreshType" TEXT;
ALTER TABLE "player_info" ADD COLUMN IF NOT EXISTS "refreshPriority" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "player_info" ADD COLUMN IF NOT EXISTS "accessCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "team_info" (
    "id" SERIAL NOT NULL,
    "apiTeamId" INTEGER NOT NULL,
    "teamName" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "lastFetched" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "team_player" (
    "id" SERIAL NOT NULL,
    "teamInfoId" INTEGER NOT NULL,
    "apiPlayerId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "jerseyNumber" INTEGER,

    CONSTRAINT "team_player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "refresh_control" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_control_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "team_info_apiTeamId_key" ON "team_info"("apiTeamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_info_expiresAt_idx" ON "team_info"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_player_teamInfoId_idx" ON "team_player"("teamInfoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_player_apiPlayerId_idx" ON "team_player"("apiPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_control_key_key" ON "refresh_control"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "player_info_teamId_idx" ON "player_info"("teamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "player_info_lastRefreshType_idx" ON "player_info"("lastRefreshType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "player_info_apiPlayerId_idx" ON "player_info"("apiPlayerId");

-- AddForeignKey
ALTER TABLE "player_info" ADD CONSTRAINT "player_info_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team_info"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_player" ADD CONSTRAINT "team_player_teamInfoId_fkey" FOREIGN KEY ("teamInfoId") REFERENCES "team_info"("id") ON DELETE CASCADE ON UPDATE CASCADE;
