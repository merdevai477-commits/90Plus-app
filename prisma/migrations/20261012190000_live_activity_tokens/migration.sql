-- APNs tokens for iOS Live Activities (update tokens per running activity + push-to-start tokens).
CREATE TABLE "live_activity_tokens" (
    "token" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "fixtureId" INTEGER,
    "teamIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "sandbox" BOOLEAN,
    "startedFixtureIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "lastState" TEXT,
    "lastPushAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_activity_tokens_pkey" PRIMARY KEY ("token")
);

CREATE INDEX "live_activity_tokens_kind_fixtureId_idx" ON "live_activity_tokens"("kind", "fixtureId");
CREATE INDEX "live_activity_tokens_deviceId_idx" ON "live_activity_tokens"("deviceId");
