-- CreateEnum
CREATE TYPE "DisplayMode" AS ENUM ('NEVER', 'AFTER_ANSWER', 'BEFORE_QUESTION', 'IN_QUESTION', 'AFTER_WRONG', 'BLUR_REVEAL');

-- AlterTable
ALTER TABLE "quiz_questions" ADD COLUMN "displayMode" "DisplayMode" NOT NULL DEFAULT 'NEVER';