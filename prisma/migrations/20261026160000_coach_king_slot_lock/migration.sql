-- King of Coaches: every pick is confirmed and locked on its own for the gameweek,
-- and keeps the price it was bought at.
ALTER TABLE "coach_king_squads" ADD COLUMN IF NOT EXISTS "coachLockedAt" TIMESTAMP(3);
ALTER TABLE "coach_king_squads" ADD COLUMN IF NOT EXISTS "coachPriceMilli" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "coach_king_squad_slots" ADD COLUMN IF NOT EXISTS "priceMilli" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "coach_king_squad_slots" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
