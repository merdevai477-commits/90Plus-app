-- CreateEnum
CREATE TYPE "CommunityContentStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED');

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "reportedCommunityCommentId" TEXT,
ADD COLUMN     "reportedCommunityPostId" TEXT;

-- CreateTable
CREATE TABLE "community_posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageStoragePath" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "imagePlaceholder" TEXT,
    "status" "CommunityContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "reportsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "status" "CommunityContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "repliesCount" INTEGER NOT NULL DEFAULT 0,
    "reportsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_post_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_comment_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_shares" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_mentions" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "mentionedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_post_hashtags" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "hashtagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_post_hashtags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "placeholder" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "attachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_posts_status_createdAt_id_idx" ON "community_posts"("status", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "community_posts_userId_createdAt_idx" ON "community_posts"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_comments_postId_parentId_createdAt_idx" ON "community_comments"("postId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "community_comments_parentId_createdAt_idx" ON "community_comments"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "community_comments_userId_createdAt_idx" ON "community_comments"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "community_post_likes_postId_idx" ON "community_post_likes"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "community_post_likes_userId_postId_key" ON "community_post_likes"("userId", "postId");

-- CreateIndex
CREATE INDEX "community_comment_likes_commentId_idx" ON "community_comment_likes"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "community_comment_likes_userId_commentId_key" ON "community_comment_likes"("userId", "commentId");

-- CreateIndex
CREATE INDEX "community_shares_postId_idx" ON "community_shares"("postId");

-- CreateIndex
CREATE INDEX "community_shares_userId_createdAt_idx" ON "community_shares"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "community_mentions_postId_idx" ON "community_mentions"("postId");

-- CreateIndex
CREATE INDEX "community_mentions_commentId_idx" ON "community_mentions"("commentId");

-- CreateIndex
CREATE INDEX "community_mentions_mentionedUserId_idx" ON "community_mentions"("mentionedUserId");

-- CreateIndex
CREATE INDEX "community_post_hashtags_hashtagId_createdAt_idx" ON "community_post_hashtags"("hashtagId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "community_post_hashtags_postId_hashtagId_key" ON "community_post_hashtags"("postId", "hashtagId");

-- CreateIndex
CREATE INDEX "community_media_userId_createdAt_idx" ON "community_media"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "community_media_attachedAt_createdAt_idx" ON "community_media"("attachedAt", "createdAt");

-- CreateIndex
CREATE INDEX "reports_reportedCommunityPostId_idx" ON "reports"("reportedCommunityPostId");

-- CreateIndex
CREATE INDEX "reports_reportedCommunityCommentId_idx" ON "reports"("reportedCommunityCommentId");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reportedCommunityPostId_fkey" FOREIGN KEY ("reportedCommunityPostId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reportedCommunityCommentId_fkey" FOREIGN KEY ("reportedCommunityCommentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_likes" ADD CONSTRAINT "community_post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_likes" ADD CONSTRAINT "community_post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comment_likes" ADD CONSTRAINT "community_comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comment_likes" ADD CONSTRAINT "community_comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_shares" ADD CONSTRAINT "community_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_shares" ADD CONSTRAINT "community_shares_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_mentions" ADD CONSTRAINT "community_mentions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_mentions" ADD CONSTRAINT "community_mentions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_mentions" ADD CONSTRAINT "community_mentions_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_hashtags" ADD CONSTRAINT "community_post_hashtags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_hashtags" ADD CONSTRAINT "community_post_hashtags_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_media" ADD CONSTRAINT "community_media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

