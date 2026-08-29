-- Cash prize amount (EGP) for the Predict & Win sponsor wizard.
ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "prizeCashAmount" INTEGER;
