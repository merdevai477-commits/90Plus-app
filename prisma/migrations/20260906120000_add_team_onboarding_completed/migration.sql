-- One-time teams onboarding completion timestamp (Favorites seed).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "teamOnboardingCompletedAt" TIMESTAMP(3);
