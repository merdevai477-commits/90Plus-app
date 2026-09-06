/**
 * When true, 365Scores owns calendar + live ticks. Periodic API-Football
 * calendar/live-sync jobs stay off so the ~98/day quota is not burned.
 *
 * Last-resort API-Football rescue (details miss, empty 365 feed, missing live
 * Redis snapshot) still runs via quota purpose `fallback` even when this is on.
 *
 * Set SCORES365_ONLY_MODE=false only to re-enable background API-Football
 * calendar refresh. When unset, defaults to on while SCORES365_EXPERIMENT_ENABLED is on.
 */
function readExperimentEnabled(env: NodeJS.ProcessEnv): boolean {
  const raw = env.SCORES365_EXPERIMENT_ENABLED?.trim();
  return raw === 'true' || raw === '1';
}

export function isScores365OnlyMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.SCORES365_ONLY_MODE?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  if (raw === 'true' || raw === '1') return true;
  return readExperimentEnabled(env);
}
