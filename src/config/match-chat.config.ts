/**
 * Live match chat — all tunables live here (env overrides, no magic numbers in handlers).
 */

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function envFloat(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** ~1 msg / 1.5s → 0.67 tokens per second */
const perSec = envFloat('MATCH_CHAT_PER_SEC', 0.67, 0.1, 10);

export const MATCH_CHAT_CONFIG = {
  maxLength: envInt('MATCH_CHAT_MAX_LENGTH', 280, 40, 2000),
  perSec,
  /** Token-bucket refill interval derived from MATCH_CHAT_PER_SEC */
  refillIntervalMs: Math.round(1000 / perSec),
  perMin: envInt('MATCH_CHAT_PER_MIN', 20, 5, 200),
  burst: envInt('MATCH_CHAT_BURST', 3, 1, 20),
  freezeMs: envInt('MATCH_CHAT_FREEZE_MS', 180_000, 30_000, 3_600_000),
  historySize: envInt('MATCH_CHAT_HISTORY', 50, 10, 200),
  /** Redis recent-list + freeze/presence TTL: typical match + buffer */
  recentTtlSec: envInt('MATCH_CHAT_RECENT_TTL_SEC', 6 * 3600, 3600, 48 * 3600),
  idempotencyTtlSec: envInt('MATCH_CHAT_IDEM_TTL_SEC', 120, 30, 600),
  rateKeyTtlSec: 120,
  ipConnectPerMin: envInt('MATCH_CHAT_IP_CONNECT_PER_MIN', 30, 5, 200),
  ipSendPerMin: envInt('MATCH_CHAT_IP_SEND_PER_MIN', 60, 10, 400),
  presenceCap: envInt('MATCH_CHAT_PRESENCE_CAP', 5000, 100, 20_000),
  presenceTtlSec: envInt('MATCH_CHAT_PRESENCE_TTL_SEC', 120, 30, 600),
  strikeWindowSec: envInt('MATCH_CHAT_STRIKE_WINDOW_SEC', 6 * 3600, 600, 86_400),
  warnStrikes: 1,
  freezeStrikes: 2,
  namespace: '/match-chat',
  roomPrefix: 'match-chat:',
  userRoomPrefix: 'match-chat-user:',
} as const;

export function matchChatRoom(matchId: number): string {
  return `${MATCH_CHAT_CONFIG.roomPrefix}${matchId}`;
}

export function matchChatUserRoom(userId: string): string {
  return `${MATCH_CHAT_CONFIG.userRoomPrefix}${userId}`;
}

export const MATCH_CHAT_REDIS_KEYS = {
  recent: (matchId: number) => `chat:match:${matchId}:recent`,
  presence: (matchId: number) => `chat:match:${matchId}:presence`,
  userRate: (userId: string) => `chat:user:${userId}:rate`,
  userMinute: (userId: string) => `chat:user:${userId}:rate:min`,
  ipRate: (userId: string, ip: string) => `chat:user:${userId}:ip:${ip}:rate`,
  ipMinute: (userId: string, ip: string) => `chat:user:${userId}:ip:${ip}:rate:min`,
  ipConnect: (ip: string) => `chat:ip:${ip}:connect`,
  moderation: (userId: string) => `chat:user:${userId}:moderation`,
  freeze: (userId: string) => `chat:user:${userId}:freeze`,
  idem: (userId: string, clientMessageId: string) => `chat:idem:${userId}:${clientMessageId}`,
} as const;
