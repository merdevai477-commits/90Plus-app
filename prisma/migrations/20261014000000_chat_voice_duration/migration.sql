-- Voice quota moves from a count of recordings to a daily allowance of seconds.
-- Each operation records the milliseconds it charges. Additive: existing rows
-- default to 0, so recordings made under the old count-based policy neither
-- inflate nor refund anyone's new allowance.
ALTER TABLE "chat_voice_operations"
    ADD COLUMN IF NOT EXISTS "durationMs" INTEGER NOT NULL DEFAULT 0;
