/**
 * Legacy API-Football work in otherLeaguesSync duplicates the dedicated
 * calendar/live authorities. It is opt-in only for emergency rollback.
 */
export function areLegacyOtherLeagueApiJobsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.OTHER_LEAGUES_API_FOOTBALL_JOBS_ENABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}
