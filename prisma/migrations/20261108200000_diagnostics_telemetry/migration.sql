-- Remote diagnostics telemetry (additive only). Sessions are created by an
-- admin; events arrive in batches from diagnostics-capable builds and from the
-- backend trace sink while a session is active. Retention cron deletes rows.

-- CreateTable
CREATE TABLE "diagnostic_sessions" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "environment" TEXT NOT NULL DEFAULT 'production',
    "target" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_session_devices" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceRef" TEXT NOT NULL,
    "userRef" TEXT,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "buildNumber" TEXT NOT NULL,
    "runtimeVersion" TEXT,
    "updateId" TEXT,
    "channel" TEXT,
    "osVersion" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "diagnostic_session_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_events" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "traceId" TEXT,
    "fixtureId" INTEGER,
    "deviceRef" TEXT,
    "screen" TEXT,
    "component" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "monoMs" DOUBLE PRECISION,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "diagnostic_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnostic_sessions_status_expiresAt_idx" ON "diagnostic_sessions"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "diagnostic_sessions_createdAt_idx" ON "diagnostic_sessions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_session_devices_sessionId_deviceRef_key" ON "diagnostic_session_devices"("sessionId", "deviceRef");

-- CreateIndex
CREATE INDEX "diagnostic_events_sessionId_type_idx" ON "diagnostic_events"("sessionId", "type");

-- CreateIndex
CREATE INDEX "diagnostic_events_sessionId_fixtureId_recordedAt_idx" ON "diagnostic_events"("sessionId", "fixtureId", "recordedAt");

-- CreateIndex
CREATE INDEX "diagnostic_events_sessionId_traceId_idx" ON "diagnostic_events"("sessionId", "traceId");

-- CreateIndex
CREATE INDEX "diagnostic_events_receivedAt_idx" ON "diagnostic_events"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_events_sessionId_eventId_key" ON "diagnostic_events"("sessionId", "eventId");

-- AddForeignKey
ALTER TABLE "diagnostic_session_devices" ADD CONSTRAINT "diagnostic_session_devices_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "diagnostic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_events" ADD CONSTRAINT "diagnostic_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "diagnostic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
