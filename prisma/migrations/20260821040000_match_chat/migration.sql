-- Live match chat (dev migrate). Production uses `prisma db push`.

CREATE TYPE "MatchChatModerationStatus" AS ENUM ('CLEAN', 'WARNED', 'BLOCKED', 'DELETED');
CREATE TYPE "MatchChatModerationCategory" AS ENUM ('CLEAN', 'INSULT', 'PROFANITY', 'HARASSMENT', 'THREAT', 'HATE', 'SEXUAL', 'SPAM', 'ADVERTISEMENT', 'SUSPICIOUS_LINK');
CREATE TYPE "MatchChatReportReason" AS ENUM ('PROFANITY', 'ABUSE', 'HARASSMENT', 'SPAM', 'ADVERTISEMENT', 'SUSPICIOUS_LINK', 'OTHER');

CREATE TABLE "match_chat_messages" (
    "id" TEXT NOT NULL,
    "matchId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "moderationStatus" "MatchChatModerationStatus" NOT NULL DEFAULT 'CLEAN',
    "moderationCategory" "MatchChatModerationCategory" NOT NULL DEFAULT 'CLEAN',
    "moderationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moderationReason" TEXT,
    "clientMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "match_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_chat_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reason" "MatchChatReportReason" NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_chat_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "match_chat_messages_userId_clientMessageId_key" ON "match_chat_messages"("userId", "clientMessageId");
CREATE INDEX "match_chat_messages_matchId_createdAt_idx" ON "match_chat_messages"("matchId", "createdAt");
CREATE INDEX "match_chat_messages_matchId_id_idx" ON "match_chat_messages"("matchId", "id");
CREATE INDEX "match_chat_messages_userId_createdAt_idx" ON "match_chat_messages"("userId", "createdAt");
CREATE UNIQUE INDEX "match_chat_reports_reporterId_messageId_key" ON "match_chat_reports"("reporterId", "messageId");
CREATE INDEX "match_chat_reports_messageId_idx" ON "match_chat_reports"("messageId");
CREATE INDEX "match_chat_reports_reporterId_createdAt_idx" ON "match_chat_reports"("reporterId", "createdAt");

ALTER TABLE "match_chat_messages" ADD CONSTRAINT "match_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_chat_reports" ADD CONSTRAINT "match_chat_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_chat_reports" ADD CONSTRAINT "match_chat_reports_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "match_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
