-- CreateTable
CREATE TABLE "cached_365_player_career" (
    "id" TEXT NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "photo" TEXT,
    "position" TEXT,
    "clubName" TEXT,
    "nationality" TEXT,
    "langId" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_365_player_career_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cached_365_player_career_athleteId_key" ON "cached_365_player_career"("athleteId");
