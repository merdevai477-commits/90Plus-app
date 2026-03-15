-- AlterTable
ALTER TABLE "users" ADD COLUMN "lastLoginDate" TIMESTAMP(3),
ADD COLUMN "consecutiveLoginDays" INTEGER NOT NULL DEFAULT 0;

