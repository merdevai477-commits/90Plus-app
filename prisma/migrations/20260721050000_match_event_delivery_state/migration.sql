ALTER TABLE "match_event_deliveries"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "processingToken" TEXT,
  ADD COLUMN "processingUntil" TIMESTAMP(3);

ALTER TABLE "match_event_deliveries"
  ALTER COLUMN "deliveredAt" DROP NOT NULL,
  ALTER COLUMN "deliveredAt" DROP DEFAULT;

UPDATE "match_event_deliveries"
SET "status" = 'SENT'
WHERE "deliveredAt" IS NOT NULL;

CREATE INDEX "match_event_deliveries_status_processingUntil_idx"
  ON "match_event_deliveries"("status", "processingUntil");

ALTER TABLE "notifications"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "notifications_idempotencyKey_key"
  ON "notifications"("idempotencyKey");
