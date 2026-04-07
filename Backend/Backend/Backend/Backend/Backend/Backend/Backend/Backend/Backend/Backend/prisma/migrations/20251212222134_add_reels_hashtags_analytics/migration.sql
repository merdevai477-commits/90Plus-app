-- AlterTable
ALTER TABLE "users" ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "coverStoragePath" TEXT,
ADD COLUMN     "lastAvatarChange" TIMESTAMP(3),
ADD COLUMN     "lastCoverChange" TIMESTAMP(3),
ADD COLUMN     "lastReelUpload" TIMESTAMP(3),
ADD COLUMN     "profileViews" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "hashtags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reelCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reel_hashtags" (
    "id" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "hashtagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reel_hashtags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reel_mentions" (
    "id" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reel_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hashtags_name_key" ON "hashtags"("name");

-- CreateIndex
CREATE INDEX "hashtags_name_idx" ON "hashtags"("name");

-- CreateIndex
CREATE INDEX "hashtags_reelCount_idx" ON "hashtags"("reelCount");

-- CreateIndex
CREATE INDEX "reel_hashtags_reelId_idx" ON "reel_hashtags"("reelId");

-- CreateIndex
CREATE INDEX "reel_hashtags_hashtagId_idx" ON "reel_hashtags"("hashtagId");

-- CreateIndex
CREATE UNIQUE INDEX "reel_hashtags_reelId_hashtagId_key" ON "reel_hashtags"("reelId", "hashtagId");

-- CreateIndex
CREATE INDEX "reel_mentions_reelId_idx" ON "reel_mentions"("reelId");

-- CreateIndex
CREATE INDEX "reel_mentions_mentionedUserId_idx" ON "reel_mentions"("mentionedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "reel_mentions_reelId_mentionedUserId_key" ON "reel_mentions"("reelId", "mentionedUserId");

-- AddForeignKey
ALTER TABLE "reel_hashtags" ADD CONSTRAINT "reel_hashtags_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "reels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reel_hashtags" ADD CONSTRAINT "reel_hashtags_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reel_mentions" ADD CONSTRAINT "reel_mentions_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "reels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
