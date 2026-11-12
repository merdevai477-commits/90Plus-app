-- Persistent squads and a per-user 7-day edit lock.
-- Existing lineups are copied and left unlocked. Past score rows are not rewritten.

ALTER TABLE "top_scorers_five_selections" ADD COLUMN "legacyThrough" TIMESTAMP(3);

ALTER TABLE "coach_king_squads" ADD COLUMN "unlocksAt" TIMESTAMP(3);
ALTER TABLE "coach_king_squads" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "coach_king_squads" ADD COLUMN "isLive" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "top_scorers_five_squads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "unlocksAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "top_scorers_five_squads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "top_scorers_five_squad_members" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),
    "legacyThrough" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "top_scorers_five_squad_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "top_scorers_five_squad_drafts" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "playerId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "top_scorers_five_squad_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_king_memberships" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "slotKey" TEXT,
    "playerId" TEXT,
    "coachId" TEXT,
    "selectedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),
    "priceMilli" INTEGER NOT NULL DEFAULT 0,
    "legacyThrough" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coach_king_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_king_week_payouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coach_king_week_payouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "top_scorers_five_squads_userId_scopeKey_key" ON "top_scorers_five_squads"("userId", "scopeKey");
CREATE INDEX "top_scorers_five_squads_userId_idx" ON "top_scorers_five_squads"("userId");
CREATE INDEX "top_scorers_five_squad_members_squadId_removedAt_idx" ON "top_scorers_five_squad_members"("squadId", "removedAt");
CREATE INDEX "top_scorers_five_squad_members_playerId_idx" ON "top_scorers_five_squad_members"("playerId");
CREATE UNIQUE INDEX "top_scorers_five_squad_drafts_squadId_slotKey_key" ON "top_scorers_five_squad_drafts"("squadId", "slotKey");
CREATE INDEX "coach_king_memberships_squadId_removedAt_idx" ON "coach_king_memberships"("squadId", "removedAt");
CREATE INDEX "coach_king_memberships_playerId_idx" ON "coach_king_memberships"("playerId");
CREATE INDEX "coach_king_memberships_coachId_idx" ON "coach_king_memberships"("coachId");
CREATE UNIQUE INDEX "coach_king_week_payouts_userId_gameweekId_key" ON "coach_king_week_payouts"("userId", "gameweekId");
CREATE INDEX "coach_king_week_payouts_gameweekId_idx" ON "coach_king_week_payouts"("gameweekId");
CREATE UNIQUE INDEX "coach_king_squads_one_live_per_user" ON "coach_king_squads"("userId") WHERE "isLive" = true;

ALTER TABLE "top_scorers_five_squads" ADD CONSTRAINT "top_scorers_five_squads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "top_scorers_five_squad_members" ADD CONSTRAINT "top_scorers_five_squad_members_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "top_scorers_five_squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "top_scorers_five_squad_members" ADD CONSTRAINT "top_scorers_five_squad_members_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "top_scorers_five_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "top_scorers_five_squad_drafts" ADD CONSTRAINT "top_scorers_five_squad_drafts_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "top_scorers_five_squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "top_scorers_five_squad_drafts" ADD CONSTRAINT "top_scorers_five_squad_drafts_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "top_scorers_five_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coach_king_memberships" ADD CONSTRAINT "coach_king_memberships_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "coach_king_squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_king_memberships" ADD CONSTRAINT "coach_king_memberships_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "coach_king_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coach_king_memberships" ADD CONSTRAINT "coach_king_memberships_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_king_coaches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coach_king_week_payouts" ADD CONSTRAINT "coach_king_week_payouts_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "coach_king_gameweeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Past performances stay on the old selection rows.
UPDATE "top_scorers_five_selections" SET "legacyThrough" = CURRENT_TIMESTAMP WHERE "legacyThrough" IS NULL;

