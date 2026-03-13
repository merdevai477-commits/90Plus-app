-- AlterEnum
ALTER TYPE "CoinTransactionType" ADD VALUE 'PREDICTION';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "country" TEXT,
ADD COLUMN     "favoriteBrand" TEXT,
ADD COLUMN     "favoriteLeagues" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiMatchId" INTEGER NOT NULL,
    "predictionType" TEXT NOT NULL,
    "coinsSpent" INTEGER NOT NULL DEFAULT 5,
    "coinsWon" INTEGER,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "homeTeam" TEXT,
    "awayTeam" TEXT,
    "homeTeamLogo" TEXT,
    "awayTeamLogo" TEXT,
    "matchDate" TIMESTAMP(3),
    "leagueName" TEXT,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "predictions_userId_idx" ON "predictions"("userId");

-- CreateIndex
CREATE INDEX "predictions_apiMatchId_idx" ON "predictions"("apiMatchId");

-- CreateIndex
CREATE INDEX "predictions_createdAt_idx" ON "predictions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_userId_apiMatchId_key" ON "predictions"("userId", "apiMatchId");

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
