-- Share & Win: durable invite clicks + claim audit. Additive only.

-- ─── Enums ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShareWinInvitePlatform') THEN
        CREATE TYPE "ShareWinInvitePlatform" AS ENUM ('android', 'ios', 'other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShareWinClaimSource') THEN
        CREATE TYPE "ShareWinClaimSource" AS ENUM ('deferred', 'deeplink', 'webhook', 'web', 'manual');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShareWinClaimResult') THEN
        CREATE TYPE "ShareWinClaimResult" AS ENUM (
            'credited',
            'already_attributed',
            'not_a_new_user',
            'self_referral',
            'invalid_code',
            'invalid_click',
            'referrer_inactive',
            'error'
        );
    END IF;
END
$$;

-- ─── Invite clicks (one row per link open) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "share_win_invite_clicks" (
    "id"              TEXT NOT NULL,
    "clickId"         TEXT NOT NULL,
    "referralCode"    TEXT NOT NULL,
    "referrerId"      TEXT,
    "platform"        "ShareWinInvitePlatform" NOT NULL DEFAULT 'other',
    "userAgent"       TEXT,
    "ipHash"          TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installedAt"     TIMESTAMP(3),
    "installId"       TEXT,
    "appVersion"      TEXT,
    "registeredAt"    TIMESTAMP(3),
    "referredUserId"  TEXT,
    "claimSource"     "ShareWinClaimSource",

    CONSTRAINT "share_win_invite_clicks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "share_win_invite_clicks_clickId_key"
    ON "share_win_invite_clicks" ("clickId");
CREATE UNIQUE INDEX IF NOT EXISTS "share_win_invite_clicks_referredUserId_key"
    ON "share_win_invite_clicks" ("referredUserId");
CREATE INDEX IF NOT EXISTS "share_win_invite_clicks_referralCode_idx"
    ON "share_win_invite_clicks" ("referralCode");
CREATE INDEX IF NOT EXISTS "share_win_invite_clicks_referrerId_idx"
    ON "share_win_invite_clicks" ("referrerId");
CREATE INDEX IF NOT EXISTS "share_win_invite_clicks_createdAt_idx"
    ON "share_win_invite_clicks" ("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'share_win_invite_clicks_referrerId_fkey'
    ) THEN
        ALTER TABLE "share_win_invite_clicks"
            ADD CONSTRAINT "share_win_invite_clicks_referrerId_fkey"
            FOREIGN KEY ("referrerId") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'share_win_invite_clicks_referredUserId_fkey'
    ) THEN
        ALTER TABLE "share_win_invite_clicks"
            ADD CONSTRAINT "share_win_invite_clicks_referredUserId_fkey"
            FOREIGN KEY ("referredUserId") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- ─── Claim attempts (audit) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "share_win_claim_attempts" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT,
    "code"          TEXT,
    "clickId"       TEXT,
    "source"        TEXT NOT NULL DEFAULT 'manual',
    "result"        "ShareWinClaimResult" NOT NULL,
    "reasonDetail"  TEXT,
    "appVersion"    TEXT,
    "platform"      TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_win_claim_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "share_win_claim_attempts_createdAt_idx"
    ON "share_win_claim_attempts" ("createdAt");
CREATE INDEX IF NOT EXISTS "share_win_claim_attempts_result_idx"
    ON "share_win_claim_attempts" ("result");
CREATE INDEX IF NOT EXISTS "share_win_claim_attempts_userId_idx"
    ON "share_win_claim_attempts" ("userId");
CREATE INDEX IF NOT EXISTS "share_win_claim_attempts_clickId_idx"
    ON "share_win_claim_attempts" ("clickId");

-- ─── Link referrals → click (nullable for legacy rows) ──────────────────────
ALTER TABLE "share_win_referrals" ADD COLUMN IF NOT EXISTS "clickId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "share_win_referrals_clickId_key"
    ON "share_win_referrals" ("clickId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'share_win_referrals_clickId_fkey'
    ) THEN
        ALTER TABLE "share_win_referrals"
            ADD CONSTRAINT "share_win_referrals_clickId_fkey"
            FOREIGN KEY ("clickId") REFERENCES "share_win_invite_clicks"("clickId")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
