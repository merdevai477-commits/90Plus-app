-- CreateTable
CREATE TABLE "daily_quizzes" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "questionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "date" DATE NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_quizzes_date_key" ON "daily_quizzes"("date");

-- CreateIndex
CREATE INDEX "daily_quizzes_date_idx" ON "daily_quizzes"("date");

-- CreateIndex
CREATE INDEX "daily_quizzes_categoryId_idx" ON "daily_quizzes"("categoryId");

-- CreateIndex
CREATE INDEX "daily_quizzes_expiresAt_idx" ON "daily_quizzes"("expiresAt");

-- AddForeignKey
ALTER TABLE "daily_quizzes" ADD CONSTRAINT "daily_quizzes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "quiz_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

