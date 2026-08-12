-- Share & Win: referral identity, share tracking, weekly cycles and standings.
-- Additive only — no existing column is renamed, altered or dropped.

-- ─── Enums ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShareWinCycleStatus') THEN
        CREATE TYPE "ShareWinCycleStatus" AS ENUM ('ACTIVE', 'COMPLETED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShareWinReferralStatus') THEN
        CREATE TYPE "ShareWinReferralStatus" AS ENUM ('CONVERTED', 'REVOKED');
    END IF;
END
$$;

-- ─── User referral identity ─────────────────────────────────────────────────
-- Nullable so every existing row stays valid; codes are generated lazily.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_referralCode_key"
    ON "users" ("referralCode");

-- ─── Weekly cycles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "share_win_cycles" (
    "id"        TEXT NOT NULL,
    "weekKey"   TEXT NOT NULL,
    "startAt"   TIMESTAMP(3) NOT NULL,
    "endAt"     TIMESTAMP(3) NOT NULL,
    "status"    "ShareWinCycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "prizes"    JSONB,
    "closedAt"  TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_win_cycles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "share_win_cycles_weekKey_key"
    ON "share_win_cycles" ("weekKey");
CREATE INDEX IF NOT EXISTS "share_win_cycles_status_startAt_idx"
    ON "share_win_cycles" ("status", "startAt");
CREATE INDEX IF NOT EXISTS "share_win_cycles_endAt_idx"
    ON "share_win_cycles" ("endAt");

-- ─── Share events (append-only audit trail) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "share_win_share_events" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "cycleId"   TEXT NOT NULL,
    "channel"   TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_win_share_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "share_win_share_events_userId_createdAt_idx"
    ON "share_win_share_events" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "share_win_share_events_cycleId_userId_idx"
    ON "share_win_share_events" ("cycleId", "userId");

-- ─── Referral attribution ───────────────────────────────────────────────────
-- The UNIQUE on "referredUserId" is what makes duplicate attribution and
-- concurrent registration races impossible at the database level.
CREATE TABLE IF NOT EXISTS "share_win_referrals" (
    "id"             TEXT NOT NULL,
    "referrerId"     TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "referralCode"   TEXT NOT NULL,
    "cycleId"        TEXT NOT NULL,
    "status"         "ShareWinReferralStatus" NOT NULL DEFAULT 'CONVERTED',
    "convertedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_win_referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "share_win_referrals_referredUserId_key"
    ON "share_win_referrals" ("referredUserId");
CREATE INDEX IF NOT EXISTS "share_win_referrals_referrerId_cycleId_idx"
    ON "share_win_referrals" ("referrerId", "cycleId");
CREATE INDEX IF NOT EXISTS "share_win_referrals_cycleId_idx"
    ON "share_win_referrals" ("cycleId");
CREATE INDEX IF NOT EXISTS "share_win_referrals_referralCode_idx"
    ON "share_win_referrals" ("referralCode");

-- ─── Per-user, per-cycle standings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "share_win_standings" (
    "id"               TEXT NOT NULL,
    "cycleId"          TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "shareCount"       INTEGER NOT NULL DEFAULT 0,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "score"            INTEGER NOT NULL DEFAULT 0,
    "firstScoredAt"    TIMESTAMP(3),
    "lastScoredAt"     TIMESTAMP(3),
    "finalRank"        INTEGER,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_win_standings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "share_win_standings_cycleId_userId_key"
    ON "share_win_standings" ("cycleId", "userId");
-- Drives the leaderboard ORDER BY (participants desc, score desc).
CREATE INDEX IF NOT EXISTS "share_win_standings_cycleId_participantCount_score_idx"
    ON "share_win_standings" ("cycleId", "participantCount" DESC, "score" DESC);
CREATE INDEX IF NOT EXISTS "share_win_standings_cycleId_finalRank_idx"
    ON "share_win_standings" ("cycleId", "finalRank");
CREATE INDEX IF NOT EXISTS "share_win_standings_userId_idx"
    ON "share_win_standings" ("userId");

-- ─── Foreign keys ───────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'share_win_share_events_userId_fkey') THEN
        ALTER TABLE "share_win_share_events"
            ADD CONSTRAINT "share_win_share_events_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'share_win_share_events_cycleId_fkey') THEN
        ALTER TABLE "share_win_share_events"
            ADD CONSTRAINT "share_win_share_events_cycleId_fkey"
            FOREIGN KEY ("cycleId") REFERENCES "share_win_cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'share_win_referrals_referrerId_fkey') THEN
        ALTER TABLE "share_win_referrals"
            ADD CONSTRAINT "share_win_referrals_referrerId_fkey"
            FOREIGN KEY ("referrerId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'share_win_referrals_referredUserId_fkey') THEN
        ALTER TABLE "share_win_referrals"
            ADD CONSTRAINT "share_win_referrals_referredUserId_fkey"
            FOREIGN KEY ("referredUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'share_win_referrals_cycleId_fkey') THEN
        ALTER TABLE "share_win_referrals"
            ADD CONSTRAINT "share_win_referrals_cycleId_fkey"
            FOREIGN KEY ("cycleId") REFERENCES "share_win_cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'share_win_standings_cycleId_fkey') THEN
        ALTER TABLE "share_win_standings"
            ADD CONSTRAINT "share_win_standings_cycleId_fkey"
            FOREIGN KEY ("cycleId") REFERENCES "share_win_cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'share_win_standings_userId_fkey') THEN
        ALTER TABLE "share_win_standings"
            ADD CONSTRAINT "share_win_standings_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
