/**
 * Whether the squad countdown is shown.
 * `COACH_KING_SHOW_TIMER`: `auto` (default, visible only while the round is
 * closed), `on`, or `off`. The app does not decide this itself.
 */
export function coachKingTimerVisible(picksOpen: boolean, raw = process.env.COACH_KING_SHOW_TIMER): boolean {
  const value = (raw ?? 'auto').trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'on' || value === 'show') return true;
  if (value === '0' || value === 'false' || value === 'off' || value === 'hide') return false;
  return !picksOpen;
}
