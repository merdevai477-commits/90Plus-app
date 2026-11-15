/**
 * Global Live Match Tracker (SportRadar / 365Scores pitch) kill switch.
 *
 * Set LMT_DISABLED=true|1 to hide pitch tracking for every client until a
 * store/OTA build ships with 90PLUS branding. Clients treat 404 as "no pitch".
 */
export function isLmtGloballyDisabled(): boolean {
  const raw = String(process.env.LMT_DISABLED ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}
