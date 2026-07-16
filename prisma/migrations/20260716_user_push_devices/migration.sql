-- Multi-device Expo push tokens (Android + iOS coexist)
CREATE TABLE IF NOT EXISTS "user_push_devices" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'unknown',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_push_devices_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_push_devices_token_key" ON "user_push_devices"("token");
CREATE INDEX IF NOT EXISTS "user_push_devices_userId_idx" ON "user_push_devices"("userId");
CREATE INDEX IF NOT EXISTS "user_push_devices_platform_idx" ON "user_push_devices"("platform");

-- Backfill from legacy single-token column
INSERT INTO "user_push_devices" ("id", "userId", "token", "platform", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", u."expoPushToken", 'legacy', NOW(), NOW()
FROM "users" u
WHERE u."expoPushToken" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user_push_devices" d WHERE d."token" = u."expoPushToken"
  );
