-- CreateTable
CREATE TABLE "player_info" (
    "id" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "displayName" TEXT,
    "apiPlayerId" INTEGER,
    "queryType" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "questionSample" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "apiFingerprint" TEXT NOT NULL,
    "apiContext" TEXT NOT NULL,
    "usedModel" TEXT,
    "answeredOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_info_playerName_queryType_language_key" ON "player_info"("playerName", "queryType", "language");

-- CreateIndex
CREATE INDEX "player_info_playerName_idx" ON "player_info"("playerName");

-- CreateIndex
CREATE INDEX "player_info_answeredOn_idx" ON "player_info"("answeredOn");

-- CreateIndex
CREATE INDEX "player_info_expiresAt_idx" ON "player_info"("expiresAt");
