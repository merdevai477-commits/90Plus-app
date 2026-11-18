-- Each league is its own five-player squad. The old Europe slot (`pl`) becomes `pl1`.
-- The 7-day lock moves onto the player, so the other four slots stay editable.

ALTER TABLE "top_scorers_five_squad_members" ADD COLUMN "lockedUntil" TIMESTAMP(3);

UPDATE "top_scorers_five_squad_members" AS member
SET "slotKey" = member."slotKey" || '1'
WHERE member."slotKey" IN ('pl', 'laliga', 'bundesliga', 'seriea', 'ligue1');

UPDATE "top_scorers_five_squad_members" AS member
SET "lockedUntil" = GREATEST(
  member."selectedAt" + INTERVAL '7 days',
  COALESCE(squad."unlocksAt", member."selectedAt")
)
FROM "top_scorers_five_squads" AS squad
WHERE member."squadId" = squad."id"
  AND member."removedAt" IS NULL
  AND member."lockedUntil" IS NULL;

UPDATE "top_scorers_five_squads" AS squad
SET "confirmedAt" = COALESCE(squad."confirmedAt", CURRENT_TIMESTAMP)
WHERE squad."confirmedAt" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "top_scorers_five_squad_members" AS member
    WHERE member."squadId" = squad."id"
      AND member."removedAt" IS NULL
  );
