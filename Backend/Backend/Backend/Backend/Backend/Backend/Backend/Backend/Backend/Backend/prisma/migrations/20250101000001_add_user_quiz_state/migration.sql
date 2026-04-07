-- CreateTable
CREATE TABLE "user_quiz_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentOpenCategoryId" TEXT,
    "lastCategoryOpenedAt" TIMESTAMP(3),
    "nextCategoryUnlockAt" TIMESTAMP(3),
    "completedCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_quiz_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_quiz_states_userId_key" ON "user_quiz_states"("userId");

-- CreateIndex
CREATE INDEX "user_quiz_states_userId_idx" ON "user_quiz_states"("userId");

-- CreateIndex
CREATE INDEX "user_quiz_states_currentOpenCategoryId_idx" ON "user_quiz_states"("currentOpenCategoryId");

-- CreateIndex
CREATE INDEX "user_quiz_states_nextCategoryUnlockAt_idx" ON "user_quiz_states"("nextCategoryUnlockAt");

-- AddForeignKey
ALTER TABLE "user_quiz_states" ADD CONSTRAINT "user_quiz_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

