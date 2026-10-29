/**
 * Push policy for King settlement (U1 backlog safety).
 *
 * PREDICTION_SETTLE_PUSH_MODE          live | inbox_only | off   (default live)
 * PREDICTION_SETTLE_PUSH_MAX_AGE_HOURS kickoff older than this settles silently (default 12)
 * PREDICTION_SETTLE_MAX_MATCHES_PER_TICK watcher cap per tick (default 25)
 */

export type SettlePushMode = 'live' | 'inbox_only' | 'off';

export type PushDecision =
  | { notify: true; skipPush: boolean; reason?: 'MODE_INBOX_ONLY' }
  | { notify: false; reason: 'MODE_OFF' | 'STALE' };

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function getSettlePushMode(): SettlePushMode {
  const v = (process.env.PREDICTION_SETTLE_PUSH_MODE || '').trim().toLowerCase();
  if (v === 'off' || v === 'inbox_only') return v;
  return 'live';
}

export function getPushMaxAgeHours(): number {
  return intEnv('PREDICTION_SETTLE_PUSH_MAX_AGE_HOURS', 12);
}

export function getMaxMatchesPerTick(): number {
  return intEnv('PREDICTION_SETTLE_MAX_MATCHES_PER_TICK', 25);
}

/** Whether a kickoff is too old for a live "your result" push. */
export function isStaleKickoff(matchDate: Date | null | undefined, now = new Date()): boolean {
  if (!matchDate) return false;
  const ageMs = now.getTime() - new Date(matchDate).getTime();
  return ageMs > getPushMaxAgeHours() * 3600_000;
}

export function decideResultPush(matchDate: Date | null | undefined, now = new Date()): PushDecision {
  const mode = getSettlePushMode();
  if (mode === 'off') return { notify: false, reason: 'MODE_OFF' };
  if (isStaleKickoff(matchDate, now)) return { notify: false, reason: 'STALE' };
  if (mode === 'inbox_only') return { notify: true, skipPush: true, reason: 'MODE_INBOX_ONLY' };
  return { notify: true, skipPush: false };
}

/** Leaderboard-entry pushes follow the same mode; stale-only batches stay silent. */
export function allowLeaderboardPush(): boolean {
  return getSettlePushMode() === 'live';
}
