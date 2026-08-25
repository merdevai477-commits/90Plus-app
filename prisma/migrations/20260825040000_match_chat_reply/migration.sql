-- Match chat reply threading (denormalized snapshot + optional parent FK).

ALTER TABLE "match_chat_messages" ADD COLUMN "replyToMessageId" TEXT;
ALTER TABLE "match_chat_messages" ADD COLUMN "replyToUsername" TEXT;
ALTER TABLE "match_chat_messages" ADD COLUMN "replyToDisplayName" TEXT;
ALTER TABLE "match_chat_messages" ADD COLUMN "replyToText" TEXT;

CREATE INDEX "match_chat_messages_replyToMessageId_idx" ON "match_chat_messages"("replyToMessageId");

ALTER TABLE "match_chat_messages" ADD CONSTRAINT "match_chat_messages_replyToMessageId_fkey"
  FOREIGN KEY ("replyToMessageId") REFERENCES "match_chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
