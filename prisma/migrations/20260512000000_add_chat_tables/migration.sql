-- Migration: add_chat_tables
-- Adds Prisma-backed storage for the 90Plus AI Chat feature.
-- Replaces the legacy file-based chat-store.json.
--
-- userId in these tables is the device-local UUID issued by the frontend
-- (x-user-id header) — NOT a FK to users.id — so chat history works for
-- unauthenticated users too.

-- ChatConversation
CREATE TABLE "chat_conversations" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "title"     TEXT NOT NULL DEFAULT 'محادثة جديدة',
    "pinned"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_conversations_userId_idx" ON "chat_conversations"("userId");
CREATE INDEX "chat_conversations_userId_updatedAt_idx" ON "chat_conversations"("userId", "updatedAt");

-- ChatMessage
CREATE TABLE "chat_messages" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role"           TEXT NOT NULL,
    "text"           TEXT NOT NULL,
    "usedModel"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_messages_conversationId_idx" ON "chat_messages"("conversationId");
CREATE INDEX "chat_messages_conversationId_createdAt_idx" ON "chat_messages"("conversationId", "createdAt");

ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId")
    REFERENCES "chat_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ChatLimit
CREATE TABLE "chat_limits" (
    "userId"    TEXT NOT NULL,
    "count"     INTEGER NOT NULL DEFAULT 0,
    "date"      TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_limits_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "chat_limits_date_idx" ON "chat_limits"("date");
