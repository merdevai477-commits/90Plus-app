-- Curated daily match slate for King of the Game / King of Results.
-- When rows exist for a Cairo calendar day, that list replaces auto top-10 ranking.

CREATE TABLE IF NOT EXISTS "king_daily_slates" (
    "id"         TEXT NOT NULL,
    "cairoDay"   DATE NOT NULL,
    "apiMatchId" INTEGER NOT NULL,
    "sortOrder"  INTEGER NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "king_daily_slates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "king_daily_slates_cairoDay_apiMatchId_key"
    ON "king_daily_slates" ("cairoDay", "apiMatchId");

CREATE INDEX IF NOT EXISTS "king_daily_slates_cairoDay_sortOrder_idx"
    ON "king_daily_slates" ("cairoDay", "sortOrder");
