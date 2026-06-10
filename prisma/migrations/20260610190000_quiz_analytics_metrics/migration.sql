-- DailyQuizPack generation metadata + fallback flag
ALTER TABLE "daily_quiz_packs" ADD COLUMN IF NOT EXISTS "isFallback" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "daily_quiz_packs" ADD COLUMN IF NOT EXISTS "generatorModel" VARCHAR(64);
ALTER TABLE "daily_quiz_packs" ADD COLUMN IF NOT EXISTS "generatorVersion" VARCHAR(32);
ALTER TABLE "daily_quiz_packs" ADD COLUMN IF NOT EXISTS "promptVersion" VARCHAR(32);
ALTER TABLE "daily_quiz_packs" ADD COLUMN IF NOT EXISTS "datasetVersion" VARCHAR(32);

CREATE INDEX IF NOT EXISTS "daily_quiz_packs_isFallback_idx" ON "daily_quiz_packs"("isFallback");

-- Quiz question engagement metrics
CREATE TABLE IF NOT EXISTS "quiz_question_metrics" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "packDate" DATE NOT NULL,
    "language" VARCHAR(5) NOT NULL,
    "questionType" VARCHAR(20),
    "difficulty" VARCHAR(10),
    "shownCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "hintCount" INTEGER NOT NULL DEFAULT 0,
    "totalAnswerTimeMs" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_question_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quiz_question_metrics_questionId_packDate_language_key"
    ON "quiz_question_metrics"("questionId", "packDate", "language");

CREATE INDEX IF NOT EXISTS "quiz_question_metrics_packDate_language_idx"
    ON "quiz_question_metrics"("packDate", "language");

CREATE INDEX IF NOT EXISTS "quiz_question_metrics_questionType_idx"
    ON "quiz_question_metrics"("questionType");

CREATE INDEX IF NOT EXISTS "quiz_question_metrics_difficulty_idx"
    ON "quiz_question_metrics"("difficulty");

CREATE INDEX IF NOT EXISTS "quiz_question_metrics_correctCount_idx"
    ON "quiz_question_metrics"("correctCount");

CREATE INDEX IF NOT EXISTS "quiz_question_metrics_skipCount_idx"
    ON "quiz_question_metrics"("skipCount");
