-- Phase 2 (A5, A13, E11): additive only, safe to re-run.

-- E11: VOID marker for matches that will never produce a result.
ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;
ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);

-- A5: one settlement lock domain for every replica.
CREATE TABLE IF NOT EXISTS "settle_leases" (
    "apiMatchId" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settle_leases_pkey" PRIMARY KEY ("apiMatchId")
);

-- A13: pending-set scans (watcher distinct + resolver per match).
CREATE INDEX IF NOT EXISTS "predictions_isCorrect_apiMatchId_idx" ON "predictions"("isCorrect", "apiMatchId");
