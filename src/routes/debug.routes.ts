/**
 * TEMP DEBUG routes — LMT + Android push registration diagnosis.
 */
import { Router, Request, Response } from 'express';
import { getRedisClient, isRedisConnected } from '../lib/redis';

const router = Router();

const LMT_REDIS_KEY = 'debug:lmt-log';
const PUSH_REDIS_KEY = 'debug:push-log';
const MAX_DEBUG_LOGS = 200;

/** Local fallback when Redis is unavailable. */
const lmtLogBuffer: Array<Record<string, unknown>> = [];
const pushLogBuffer: Array<Record<string, unknown>> = [];

function pushLocal(
  buffer: Array<Record<string, unknown>>,
  entry: Record<string, unknown>,
): void {
  buffer.push(entry);
  if (buffer.length > MAX_DEBUG_LOGS) {
    buffer.splice(0, buffer.length - MAX_DEBUG_LOGS);
  }
}

async function pushDebugLog(
  redisKey: string,
  buffer: Array<Record<string, unknown>>,
  entry: Record<string, unknown>,
): Promise<void> {
  pushLocal(buffer, entry);
  try {
    if (!isRedisConnected()) return;
    const redis = getRedisClient();
    if (!redis) return;
    await redis.lpush(redisKey, JSON.stringify(entry));
    await redis.ltrim(redisKey, 0, MAX_DEBUG_LOGS - 1);
    await redis.expire(redisKey, 60 * 60 * 24); // 24h
  } catch {
    // Never fail the request because of Redis.
  }
}

async function readDebugLogs(
  redisKey: string,
  buffer: Array<Record<string, unknown>>,
  limit: number,
): Promise<Record<string, unknown>[]> {
  try {
    if (isRedisConnected()) {
      const redis = getRedisClient();
      if (redis) {
        const rows = await redis.lrange(redisKey, 0, limit - 1);
        if (rows.length > 0) {
          return rows.map((row) => {
            try {
              return JSON.parse(row) as Record<string, unknown>;
            } catch {
              return { raw: row };
            }
          });
        }
      }
    }
  } catch {
    // fall through to memory
  }
  return buffer.slice(-limit).reverse();
}

async function pushLmtLog(entry: Record<string, unknown>): Promise<void> {
  await pushDebugLog(LMT_REDIS_KEY, lmtLogBuffer, entry);
}

async function readLmtLogs(limit: number): Promise<Record<string, unknown>[]> {
  return readDebugLogs(LMT_REDIS_KEY, lmtLogBuffer, limit);
}

// TEMP DEBUG ENDPOINT - REMOVE AFTER iOS LMT LOGO DIAGNOSIS
router.post('/lmt-log', async (req: Request, res: Response): Promise<void> => {
  try {
    const body =
      typeof req.body === 'object' && req.body !== null
        ? (req.body as Record<string, unknown>)
        : { raw: req.body };
    const entry = {
      receivedAt: new Date().toISOString(),
      ...body,
    };
    await pushLmtLog(entry);
    // Prefer plain console — logger/Sentry must not break this temp endpoint.
    console.log('[LMT-REMOTE]', JSON.stringify(entry));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[LMT-REMOTE] handler error', err);
    // Still 200 so the app never retries-spam; diagnosis must not break UX.
    res.status(200).json({ ok: true, stored: false });
  }
});

// TEMP DEBUG ENDPOINT - REMOVE AFTER iOS LMT LOGO DIAGNOSIS
// Pull recent payloads: GET /api/debug/lmt-log?limit=50
router.get('/lmt-log', async (req: Request, res: Response): Promise<void> => {
  try {
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.floor(limitRaw), 1), MAX_DEBUG_LOGS)
      : 50;
    const items = await readLmtLogs(limit);
    res.status(200).json({
      ok: true,
      count: items.length,
      totalBuffered: items.length,
      items,
    });
  } catch (err) {
    console.error('[LMT-REMOTE] GET error', err);
    res.status(200).json({ ok: true, count: 0, totalBuffered: 0, items: [] });
  }
});

/** Android push registration diagnosis (store builds have no Metro). */
router.post('/push-log', async (req: Request, res: Response): Promise<void> => {
  try {
    const body =
      typeof req.body === 'object' && req.body !== null
        ? (req.body as Record<string, unknown>)
        : { raw: req.body };
    const entry = {
      receivedAt: new Date().toISOString(),
      ...body,
    };
    await pushDebugLog(PUSH_REDIS_KEY, pushLogBuffer, entry);
    console.log('[PUSH-REMOTE]', JSON.stringify(entry));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[PUSH-REMOTE] handler error', err);
    res.status(200).json({ ok: true, stored: false });
  }
});

router.get('/push-log', async (req: Request, res: Response): Promise<void> => {
  try {
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.floor(limitRaw), 1), MAX_DEBUG_LOGS)
      : 50;
    const items = await readDebugLogs(PUSH_REDIS_KEY, pushLogBuffer, limit);
    res.status(200).json({
      ok: true,
      count: items.length,
      totalBuffered: items.length,
      items,
    });
  } catch (err) {
    console.error('[PUSH-REMOTE] GET error', err);
    res.status(200).json({ ok: true, count: 0, totalBuffered: 0, items: [] });
  }
});

export default router;
