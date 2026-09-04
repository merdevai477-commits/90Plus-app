/**
 * Cadence for /app/features hydrate while waiting for World Cup unlock (A6).
 * Returns 5s only in the final 2 minutes BEFORE unlock; never latches after.
 */
export function getAppFeaturesPollPeriodMs(
  nowMs: number,
  unlockAtMs: number,
): number {
  if (!Number.isFinite(unlockAtMs) || unlockAtMs <= 0) return 30_000;
  if (nowMs >= unlockAtMs + 60_000) return 30_000;
  const msLeft = unlockAtMs - nowMs;
  if (msLeft > 0 && msLeft <= 120_000) return 5_000;
  return 30_000;
}
