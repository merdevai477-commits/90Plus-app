/**
 * When true, match calendar/details/live reads use 365Scores only.
 * API-Football upstream is not queried for fixture data (DB/Redis cache still served).
 *
 * Set SCORES365_ONLY_MODE=false to re-enable API-Football fallbacks.
 * When unset, defaults to on while SCORES365_EXPERIMENT_ENABLED is on.
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
