-- AlterEnum
CREATE TYPE "CommunityPostKind" AS ENUM ('TEXT', 'TEAM_POLL');

-- AlterEnum
CREATE TYPE "CommunityPollChoice" AS ENUM ('A', 'B');

-- AlterTable
ALTER TABLE "community_posts" ADD COLUMN "kind" "CommunityPostKind" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "community_posts" ADD COLUMN "pollOptionA" TEXT;
ALTER TABLE "community_posts" ADD COLUMN "pollOptionB" TEXT;
ALTER TABLE "community_posts" ADD COLUMN "pollVotesA" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "community_posts" ADD COLUMN "pollVotesB" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "community_post_poll_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "choice" "CommunityPollChoice" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_post_poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_post_poll_votes_postId_idx" ON "community_post_poll_votes"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "community_post_poll_votes_userId_postId_key" ON "community_post_poll_votes"("userId", "postId");

-- AddForeignKey
ALTER TABLE "community_post_poll_votes" ADD CONSTRAINT "community_post_poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_poll_votes" ADD CONSTRAINT "community_post_poll_votes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
