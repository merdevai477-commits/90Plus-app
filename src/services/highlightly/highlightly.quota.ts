import { getRedisClient } from '../../lib/redis';
import { logger } from '../../utils/logger';
import { canSpendHighlightRequest } from './highlightly.policy';

const META_KEY = 'highlightly:meta';
const META_TTL_SEC = 60 * 60 * 48;
const DEFAULT_BUDGET = 80;
const DEFAULT_RESERVE = 20;

export interface QuotaState {
  day: string;
  used: number;
  upstreamRemaining: number | null;
  upstreamSampledAtMs: number | null;
  pausedUntilMs: number | null;
  tier: string | null;
  lastTickMs: number | null;
}

export interface HighlightAllowance {
  used: number;
  budget: number;
  upstreamRemaining: number | null;
  reserve: number;
  pausedUntilMs: number | null;
  tier: string | null;
  lastTickMs: number | null;
}

function emptyState(now: Date): QuotaState {
  return {
    day: utcDayKey(now),
    used: 0,
    upstreamRemaining: null,
    upstreamSampledAtMs: null,
    pausedUntilMs: null,
    tier: null,
    lastTickMs: null,
  };
}

let memory: QuotaState = emptyState(new Date());

export function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function nextUtcMidnightMs(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

export function highlightDailyBudget(): number {
  return readIntEnv('HIGHLIGHTLY_DAILY_BUDGET', DEFAULT_BUDGET, true);
}

export function highlightQuotaReserve(): number {
  return readIntEnv('HIGHLIGHTLY_QUOTA_RESERVE', DEFAULT_RESERVE, true);
}

function readIntEnv(name: string, fallback: number, allowZero: boolean): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  if (parsed === 0 && !allowZero) return fallback;
  return parsed;
}

function rollMemory(now: Date): void {
  const day = utcDayKey(now);
  if (memory.day === day) return;
  memory = { ...memory, day, used: 0 };
}

function freshRemaining(state: QuotaState, now: Date): number | null {
  if (state.upstreamRemaining == null || state.upstreamSampledAtMs == null) return null;
  if (utcDayKey(new Date(state.upstreamSampledAtMs)) !== utcDayKey(now)) return null;
  return state.upstreamRemaining;
}

export function resetHighlightQuotaForTests(seed?: Partial<QuotaState>): void {
  memory = { ...emptyState(new Date()), ...seed };
}

export async function readHighlightAllowance(now: Date): Promise<HighlightAllowance> {
  const state = await readQuotaState(now);
  return {
    used: state.used,
    budget: highlightDailyBudget(),
    upstreamRemaining: freshRemaining(state, now),
    reserve: highlightQuotaReserve(),
    pausedUntilMs: state.pausedUntilMs,
    tier: state.tier,
    lastTickMs: state.lastTickMs,
  };
}

export function allowanceAllows(allowance: HighlightAllowance, now: Date): boolean {
  return canSpendHighlightRequest({
    used: allowance.used,
    budget: allowance.budget,
    upstreamRemaining: allowance.upstreamRemaining,
    reserve: allowance.reserve,
    pausedUntilMs: allowance.pausedUntilMs,
    nowMs: now.getTime(),
  });
}

export async function recordHighlightRequest(now: Date): Promise<void> {
  rollMemory(now);
  const redis = getRedisClient();
  if (redis) {
    try {
      const key = usageKey(memory.day);
      const used = await redis.incr(key);
      await redis.expire(key, META_TTL_SEC);
      memory.used = typeof used === 'number' ? used : memory.used + 1;
      return;
    } catch (error) {
      logger.warn('[Highlightly] quota counter failed', error);
    }
  }
  memory.used += 1;
}

export async function noteHighlightUpstream(
  now: Date,
  patch: { remaining: number | null; tier: string | null },
): Promise<void> {
  rollMemory(now);
  memory.upstreamRemaining = patch.remaining;
  memory.upstreamSampledAtMs = now.getTime();
  if (patch.tier) memory.tier = patch.tier;
  await persistMeta();
}

export async function pauseHighlightSync(untilMs: number): Promise<void> {
  memory.pausedUntilMs = untilMs;
  await persistMeta();
}

export async function markHighlightTick(now: Date): Promise<void> {
  memory.lastTickMs = now.getTime();
  await persistMeta();
}

async function readQuotaState(now: Date): Promise<QuotaState> {
  rollMemory(now);
  const redis = getRedisClient();
  if (!redis) return { ...memory };
  try {
    const [usedRaw, metaRaw] = await Promise.all([
      redis.get(usageKey(memory.day)),
      redis.get(META_KEY),
    ]);
    const meta = parseMeta(metaRaw);
    memory = {
      ...memory,
      used: usedRaw ? Number.parseInt(usedRaw, 10) || 0 : 0,
      upstreamRemaining:
        typeof meta.upstreamRemaining === 'number' ? meta.upstreamRemaining : memory.upstreamRemaining,
      upstreamSampledAtMs:
        typeof meta.upstreamSampledAtMs === 'number'
          ? meta.upstreamSampledAtMs
          : memory.upstreamSampledAtMs,
      pausedUntilMs: typeof meta.pausedUntilMs === 'number' ? meta.pausedUntilMs : memory.pausedUntilMs,
      tier: typeof meta.tier === 'string' ? meta.tier : memory.tier,
      lastTickMs: typeof meta.lastTickMs === 'number' ? meta.lastTickMs : memory.lastTickMs,
    };
  } catch (error) {
    logger.warn('[Highlightly] quota read failed', error);
  }
  return { ...memory };
}

async function persistMeta(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(
      META_KEY,
      JSON.stringify({
        upstreamRemaining: memory.upstreamRemaining,
        upstreamSampledAtMs: memory.upstreamSampledAtMs,
        pausedUntilMs: memory.pausedUntilMs,
        tier: memory.tier,
        lastTickMs: memory.lastTickMs,
      }),
      'EX',
      META_TTL_SEC,
    );
  } catch (error) {
    logger.warn('[Highlightly] quota meta write failed', error);
  }
}

function usageKey(day: string): string {
  return `highlightly:usage:${day}`;
}

function parseMeta(raw: string | null): Partial<QuotaState> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<QuotaState>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
