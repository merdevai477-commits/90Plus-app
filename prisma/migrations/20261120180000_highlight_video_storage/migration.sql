-- Metadata for owned highlight copies. Video bytes are never stored here.

CREATE TABLE "highlight_stored_assets" (
    "id" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageStatus" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "duration" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "highlight_stored_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "highlight_stored_assets_checksum_key" ON "highlight_stored_assets"("checksum");
CREATE UNIQUE INDEX "highlight_stored_assets_storageKey_key" ON "highlight_stored_assets"("storageKey");
CREATE INDEX "highlight_stored_assets_storageStatus_idx" ON "highlight_stored_assets"("storageStatus");

CREATE TABLE "highlight_ingestions" (
    "id" TEXT NOT NULL,
    "highlightlyId" INTEGER NOT NULL,
    "fixtureId" INTEGER,
    "originalUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assetId" TEXT,
    "lastErrorCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "highlight_ingestions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "highlight_ingestions_highlightlyId_key" ON "highlight_ingestions"("highlightlyId");
CREATE INDEX "highlight_ingestions_fixtureId_status_idx" ON "highlight_ingestions"("fixtureId", "status");
CREATE INDEX "highlight_ingestions_status_idx" ON "highlight_ingestions"("status");
CREATE INDEX "highlight_ingestions_assetId_idx" ON "highlight_ingestions"("assetId");

ALTER TABLE "highlight_ingestions"
ADD CONSTRAINT "highlight_ingestions_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "highlight_stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
