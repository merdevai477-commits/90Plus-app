-- Phase 5 (A7): admin re-settle audit. Additive only, safe to re-run.

ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "resettledAt" TIMESTAMP(3);
ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "resettleRunId" TEXT;

CREATE TABLE IF NOT EXISTS "prediction_resettle_runs" (
    "id" TEXT NOT NULL,
    "apiMatchId" INTEGER NOT NULL,
    "adminUserId" TEXT,
    "snapshot" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_resettle_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "prediction_resettle_items" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "diff" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_resettle_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "prediction_resettle_runs_apiMatchId_createdAt_idx" ON "prediction_resettle_runs"("apiMatchId", "createdAt");
CREATE INDEX IF NOT EXISTS "prediction_resettle_items_runId_idx" ON "prediction_resettle_items"("runId");
CREATE INDEX IF NOT EXISTS "prediction_resettle_items_predictionId_idx" ON "prediction_resettle_items"("predictionId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'prediction_resettle_items_runId_fkey'
    ) THEN
        ALTER TABLE "prediction_resettle_items"
            ADD CONSTRAINT "prediction_resettle_items_runId_fkey"
            FOREIGN KEY ("runId") REFERENCES "prediction_resettle_runs"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
