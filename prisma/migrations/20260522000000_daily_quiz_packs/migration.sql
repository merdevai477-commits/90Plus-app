-- CreateTable
CREATE TABLE "daily_quiz_packs" (
    "id" TEXT NOT NULL,
    "packDate" DATE NOT NULL,
    "language" VARCHAR(5) NOT NULL,
    "questions" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_quiz_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_daily_quiz_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packDate" DATE NOT NULL,
    "language" VARCHAR(5) NOT NULL,
    "progress" JSONB NOT NULL DEFAULT '{}',
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_daily_quiz_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_quiz_packs_packDate_language_key" ON "daily_quiz_packs"("packDate", "language");

-- CreateIndex
CREATE INDEX "daily_quiz_packs_packDate_idx" ON "daily_quiz_packs"("packDate");

-- CreateIndex
CREATE INDEX "daily_quiz_packs_expiresAt_idx" ON "daily_quiz_packs"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_daily_quiz_sessions_userId_packDate_language_key" ON "user_daily_quiz_sessions"("userId", "packDate", "language");

-- CreateIndex
CREATE INDEX "user_daily_quiz_sessions_userId_idx" ON "user_daily_quiz_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_daily_quiz_sessions_packDate_idx" ON "user_daily_quiz_sessions"("packDate");

-- AddForeignKey
ALTER TABLE "user_daily_quiz_sessions" ADD CONSTRAINT "user_daily_quiz_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
