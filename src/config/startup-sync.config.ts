/**
 * Emergency boot guard — skips *immediate* heavy sync/preload work on process start.
 * Scheduled crons / intervals keep running so data can catch up on their normal cadence.
 *
 * Railway Variables: STARTUP_SYNC_DISABLED=true
 * Re-enable boot syncs later: STARTUP_SYNC_DISABLED=false (or unset)
 */
export function isStartupSyncDisabled(): boolean {
  const raw = process.env.STARTUP_SYNC_DISABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}
