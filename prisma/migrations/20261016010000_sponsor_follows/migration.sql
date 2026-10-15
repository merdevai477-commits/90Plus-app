-- Fans follow a store page and get push when a new challenge is published.
CREATE TABLE IF NOT EXISTS "sponsor_follows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sponsor_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_follows_userId_sponsorId_key"
  ON "sponsor_follows"("userId", "sponsorId");

CREATE INDEX IF NOT EXISTS "sponsor_follows_sponsorId_idx"
  ON "sponsor_follows"("sponsorId");

CREATE INDEX IF NOT EXISTS "sponsor_follows_userId_idx"
  ON "sponsor_follows"("userId");

DO $$ BEGIN
  ALTER TABLE "sponsor_follows"
    ADD CONSTRAINT "sponsor_follows_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sponsor_follows"
    ADD CONSTRAINT "sponsor_follows_sponsorId_fkey"
    FOREIGN KEY ("sponsorId") REFERENCES "sponsors"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
