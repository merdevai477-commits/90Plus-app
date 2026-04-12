-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('SENT', 'OPENED', 'DISMISSED');

-- CreateTable: NotificationPreferences
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchGoals" BOOLEAN NOT NULL DEFAULT true,
    "matchStart" BOOLEAN NOT NULL DEFAULT true,
    "matchEnd" BOOLEAN NOT NULL DEFAULT true,
    "matchHalftime" BOOLEAN NOT NULL DEFAULT true,
    "leagueMatches" BOOLEAN NOT NULL DEFAULT true,
    "socialFollow" BOOLEAN NOT NULL DEFAULT true,
    "socialLike" BOOLEAN NOT NULL DEFAULT true,
    "socialComment" BOOLEAN NOT NULL DEFAULT true,
    "socialReply" BOOLEAN NOT NULL DEFAULT true,
    "socialMention" BOOLEAN NOT NULL DEFAULT true,
    "predictionResults" BOOLEAN NOT NULL DEFAULT true,
    "luckyWheel" BOOLEAN NOT NULL DEFAULT true,
    "gifts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NotificationEvent
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" "NotificationEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndexes
CREATE INDEX "notification_preferences_userId_idx" ON "notification_preferences"("userId");
CREATE INDEX "notification_events_notificationId_idx" ON "notification_events"("notificationId");
CREATE INDEX "notification_events_userId_idx" ON "notification_events"("userId");
CREATE INDEX "notification_events_event_idx" ON "notification_events"("event");
CREATE INDEX "notification_events_createdAt_idx" ON "notification_events"("createdAt");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
