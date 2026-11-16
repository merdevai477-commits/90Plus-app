-- Post-match Highlightly clips and the per-fixture sync backoff.
-- Additive only: existing fixture rows are unchanged.

CREATE TABLE "match_highlights" (
    "id" TEXT NOT NULL,
    "highlightlyId" INTEGER NOT NULL,
    "fixtureId" INTEGER,
    "highlightlyMatchId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "embedUrl" TEXT,
    "imgUrl" TEXT,
    "source" TEXT,
    "channel" TEXT,
    "homeTeamName" TEXT NOT NULL,
    "awayTeamName" TEXT NOT NULL,
    "leagueName" TEXT,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match_highlights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "match_highlights_highlightlyId_key" ON "match_highlights"("highlightlyId");
CREATE INDEX "match_highlights_fixtureId_idx" ON "match_highlights"("fixtureId");
CREATE INDEX "match_highlights_matchDate_idx" ON "match_highlights"("matchDate");
CREATE INDEX "match_highlights_highlightlyMatchId_idx" ON "match_highlights"("highlightlyMatchId");

CREATE TABLE "fixture_highlight_sync" (
    "fixtureId" INTEGER NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextCheckAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fixture_highlight_sync_pkey" PRIMARY KEY ("fixtureId")
);

CREATE INDEX "fixture_highlight_sync_nextCheckAt_status_idx"
    ON "fixture_highlight_sync"("nextCheckAt", "status");
