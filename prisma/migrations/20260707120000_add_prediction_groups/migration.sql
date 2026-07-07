-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "GroupInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GroupRoundStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED');

-- CreateEnum
CREATE TYPE "GroupPredictionMode" AS ENUM ('WINNER', 'EXACT');

-- AlterEnum
ALTER TYPE "XpActionType" ADD VALUE IF NOT EXISTS 'GROUP_PREDICTION_WINNER';
ALTER TYPE "XpActionType" ADD VALUE IF NOT EXISTS 'GROUP_PREDICTION_EXACT';

-- CreateTable
CREATE TABLE "prediction_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "inviteCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prediction_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "groupXpTotal" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_invites" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "GroupInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_rounds" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "matchIds" JSONB NOT NULL,
    "status" "GroupRoundStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_predictions" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiMatchId" INTEGER NOT NULL,
    "mode" "GroupPredictionMode" NOT NULL,
    "predictedWinner" TEXT,
    "predictedHomeScore" INTEGER,
    "predictedAwayScore" INTEGER,
    "isCorrect" BOOLEAN,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prediction_groups_inviteCode_key" ON "prediction_groups"("inviteCode");

-- CreateIndex
CREATE INDEX "prediction_groups_ownerId_idx" ON "prediction_groups"("ownerId");

-- CreateIndex
CREATE INDEX "group_members_groupId_idx" ON "group_members"("groupId");

-- CreateIndex
CREATE INDEX "group_members_userId_idx" ON "group_members"("userId");

-- CreateIndex
CREATE INDEX "group_members_groupId_groupXpTotal_idx" ON "group_members"("groupId", "groupXpTotal" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "group_invites_groupId_inviteeId_key" ON "group_invites"("groupId", "inviteeId");

-- CreateIndex
CREATE INDEX "group_invites_inviteeId_status_idx" ON "group_invites"("inviteeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "group_rounds_date_key" ON "group_rounds"("date");

-- CreateIndex
CREATE INDEX "group_predictions_roundId_idx" ON "group_predictions"("roundId");

-- CreateIndex
CREATE INDEX "group_predictions_groupId_idx" ON "group_predictions"("groupId");

-- CreateIndex
CREATE INDEX "group_predictions_apiMatchId_idx" ON "group_predictions"("apiMatchId");

-- CreateIndex
CREATE INDEX "group_predictions_userId_idx" ON "group_predictions"("userId");

-- CreateIndex
CREATE INDEX "group_predictions_settledAt_idx" ON "group_predictions"("settledAt");

-- CreateIndex
CREATE UNIQUE INDEX "group_predictions_userId_roundId_apiMatchId_key" ON "group_predictions"("userId", "roundId", "apiMatchId");

-- AddForeignKey
ALTER TABLE "prediction_groups" ADD CONSTRAINT "prediction_groups_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "prediction_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "prediction_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_predictions" ADD CONSTRAINT "group_predictions_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "group_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_predictions" ADD CONSTRAINT "group_predictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
