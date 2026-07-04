-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PredictionGroupType" AS ENUM ('PRIVATE', 'PUBLIC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PredictionGroupRole" AS ENUM ('OWNER', 'MEMBER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "prediction_groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "imageUrl" TEXT,
  "inviteCode" TEXT NOT NULL,
  "visibility" "PredictionGroupType" NOT NULL DEFAULT 'PRIVATE',
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prediction_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "prediction_group_members" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "PredictionGroupRole" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prediction_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "prediction_groups_inviteCode_key" ON "prediction_groups"("inviteCode");
CREATE INDEX IF NOT EXISTS "prediction_groups_ownerId_idx" ON "prediction_groups"("ownerId");
CREATE INDEX IF NOT EXISTS "prediction_groups_visibility_idx" ON "prediction_groups"("visibility");
CREATE INDEX IF NOT EXISTS "prediction_groups_createdAt_idx" ON "prediction_groups"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "prediction_group_members_groupId_userId_key" ON "prediction_group_members"("groupId", "userId");
CREATE INDEX IF NOT EXISTS "prediction_group_members_groupId_idx" ON "prediction_group_members"("groupId");
CREATE INDEX IF NOT EXISTS "prediction_group_members_userId_idx" ON "prediction_group_members"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "prediction_groups"
    ADD CONSTRAINT "prediction_groups_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "prediction_group_members"
    ADD CONSTRAINT "prediction_group_members_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "prediction_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "prediction_group_members"
    ADD CONSTRAINT "prediction_group_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