INSERT INTO "top_scorers_five_squads" ("id", "userId", "scopeKey", "confirmedAt", "unlocksAt", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       grouped."userId",
       grouped.scope,
       grouped.confirmed,
       NULL,
       0,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM (
    SELECT s."userId",
           CASE WHEN s."leagueKey" LIKE 'egypt%' THEN 'egypt' ELSE s."leagueKey" END AS scope,
           MAX(s."confirmedAt") AS confirmed
    FROM "top_scorers_five_selections" s
    GROUP BY s."userId", CASE WHEN s."leagueKey" LIKE 'egypt%' THEN 'egypt' ELSE s."leagueKey" END
) grouped
WHERE NOT EXISTS (
    SELECT 1 FROM "top_scorers_five_squads" sq
    WHERE sq."userId" = grouped."userId" AND sq."scopeKey" = grouped.scope
);

INSERT INTO "top_scorers_five_squad_members" ("id", "squadId", "slotKey", "playerId", "selectedAt", "removedAt", "legacyThrough", "createdAt")
SELECT gen_random_uuid()::text,
       sq."id",
       latest."leagueKey",
       latest."playerId",
       COALESCE(latest."confirmedAt", latest."createdAt"),
       NULL,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (sel."userId", sel."leagueKey")
           sel."userId",
           sel."leagueKey",
           sel."playerId",
           sel."confirmedAt",
           sel."createdAt",
           CASE WHEN sel."leagueKey" LIKE 'egypt%' THEN 'egypt' ELSE sel."leagueKey" END AS scope
    FROM "top_scorers_five_selections" sel
    JOIN "top_scorers_five_gameweeks" gw ON gw."id" = sel."gameweekId"
    ORDER BY sel."userId", sel."leagueKey", gw."startAt" DESC, sel."createdAt" DESC
) latest
JOIN "top_scorers_five_squads" sq
  ON sq."userId" = latest."userId" AND sq."scopeKey" = latest.scope
WHERE NOT EXISTS (
    SELECT 1 FROM "top_scorers_five_squad_members" existing
    WHERE existing."squadId" = sq."id"
      AND existing."slotKey" = latest."leagueKey"
      AND existing."removedAt" IS NULL
);

UPDATE "coach_king_squads" AS live
SET "isLive" = true,
    "unlocksAt" = NULL
WHERE live."id" IN (
    SELECT DISTINCT ON (sq."userId") sq."id"
    FROM "coach_king_squads" sq
    JOIN "coach_king_gameweeks" gw ON gw."id" = sq."gameweekId"
    ORDER BY sq."userId", gw."startAt" DESC, sq."createdAt" DESC
);

INSERT INTO "coach_king_memberships" ("id", "squadId", "slotKey", "playerId", "coachId", "selectedAt", "removedAt", "priceMilli", "legacyThrough", "createdAt")
SELECT gen_random_uuid()::text,
       slot."squadId",
       slot."slotKey",
       slot."playerId",
       NULL,
       COALESCE(slot."lockedAt", sq."confirmedAt", sq."createdAt"),
       NULL,
       COALESCE(slot."priceMilli", 0),
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "coach_king_squad_slots" slot
JOIN "coach_king_squads" sq ON sq."id" = slot."squadId"
WHERE sq."isLive" = true
  AND NOT EXISTS (
    SELECT 1 FROM "coach_king_memberships" existing
    WHERE existing."squadId" = sq."id"
      AND existing."slotKey" = slot."slotKey"
      AND existing."removedAt" IS NULL
  );

INSERT INTO "coach_king_memberships" ("id", "squadId", "slotKey", "playerId", "coachId", "selectedAt", "removedAt", "priceMilli", "legacyThrough", "createdAt")
SELECT gen_random_uuid()::text,
       sq."id",
       NULL,
       NULL,
       sq."coachId",
       COALESCE(sq."coachLockedAt", sq."confirmedAt", sq."createdAt"),
       NULL,
       COALESCE(sq."coachPriceMilli", 0),
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "coach_king_squads" sq
WHERE sq."isLive" = true AND sq."coachId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "coach_king_memberships" existing
    WHERE existing."squadId" = sq."id"
      AND existing."slotKey" IS NULL
      AND existing."coachId" = sq."coachId"
      AND existing."removedAt" IS NULL
  );
