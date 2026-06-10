-- Add accent-insensitive normalized name key for player resolution.
ALTER TABLE "player_name_mapping" ADD COLUMN "normalizedName" TEXT NOT NULL DEFAULT '';

-- Backfill from englishName (app seed will refresh with full normalizeName logic).
UPDATE "player_name_mapping"
SET "normalizedName" = lower(
  regexp_replace(
    translate(
      "englishName",
      'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿÑñÇç',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuYyyNnCc'
    ),
    '[^a-z0-9\u0600-\u06FF]',
    '',
    'g'
  )
)
WHERE "normalizedName" = '';

CREATE INDEX "player_name_mapping_normalizedName_idx" ON "player_name_mapping"("normalizedName");
