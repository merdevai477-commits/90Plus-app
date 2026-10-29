-- King integrity (B3, B7, A12): additive only.

ALTER TABLE "coin_transactions" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "coin_transactions_idempotencyKey_key" ON "coin_transactions"("idempotencyKey");

ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "canonicalFixtureKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "predictions_userId_canonicalFixtureKey_key" ON "predictions"("userId", "canonicalFixtureKey");

CREATE TABLE IF NOT EXISTS "prediction_daily_counters" (
    "userId" TEXT NOT NULL,
    "cairoDay" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_daily_counters_pkey" PRIMARY KEY ("userId","cairoDay")
);

DO $$ BEGIN
    ALTER TABLE "prediction_daily_counters" ADD CONSTRAINT "prediction_daily_counters_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
