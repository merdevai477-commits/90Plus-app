-- Migration: add_chat_answer_cache
-- Adds a DB-backed cache of factual Captain AI answers (player stats, standings,
-- top scorers). Identical questions (keyed by a hash of normalized question +
-- language) are served from Postgres instead of re-calling the LLM. Live data is
-- never cached here (handled at the application layer).

CREATE TABLE "chat_answer_cache" (
    "id"           TEXT NOT NULL,
    "questionHash" TEXT NOT NULL,
    "language"     TEXT NOT NULL,
    "question"     TEXT NOT NULL,
    "answer"       TEXT NOT NULL,
    "usedModel"    TEXT,
    "hits"         INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_answer_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_answer_cache_questionHash_key" ON "chat_answer_cache"("questionHash");
CREATE INDEX "chat_answer_cache_language_idx" ON "chat_answer_cache"("language");
