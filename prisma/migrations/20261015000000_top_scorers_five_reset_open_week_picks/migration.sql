-- Every gameweek starts with an empty lineup. Unconfirmed picks in a gameweek
-- that is still open were copied in from the previous week; drop them so those
-- users start the week empty. Confirmed picks and closed gameweeks are kept.
DELETE FROM "top_scorers_five_selections" s
USING "top_scorers_five_gameweeks" g
WHERE s."gameweekId" = g."id"
  AND s."confirmedAt" IS NULL
  AND g."status" = 'OPEN'
  AND g."lockAt" > NOW();
