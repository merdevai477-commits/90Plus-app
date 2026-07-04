/**
 * Centralized prediction window config (override from cloud env).
 *
 * Window model:
 * - Matches included in groups endpoint are fetched within [now - pastDays, now + futureDays].
 * - Users can submit prediction only if match starts after now and within submitLeadHours.
 */

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export const PREDICTION_WINDOW_PAST_DAYS = readPositiveIntEnv('PREDICTION_WINDOW_PAST_DAYS', 2);
export const PREDICTION_WINDOW_FUTURE_DAYS = readPositiveIntEnv('PREDICTION_WINDOW_FUTURE_DAYS', 7);

/**
 * How many hours before kickoff prediction remains allowed.
 * 0 = allowed until kickoff, 24 = must predict at least 24h before start.
 */
export const PREDICTION_SUBMIT_LEAD_HOURS = readPositiveIntEnv('PREDICTION_SUBMIT_LEAD_HOURS', 0);

export const FINISHED_MATCH_STATUSES = ['FT', 'AET', 'PEN'] as const;
export const LIVE_MATCH_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'] as const;
export const UPCOMING_MATCH_STATUSES = ['NS', 'TBD'] as const;

export function isPredictionSubmissionOpen(matchDate: Date, now = new Date()): boolean {
  const cutoff = new Date(matchDate.getTime() - PREDICTION_SUBMIT_LEAD_HOURS * 60 * 60 * 1000);
  return now < cutoff;
}
