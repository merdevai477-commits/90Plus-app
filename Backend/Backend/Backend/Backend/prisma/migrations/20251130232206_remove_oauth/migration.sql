/*
  Warnings:

  - You are about to drop the `oauth_accounts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "oauth_accounts" DROP CONSTRAINT "oauth_accounts_userId_fkey";

-- DropTable
DROP TABLE "oauth_accounts";

-- DropEnum
DROP TYPE "OAuthProvider";
