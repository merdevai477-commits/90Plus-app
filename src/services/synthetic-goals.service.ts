/**
 * Score-delta goals for fixtures whose provider publishes a score but no event feed
 * (Primera RFEF, many second divisions, youth leagues…). Every live tick that sees the
 * score move records one goal per increment; a drop (VAR) retracts the latest goal on
 * that side. The read side merges these into the events list only when the feed has
 * no goal events of its own and the tally matches the current score.
 *
 * Storage is a Redis hash keyed by `side:index` so concurrent detectors (the 365 live
 * worker and the live-fixture sync both watch the same fixtures) cannot duplicate a
 * goal: `HSETNX` lets the first writer win and every later write is a no-op.
 */

import * as redisLib from '../lib/redis';
import { logger } from '../utils/logger';

type RedisLike = NonNullable<ReturnType<typeof redisLib.getRedisClient>>;

/** Connected client or null; tolerant of partial module mocks in tests. */
function redisIfReady(): RedisLike | null {
    const client = typeof redisLib.getRedisClient === 'function' ? redisLib.getRedisClient() : null;
    if (!client) return null;
    const ready =
        typeof redisLib.isRedisConnected === 'function' ? redisLib.isRedisConnected() : false;
    return ready ? client : null;
}

export type SyntheticGoalSide = 'home' | 'away';

export interface SyntheticGoal {
    side: SyntheticGoalSide;
    /** 1-based goal number for that side (the side's score after this goal). */
    index: number;
    /** Match minute when the score change was seen; null when inferred after the fact. */
    minute: number | null;
    extra: number | null;
    detectedAt: number;
    /** True when the goal was inferred from a score already on the board (minute unknown). */
    placeholder: boolean;
}

export interface ScoreLine {
    home: number;
    away: number;
}

const KEY_PREFIX = 'football:synthetic-goals:';
const TTL_SEC = 6 * 60 * 60;

/** Process-local mirror so a Redis outage still yields a coherent list for this instance. */
const memoryStore = new Map<number, Map<string, SyntheticGoal>>();
const MAX_MEMORY_FIXTURES = 300;

export function syntheticGoalsKey(fixtureId: number): string {
    return `${KEY_PREFIX}${fixtureId}`;
}

function fieldKey(side: SyntheticGoalSide, index: number): string {
    return `${side}:${index}`;
}

function rememberLocally(fixtureId: number, entries: Map<string, SyntheticGoal>): void {
    if (!memoryStore.has(fixtureId) && memoryStore.size >= MAX_MEMORY_FIXTURES) {
        const oldest = memoryStore.keys().next().value;
        if (oldest !== undefined) memoryStore.delete(oldest);
    }
    memoryStore.set(fixtureId, entries);
}

async function loadEntries(fixtureId: number): Promise<Map<string, SyntheticGoal>> {
    const redis = redisIfReady();
    if (redis) {
        try {
            const raw = await redis.hgetall(syntheticGoalsKey(fixtureId));
            const entries = new Map<string, SyntheticGoal>();
            for (const [field, json] of Object.entries(raw ?? {})) {
                try {
                    entries.set(field, JSON.parse(json) as SyntheticGoal);
                } catch {
                    // ignore corrupt field
                }
            }
            rememberLocally(fixtureId, entries);
            return entries;
        } catch (err) {
            logger.debug(`[SyntheticGoals] fixture=${fixtureId} redis read failed: ${(err as Error)?.message}`);
        }
    }
    return new Map(memoryStore.get(fixtureId) ?? []);
}

function sortGoals(goals: SyntheticGoal[]): SyntheticGoal[] {
    return [...goals].sort((a, b) => {
        // Placeholders (minute unknown) belong before anything we actually saw happen.
        if (a.placeholder !== b.placeholder) return a.placeholder ? -1 : 1;
        const am = a.minute ?? -1;
        const bm = b.minute ?? -1;
        if (am !== bm) return am - bm;
        if ((a.extra ?? 0) !== (b.extra ?? 0)) return (a.extra ?? 0) - (b.extra ?? 0);
        if (a.detectedAt !== b.detectedAt) return a.detectedAt - b.detectedAt;
        return a.index - b.index;
    });
}

