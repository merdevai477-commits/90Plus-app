-- One King of the Game row and one King of Results row can share a match.
-- A scoreline is an exact pick; everything else stays a winner pick.

ALTER TABLE "predictions" ADD COLUMN "kingMode" TEXT;

UPDATE "predictions"
SET "kingMode" = CASE
  WHEN "predictedHomeScore" IS NOT NULL AND "predictedAwayScore" IS NOT NULL THEN 'exact'
  ELSE 'winner'
END
WHERE "kingMode" IS NULL;

ALTER TABLE "predictions" ALTER COLUMN "kingMode" SET NOT NULL;

DROP INDEX IF EXISTS "predictions_userId_apiMatchId_key";
DROP INDEX IF EXISTS "predictions_userId_canonicalFixtureKey_key";

CREATE UNIQUE INDEX "predictions_userId_apiMatchId_kingMode_key"
  ON "predictions"("userId", "apiMatchId", "kingMode");

CREATE UNIQUE INDEX "predictions_userId_canonicalFixtureKey_kingMode_key"
  ON "predictions"("userId", "canonicalFixtureKey", "kingMode");
