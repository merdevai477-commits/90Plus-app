/*
  Warnings:

  - Added the required column `canRetryAt` to the `quiz_attempts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `correctAnswers` to the `quiz_attempts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timeTaken` to the `quiz_attempts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StrikeType" AS ENUM ('CONTENT_VIOLATION', 'USER_VIOLATION', 'SPAM', 'HARASSMENT', 'COPYRIGHT', 'INAPPROPRIATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('REPORT_CREATED', 'STRIKE_CREATED', 'CONTENT_DELETED', 'USER_SUSPENDED', 'USER_UNSUSPENDED', 'USER_BANNED', 'ADMIN_REVIEW', 'WARNING_ISSUED');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('USER', 'REEL', 'COMMENT', 'REPORT');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MODERATION_ALERT';

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "canRetryAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "correctAnswers" INTEGER NOT NULL,
ADD COLUMN     "streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timeTaken" INTEGER NOT NULL,
ADD COLUMN     "xpEarned" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quiz_questions" ADD COLUMN     "hint" TEXT,
ADD COLUMN     "imageType" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "timeLimit" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "reels" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" "ReportPriority" NOT NULL DEFAULT 'MEDIUM';

-- CreateTable
CREATE TABLE "user_quiz_answers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeTaken" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strikes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "reportedReelId" TEXT,
    "reportedCommentId" TEXT,
    "strikeType" "StrikeType" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" "AuditTargetType" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_quiz_answers_userId_idx" ON "user_quiz_answers"("userId");

-- CreateIndex
CREATE INDEX "user_quiz_answers_questionId_idx" ON "user_quiz_answers"("questionId");

-- CreateIndex
CREATE INDEX "user_quiz_answers_attemptId_idx" ON "user_quiz_answers"("attemptId");

-- CreateIndex
CREATE INDEX "strikes_userId_idx" ON "strikes"("userId");

-- CreateIndex
CREATE INDEX "strikes_reportId_idx" ON "strikes"("reportId");

-- CreateIndex
CREATE INDEX "strikes_reportedReelId_idx" ON "strikes"("reportedReelId");

-- CreateIndex
CREATE INDEX "strikes_reportedCommentId_idx" ON "strikes"("reportedCommentId");

-- CreateIndex
CREATE INDEX "strikes_createdAt_idx" ON "strikes"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_targetId_idx" ON "audit_logs"("targetId");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_idx" ON "audit_logs"("targetType");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "comments_isDeleted_idx" ON "comments"("isDeleted");

-- CreateIndex
CREATE INDEX "quiz_attempts_canRetryAt_idx" ON "quiz_attempts"("canRetryAt");

-- CreateIndex
CREATE INDEX "reels_isDeleted_idx" ON "reels"("isDeleted");

-- CreateIndex
CREATE INDEX "reports_priority_idx" ON "reports"("priority");

-- CreateIndex
CREATE INDEX "reports_reportedReelId_idx" ON "reports"("reportedReelId");

-- CreateIndex
CREATE INDEX "reports_reportedCommentId_idx" ON "reports"("reportedCommentId");

-- AddForeignKey
ALTER TABLE "user_quiz_answers" ADD CONSTRAINT "user_quiz_answers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quiz_answers" ADD CONSTRAINT "user_quiz_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quiz_answers" ADD CONSTRAINT "user_quiz_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_reportedReelId_fkey" FOREIGN KEY ("reportedReelId") REFERENCES "reels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_reportedCommentId_fkey" FOREIGN KEY ("reportedCommentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