/** Sorted list of recorded goals for a fixture (empty when nothing was recorded). */
export async function readSyntheticGoals(fixtureId: number): Promise<SyntheticGoal[]> {
    const entries = await loadEntries(fixtureId);
    return sortGoals([...entries.values()]);
}

export function tallySyntheticGoals(goals: SyntheticGoal[]): ScoreLine {
    let home = 0;
    let away = 0;
    for (const goal of goals) {
        if (goal.side === 'home') home += 1;
        else away += 1;
    }
    return { home, away };
}

function normalizeScore(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Bring the recorded goals in line with the score currently on the board.
 *
 * - `prev` known and a side went up: the new goals get the current minute.
 * - `prev` unknown (first sighting, restart) or a jump we did not witness: the
 *   missing goals are stored as minute-less placeholders so the tally still matches.
 * - A side went down (VAR / correction): its latest goals are retracted.
 */
export async function reconcileSyntheticGoals(
    fixtureId: number,
    prev: ScoreLine | null,
    next: { home: number | null | undefined; away: number | null | undefined },
    minute: number | null,
    extra: number | null = null,
): Promise<void> {
    const target: ScoreLine = { home: normalizeScore(next.home), away: normalizeScore(next.away) };
    const entries = await loadEntries(fixtureId);
    const have = tallySyntheticGoals([...entries.values()]);
    if (have.home === target.home && have.away === target.away) return;

    const redis = redisIfReady();
    const useRedis = redis != null;
    const key = syntheticGoalsKey(fixtureId);
    const now = Date.now();
    let touched = false;

    for (const side of ['home', 'away'] as const) {
        const current = have[side];
        const wanted = target[side];
        if (wanted > current) {
            // With a known previous score, only the goals beyond it were just witnessed.
            const witnessedFrom = prev ? Math.max(current, normalizeScore(prev[side])) + 1 : Infinity;
            for (let index = current + 1; index <= wanted; index++) {
                const witnessed = index >= witnessedFrom && minute != null;
                const goal: SyntheticGoal = {
                    side,
                    index,
                    minute: witnessed ? minute : null,
                    extra: witnessed ? extra : null,
                    detectedAt: now,
                    placeholder: !witnessed,
                };
                const field = fieldKey(side, index);
                let stored = true;
                if (useRedis) {
                    try {
                        stored = (await redis!.hsetnx(key, field, JSON.stringify(goal))) === 1;
                    } catch (err) {
                        logger.debug(`[SyntheticGoals] fixture=${fixtureId} redis write failed: ${(err as Error)?.message}`);
                    }
                }
                if (stored && !entries.has(field)) entries.set(field, goal);
                touched = true;
            }
        } else if (wanted < current) {
            for (let index = current; index > wanted; index--) {
                const field = fieldKey(side, index);
                if (useRedis) {
                    try {
                        await redis!.hdel(key, field);
                    } catch (err) {
                        logger.debug(`[SyntheticGoals] fixture=${fixtureId} redis retract failed: ${(err as Error)?.message}`);
                    }
                }
                entries.delete(field);
                touched = true;
            }
        }
    }

    if (touched) {
        rememberLocally(fixtureId, entries);
        if (useRedis) {
            try {
                await redis!.expire(key, TTL_SEC);
            } catch {
                // TTL refresh is best-effort
            }
        }
        logger.info(
            `[SyntheticGoals] fixture=${fixtureId} score=${target.home}-${target.away} prev=${
                prev ? `${prev.home}-${prev.away}` : 'unknown'
            } minute=${minute ?? '?'} recorded=${entries.size}`,
        );
    }
}

interface EventTeam {
    id: number;
    name: string;
    logo?: string | null;
}

/**
 * API-Football-shaped goal events for the client. Only returned when the tally
 * equals the scoreboard: a mismatch means we missed a change and showing a wrong
 * number of goals is worse than showing none.
 */
export function buildSyntheticGoalEvents(
    goals: SyntheticGoal[],
    teams: { home: EventTeam; away: EventTeam },
    score: { home: number | null | undefined; away: number | null | undefined },
): any[] {
    const tally = tallySyntheticGoals(goals);
    if (tally.home !== normalizeScore(score.home) || tally.away !== normalizeScore(score.away)) {
        return [];
    }
    return sortGoals(goals).map((goal) => {
        const team = goal.side === 'home' ? teams.home : teams.away;
        return {
            time: { elapsed: goal.minute ?? 0, extra: goal.extra },
            team: { id: team.id, name: team.name, logo: team.logo ?? '' },
            player: { id: null, name: null },
            assist: { id: null, name: null },
            type: 'Goal',
            detail: 'Normal Goal',
            comments: null,
            _synthetic: true,
            _minuteKnown: goal.minute != null,
            _source: 'score-delta',
        };
    });
}

/**
 * What the client should say about the events feed:
 * `true` — real provider events exist; `false` — goals happened but the provider
 * has none (only score-delta goals, or nothing at all); `null` — 0-0 and no events,
 * which is indistinguishable from "nothing has happened yet".
 */
export function resolveEventsFeedAvailability(
    events: unknown[],
    score?: { home: number | null | undefined; away: number | null | undefined } | null,
): boolean | null {
    const isSynthetic = (event: unknown) => (event as { _synthetic?: boolean })?._synthetic === true;
    if (events.some((event) => event != null && !isSynthetic(event))) return true;
    if (events.some(isSynthetic)) return false;
    if (score && normalizeScore(score.home) + normalizeScore(score.away) > 0) return false;
    return null;
}

/** True when the provider feed carries at least one goal event. */
export function feedHasGoalEvents(events: unknown[]): boolean {
    return events.some((event) => {
        const type = String((event as { type?: unknown })?.type ?? '').toLowerCase();
        return type === 'goal';
    });
}

/**
 * Merge score-delta goals into a provider events list that has no goals of its
 * own. Returns the events untouched when the feed already reports goals or the
 * score is 0-0.
 */
export async function mergeSyntheticGoalsIntoEvents(
    fixtureId: number,
    events: any[],
    teams: { home: EventTeam; away: EventTeam },
    score: { home: number | null | undefined; away: number | null | undefined },
): Promise<{ events: any[]; synthesized: number }> {
    const totalGoals = normalizeScore(score.home) + normalizeScore(score.away);
    if (totalGoals === 0 || feedHasGoalEvents(events)) return { events, synthesized: 0 };

    const goals = await readSyntheticGoals(fixtureId);
    if (goals.length === 0) return { events, synthesized: 0 };

    const synthetic = buildSyntheticGoalEvents(goals, teams, score);
    if (synthetic.length === 0) return { events, synthesized: 0 };

    const merged = [...events, ...synthetic].sort((a, b) => {
        const ae = Number(a?.time?.elapsed ?? 0);
        const be = Number(b?.time?.elapsed ?? 0);
        if (ae !== be) return ae - be;
        return Number(a?.time?.extra ?? 0) - Number(b?.time?.extra ?? 0);
    });
    return { events: merged, synthesized: synthetic.length };
}

/** Test/maintenance hook. */
export async function clearSyntheticGoals(fixtureId: number): Promise<void> {
    memoryStore.delete(fixtureId);
    const redis = redisIfReady();
    if (redis) {
        try {
            await redis.del(syntheticGoalsKey(fixtureId));
        } catch {
            // best-effort
        }
    }
}
