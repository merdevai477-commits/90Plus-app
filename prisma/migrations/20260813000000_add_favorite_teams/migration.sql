-- Followed teams (club / national team) + watcher-owned auto subscriptions

-- AlterTable: mark subscriptions auto-created by the followed-team watcher
ALTER TABLE "favorite_matches" ADD COLUMN IF NOT EXISTS "autoSubscribed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "favorite_teams" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiTeamId" INTEGER NOT NULL,
    "teamName" TEXT NOT NULL,
    "teamLogo" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "favorite_teams_userId_apiTeamId_key"
  ON "favorite_teams"("userId", "apiTeamId");

CREATE INDEX IF NOT EXISTS "favorite_teams_userId_idx"
  ON "favorite_teams"("userId");

CREATE INDEX IF NOT EXISTS "favorite_teams_apiTeamId_idx"
  ON "favorite_teams"("apiTeamId");

-- AddForeignKey
ALTER TABLE "favorite_teams" DROP CONSTRAINT IF EXISTS "favorite_teams_userId_fkey";
ALTER TABLE "favorite_teams" ADD CONSTRAINT "favorite_teams_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
