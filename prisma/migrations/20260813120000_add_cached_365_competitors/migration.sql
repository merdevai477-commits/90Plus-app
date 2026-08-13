-- CreateTable
CREATE TABLE "cached_365_competitors" (
    "id" TEXT NOT NULL,
    "competitorId" INTEGER NOT NULL,
    "sportId" INTEGER NOT NULL DEFAULT 1,
    "type" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "longName" TEXT,
    "symbolicName" TEXT,
    "nameForURL" TEXT,
    "countryId" INTEGER,
    "country" TEXT,
    "logo" TEXT,
    "mainCompetitionId" INTEGER,
    "isNationalTeam" BOOLEAN NOT NULL DEFAULT false,
    "langId" INTEGER NOT NULL DEFAULT 1,
    "fullData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_365_competitors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cached_365_competitors_competitorId_key" ON "cached_365_competitors"("competitorId");

-- CreateIndex
CREATE INDEX "cached_365_competitors_name_idx" ON "cached_365_competitors"("name");

-- CreateIndex
CREATE INDEX "cached_365_competitors_country_idx" ON "cached_365_competitors"("country");

-- CreateIndex
CREATE INDEX "cached_365_competitors_updatedAt_idx" ON "cached_365_competitors"("updatedAt");
