-- CreateTable
CREATE TABLE "reel_views" (
    "id" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reel_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reel_views_reelId_userId_key" ON "reel_views"("reelId", "userId");

-- CreateIndex
CREATE INDEX "reel_views_reelId_idx" ON "reel_views"("reelId");

-- CreateIndex
CREATE INDEX "reel_views_userId_idx" ON "reel_views"("userId");

-- CreateIndex
CREATE INDEX "reel_views_viewedAt_idx" ON "reel_views"("viewedAt");

-- AddForeignKey
ALTER TABLE "reel_views" ADD CONSTRAINT "reel_views_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "reels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reel_views" ADD CONSTRAINT "reel_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

