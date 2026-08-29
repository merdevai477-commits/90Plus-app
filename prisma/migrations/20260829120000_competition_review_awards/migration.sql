-- Human review + sponsor-awarded winners for Predict & Win.
-- Additive only: new columns, two tables, one enum.

DO $$ BEGIN
    CREATE TYPE "CompetitionActivityType" AS ENUM ('APPROVED', 'REJECTED', 'WINNER_AWARDED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "competitions"
    ADD COLUMN IF NOT EXISTS "viewsCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "winnerAwardedAt" TIMESTAMP(3);

ALTER TABLE "competition_entries"
    ADD COLUMN IF NOT EXISTS "awardedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "winnerAckAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "competition_views" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competition_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "competition_views_competitionId_userId_key"
    ON "competition_views"("competitionId", "userId");
CREATE INDEX IF NOT EXISTS "competition_views_userId_idx"
    ON "competition_views"("userId");

DO $$ BEGIN
    ALTER TABLE "competition_views"
        ADD CONSTRAINT "competition_views_competitionId_fkey"
        FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "competition_views"
        ADD CONSTRAINT "competition_views_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "competition_activities" (
    "id" TEXT NOT NULL,
    "type" "CompetitionActivityType" NOT NULL,
    "competitionId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competition_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "competition_activities_createdAt_idx"
    ON "competition_activities"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "competition_activities_competitionId_idx"
    ON "competition_activities"("competitionId");

DO $$ BEGIN
    ALTER TABLE "competition_activities"
        ADD CONSTRAINT "competition_activities_competitionId_fkey"
        FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
