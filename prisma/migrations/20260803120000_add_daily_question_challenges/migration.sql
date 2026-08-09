-- CreateEnum
CREATE TYPE "DailyChallengeType" AS ENUM (
  'GUESS_PLAYER',
  'FOOTBALL_BINGO',
  'FOOTBALL_GRID',
  'PLAYER_CONNECTIONS',
  'GUESS_CLUB',
  'TRANSFER_PUZZLE',
  'TOP10_CHALLENGE',
  'FOOTBALL_QUIZ'
);

-- CreateEnum
CREATE TYPE "DailyChallengeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "daily_question_challenges" (
  "id" TEXT NOT NULL,
  "type" "DailyChallengeType" NOT NULL,
  "language" VARCHAR(5) NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "image" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "difficulty" "Difficulty" NOT NULL,
  "xpReward" INTEGER NOT NULL,
  "refreshDate" DATE NOT NULL,
  "refreshTime" TEXT NOT NULL DEFAULT '00:00',
  "status" "DailyChallengeStatus" NOT NULL DEFAULT 'DRAFT',
  "streakContribution" BOOLEAN NOT NULL DEFAULT true,
  "leaderboardEligibility" BOOLEAN NOT NULL DEFAULT true,
  "content" JSONB NOT NULL,
  "answer" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "contentHash" VARCHAR(64) NOT NULL,
  "source" VARCHAR(16) NOT NULL DEFAULT 'AI',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "daily_question_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_question_challenges" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "score" INTEGER NOT NULL DEFAULT 0,
  "elapsedTime" INTEGER NOT NULL DEFAULT 0,
  "xpEarned" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "completionPercentage" INTEGER NOT NULL DEFAULT 0,
  "unlocked" BOOLEAN NOT NULL DEFAULT true,
  "hintUsed" BOOLEAN NOT NULL DEFAULT false,
  "answeredPayload" JSONB NOT NULL DEFAULT '{}',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_question_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_question_challenges_refreshDate_type_language_key"
ON "daily_question_challenges"("refreshDate", "type", "language");

-- CreateIndex
CREATE INDEX "daily_question_challenges_refreshDate_language_idx"
ON "daily_question_challenges"("refreshDate", "language");

-- CreateIndex
CREATE INDEX "daily_question_challenges_status_idx"
ON "daily_question_challenges"("status");

-- CreateIndex
CREATE INDEX "daily_question_challenges_leaderboardEligibility_idx"
ON "daily_question_challenges"("leaderboardEligibility");

-- CreateIndex
CREATE INDEX "daily_question_challenges_contentHash_idx"
ON "daily_question_challenges"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "user_question_challenges_userId_challengeId_key"
ON "user_question_challenges"("userId", "challengeId");

-- CreateIndex
CREATE INDEX "user_question_challenges_userId_updatedAt_idx"
ON "user_question_challenges"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "user_question_challenges_challengeId_idx"
ON "user_question_challenges"("challengeId");

-- CreateIndex
CREATE INDEX "user_question_challenges_completed_idx"
ON "user_question_challenges"("completed");

-- AddForeignKey
ALTER TABLE "user_question_challenges"
ADD CONSTRAINT "user_question_challenges_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_question_challenges"
ADD CONSTRAINT "user_question_challenges_challengeId_fkey"
FOREIGN KEY ("challengeId") REFERENCES "daily_question_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
