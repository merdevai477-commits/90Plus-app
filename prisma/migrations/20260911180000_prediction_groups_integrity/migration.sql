-- Prediction Groups integrity:
-- 1) One active membership per user (partial unique index)
-- 2) voidedAt for postponed/cancelled/abandoned predictions
--
-- Pre-check (production 2026-09-11): zero users with multiple leftAt IS NULL rows.
-- If conflicts appear later, this migration fails closed instead of deleting data.

DO $$
DECLARE
  conflict_count int;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM (
    SELECT "userId"
    FROM "group_members"
    WHERE "leftAt" IS NULL
    GROUP BY "userId"
    HAVING COUNT(*) > 1
  ) conflicts;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      'prediction_groups integrity: % user(s) have multiple active memberships. Resolve before applying unique index.',
      conflict_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "group_members_one_active_per_user_idx"
ON "group_members"("userId")
WHERE "leftAt" IS NULL;

ALTER TABLE "group_predictions"
ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "group_predictions_voidedAt_idx"
ON "group_predictions"("voidedAt");

CREATE INDEX IF NOT EXISTS "group_predictions_xp_retry_idx"
ON "group_predictions"("apiMatchId", "isCorrect", "xpAwarded", "voidedAt");
