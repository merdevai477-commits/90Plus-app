CREATE TABLE "cached_standings" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'api-football',
    "competitionId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "language" VARCHAR(8) NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_standings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cached_standings_provider_competitionId_season_language_key"
ON "cached_standings"("provider", "competitionId", "season", "language");

CREATE INDEX "cached_standings_leagueId_season_idx"
ON "cached_standings"("leagueId", "season");
