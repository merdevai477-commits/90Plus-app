/**
 * Monotonic generation guard for calendar writers (C2).
 * Capture at fetch start; skip apply if a newer date/fetch generation won.
 */
export function shouldApplyCalendarGeneration(
  capturedGeneration: number,
  currentGeneration: number,
): boolean {
  return capturedGeneration === currentGeneration;
}
