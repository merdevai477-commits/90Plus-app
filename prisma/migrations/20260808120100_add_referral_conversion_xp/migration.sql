-- Add REFERRAL_CONVERSION to XpActionType — Share & Win awards the referrer XP
-- when a referred friend completes registration.
-- Kept in its own migration: ALTER TYPE ... ADD VALUE cannot share a
-- transaction with statements that use the new value.
ALTER TYPE "XpActionType" ADD VALUE IF NOT EXISTS 'REFERRAL_CONVERSION';
