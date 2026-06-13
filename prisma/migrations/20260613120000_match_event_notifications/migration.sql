-- Phase 0+1: subscription-aware match push notifications

ALTER TABLE "favorite_matches" ADD COLUMN IF NOT EXISTS "subscribedAt" TIMESTAMP(3);
UPDATE "favorite_matches" SET "subscribedAt" = "createdAt" WHERE "subscribedAt" IS NULL;
ALTER TABLE "favorite_matches" ALTER COLUMN "subscribedAt" SET NOT NULL;
ALTER TABLE "favorite_matches" ALTER COLUMN "subscribedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "favorite_matches" ADD COLUMN IF NOT EXISTS "lastDeliveredEventKey" TEXT;
ALTER TABLE "favorite_matches" ADD COLUMN IF NOT EXISTS "baselineHomeScore" INTEGER;
ALTER TABLE "favorite_matches" ADD COLUMN IF NOT EXISTS "baselineAwayScore" INTEGER;
ALTER TABLE "favorite_matches" ADD COLUMN IF NOT EXISTS "baselineStatus" TEXT;

CREATE INDEX IF NOT EXISTS "favorite_matches_apiMatchId_subscribedAt_idx"
  ON "favorite_matches"("apiMatchId", "subscribedAt");

CREATE TABLE IF NOT EXISTS "match_events" (
    "id" TEXT NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "minute" INTEGER,
    "extraMinute" INTEGER,
    "teamId" INTEGER,
    "playerId" INTEGER,
    "payload" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "match_events_fixtureId_eventKey_key"
  ON "match_events"("fixtureId", "eventKey");

CREATE INDEX IF NOT EXISTS "match_events_fixtureId_detectedAt_idx"
  ON "match_events"("fixtureId", "detectedAt");

CREATE TABLE IF NOT EXISTS "match_event_deliveries" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixtureId" INTEGER NOT NULL,

    CONSTRAINT "match_event_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "match_event_deliveries_subscriptionId_eventKey_key"
  ON "match_event_deliveries"("subscriptionId", "eventKey");

CREATE INDEX IF NOT EXISTS "match_event_deliveries_subscriptionId_idx"
  ON "match_event_deliveries"("subscriptionId");

ALTER TABLE "match_event_deliveries" DROP CONSTRAINT IF EXISTS "match_event_deliveries_subscriptionId_fkey";
ALTER TABLE "match_event_deliveries" ADD CONSTRAINT "match_event_deliveries_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "favorite_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_event_deliveries" DROP CONSTRAINT IF EXISTS "match_event_deliveries_fixtureId_eventKey_fkey";
ALTER TABLE "match_event_deliveries" ADD CONSTRAINT "match_event_deliveries_fixtureId_eventKey_fkey"
  FOREIGN KEY ("fixtureId", "eventKey") REFERENCES "match_events"("fixtureId", "eventKey") ON DELETE CASCADE ON UPDATE CASCADE;
