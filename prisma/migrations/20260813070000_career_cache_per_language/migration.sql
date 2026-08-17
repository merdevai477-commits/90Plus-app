-- 365 career rows are language-scoped.
--
-- The table was unique on "athleteId" alone while carrying a "langId" column,
-- so a player could be cached in exactly ONE language at a time and every
-- upsert in the other language overwrote it. Keying on the pair lets both
-- languages coexist.

-- Defensive: if two rows for the same (athleteId, langId) ever slipped in,
-- keep the most recently updated one so the unique index can be created.
DELETE FROM "cached_365_player_career" a
      USING "cached_365_player_career" b
      WHERE a."athleteId" = b."athleteId"
        AND a."langId" = b."langId"
        AND (a."updatedAt", a."id") < (b."updatedAt", b."id");

DROP INDEX IF EXISTS "cached_365_player_career_athleteId_key";

CREATE UNIQUE INDEX "cached_365_player_career_athleteId_langId_key"
    ON "cached_365_player_career" ("athleteId", "langId");

CREATE INDEX "cached_365_player_career_langId_idx"
    ON "cached_365_player_career" ("langId");
