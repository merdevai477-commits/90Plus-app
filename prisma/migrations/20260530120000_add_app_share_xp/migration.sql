-- Add APP_SHARE to XpActionType for share-app reward (10 XP / 24h)
ALTER TYPE "XpActionType" ADD VALUE IF NOT EXISTS 'APP_SHARE';
