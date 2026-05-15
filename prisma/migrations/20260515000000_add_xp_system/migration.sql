-- CreateEnum
CREATE TYPE "XpActionType" AS ENUM (
  'PROFILE_AVATAR',
  'PROFILE_DISPLAY_NAME',
  'PROFILE_BIO',
  'PROFILE_SOCIAL_INSTAGRAM',
  'PROFILE_SOCIAL_TWITTER',
  'PROFILE_SOCIAL_TIKTOK',
  'PROFILE_SOCIAL_SNAPCHAT',
  'PROFILE_FIFA_POSITION',
  'PROFILE_FIFA_AGE',
  'PROFILE_FIFA_HEIGHT',
  'PROFILE_FIFA_WEIGHT',
  'PROFILE_FIFA_FOOT',
  'PROFILE_FIFA_COUNTRY',
  'PROFILE_FIFA_CLUB',
  'PROFILE_FIFA_BRAND',
  'PROFILE_FIFA_COMPLETE',
  'REEL_UPLOAD',
  'REEL_COMMENT',
  'REEL_SHARE',
  'REEL_VIEWS_100',
  'PREDICTION_EXACT',
  'PREDICTION_WINNER',
  'QUIZ_ANSWER_CORRECT',
  'QUIZ_COMPLETED_HIGH',
  'DAILY_LOGIN',
  'ADMIN_ADJUSTMENT'
);

-- CreateTable
CREATE TABLE "xp_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "XpActionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_daily_caps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "XpActionType" NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "xp_daily_caps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_streaks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "longest" INTEGER NOT NULL DEFAULT 0,
    "lastLoginDate" TEXT,

    CONSTRAINT "login_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "xp_transactions_userId_createdAt_idx" ON "xp_transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "xp_transactions_action_idx" ON "xp_transactions"("action");

-- CreateIndex
CREATE UNIQUE INDEX "xp_transactions_userId_idempotencyKey_key" ON "xp_transactions"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "xp_daily_caps_userId_action_date_key" ON "xp_daily_caps"("userId", "action", "date");

-- CreateIndex
CREATE INDEX "xp_daily_caps_userId_date_idx" ON "xp_daily_caps"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "login_streaks_userId_key" ON "login_streaks"("userId");

-- AddForeignKey
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_daily_caps" ADD CONSTRAINT "xp_daily_caps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_streaks" ADD CONSTRAINT "login_streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
