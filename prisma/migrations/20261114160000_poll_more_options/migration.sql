-- Polls can have more than two options. Existing A/B polls stay valid.

ALTER TABLE "community_posts" ADD COLUMN "pollOptions" JSONB;
ALTER TABLE "community_posts" ADD COLUMN "pollVoteCounts" JSONB;

UPDATE "community_posts"
SET
  "pollOptions" = jsonb_build_array("pollOptionA", "pollOptionB"),
  "pollVoteCounts" = jsonb_build_array("pollVotesA", "pollVotesB")
WHERE "kind" = 'TEAM_POLL'
  AND "pollOptionA" IS NOT NULL
  AND "pollOptionB" IS NOT NULL
  AND "pollOptions" IS NULL;

ALTER TABLE "community_post_poll_votes" ADD COLUMN "optionIndex" INTEGER;
ALTER TABLE "community_post_poll_votes" ALTER COLUMN "choice" DROP NOT NULL;

UPDATE "community_post_poll_votes"
SET "optionIndex" = CASE WHEN "choice" = 'B' THEN 1 ELSE 0 END
WHERE "optionIndex" IS NULL;

CREATE INDEX "community_post_poll_votes_postId_optionIndex_idx"
  ON "community_post_poll_votes"("postId", "optionIndex");
