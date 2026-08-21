/**
 * Bounded counters for match-chat (fixed keys, no unbounded Maps).
 */

import { logger } from '../../utils/logger';

const counters = {
  accepted: 0,
  rejected: 0,
  rateLimited: 0,
  frozen: 0,
  moderationBlocked: 0,
  unauthorized: 0,
  persistOk: 0,
  persistFail: 0,
  historyRedis: 0,
  historyPg: 0,
};

export type MatchChatMetric = keyof typeof counters;

export function matchChatIncr(metric: MatchChatMetric, n = 1): void {
  counters[metric] += n;
}

export function getMatchChatMetrics(): Readonly<typeof counters> {
  return { ...counters };
}

export function resetMatchChatMetrics(): void {
  (Object.keys(counters) as MatchChatMetric[]).forEach((k) => {
    counters[k] = 0;
  });
}

export function logMatchChatMetrics(): void {
  logger.info('[match-chat] metrics', getMatchChatMetrics());
}
