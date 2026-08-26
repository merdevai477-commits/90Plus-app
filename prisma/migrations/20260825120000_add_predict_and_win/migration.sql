-- Predict & Win (توقع واربح)
--
-- Adds the four tables the feature owns (sponsors, prize_categories,
-- competitions, competition_entries) plus its two enums.
--
-- Every statement is written to be re-runnable. The feature was developed with
-- `prisma db push`, so the objects below already exist in databases that were
-- pushed to; this migration has to record that schema in history without
-- failing on them, and without touching a single row of existing data. It
-- creates only — it never drops, truncates or alters an existing column type.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PredictionMode" AS ENUM ('WINNER', 'EXACT_SCORE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED', 'SETTLED', 'CANCELLED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "sponsors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "address" TEXT,
    "hasDelivery" BOOLEAN NOT NULL DEFAULT false,
    "socialLinks" JSONB,
    "ownerId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "prize_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prize_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "competitions" (
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "prizeName" TEXT NOT NULL,
    "prizeImageUrl" TEXT,
    "prizeType" TEXT NOT NULL,
    "prizeDescription" TEXT,
    "winnersCount" INTEGER NOT NULL DEFAULT 1,
    "apiMatchId" INTEGER NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeTeamLogo" TEXT,
    "awayTeamLogo" TEXT,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "leagueName" TEXT,
    "matchStatus" TEXT,
    "resultHomeScore" INTEGER,
    "resultAwayScore" INTEGER,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "rules" TEXT,
    "predictionDeadline" TIMESTAMP(3) NOT NULL,
    "predictionMode" "PredictionMode" NOT NULL DEFAULT 'EXACT_SCORE',
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "participantsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "competition_entries" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "predictedHomeScore" INTEGER,
    "predictedAwayScore" INTEGER,
    "predictedWinner" TEXT,
    "isCorrect" BOOLEAN,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "competition_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sponsors_ownerId_idx" ON "sponsors"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "prize_categories_key_key" ON "prize_categories"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "prize_categories_isActive_sortOrder_idx" ON "prize_categories"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "competitions_status_predictionDeadline_idx" ON "competitions"("status", "predictionDeadline");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "competitions_apiMatchId_idx" ON "competitions"("apiMatchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "competitions_sponsorId_idx" ON "competitions"("sponsorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "competitions_categoryId_idx" ON "competitions"("categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "competitions_status_participantsCount_idx" ON "competitions"("status", "participantsCount" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "competitions_status_createdAt_idx" ON "competitions"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "competition_entries_userId_idx" ON "competition_entries"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "competition_entries_competitionId_idx" ON "competition_entries"("competitionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "competition_entries_competitionId_isCorrect_createdAt_idx" ON "competition_entries"("competitionId", "isCorrect", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "competition_entries_competitionId_userId_key" ON "competition_entries"("competitionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "competition_entries_competitionId_rank_key" ON "competition_entries"("competitionId", "rank");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "competitions" ADD CONSTRAINT "competitions_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "sponsors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "competitions" ADD CONSTRAINT "competitions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "prize_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ── Columns added after the tables were first pushed ─────────────────────────
-- `CREATE TABLE IF NOT EXISTS` above is a no-op on a database that already has
-- the table, which would leave a pushed-but-older database missing these. They
-- are additive and nullable, so no backfill and no default is required.
ALTER TABLE "prize_categories" ADD COLUMN IF NOT EXISTS "nameEn" TEXT;
ALTER TABLE "prize_categories" ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT;
