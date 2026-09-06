-- One-time teams onboarding completion timestamp (Favorites seed).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teamOnboardingCompletedAt" TIMESTAMP(3);
