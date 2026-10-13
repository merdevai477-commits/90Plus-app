-- Voice-to-text quota: a per-user window anchor plus a ledger of transcription
-- operations. Purely additive; no existing table is touched.
CREATE TABLE IF NOT EXISTS "chat_voice_usage" (
    "userId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_voice_usage_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "chat_voice_operations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "transcript" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_voice_operations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_voice_operations_userId_idempotencyKey_key"
    ON "chat_voice_operations"("userId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "chat_voice_operations_userId_windowStart_status_idx"
    ON "chat_voice_operations"("userId", "windowStart", "status");
