/**
 * TEMP DEBUG routes — remove after iOS LMT logo diagnosis.
 */
import { Router, Request, Response } from 'express';
import { getRedisClient, isRedisConnected } from '../lib/redis';

const router = Router();

const REDIS_KEY = 'debug:lmt-log';
const MAX_LMT_LOGS = 200;

/** Local fallback when Redis is unavailable. */
const lmtLogBuffer: Array<Record<string, unknown>> = [];

function pushLocal(entry: Record<string, unknown>): void {
  lmtLogBuffer.push(entry);
  if (lmtLogBuffer.length > MAX_LMT_LOGS) {
    lmtLogBuffer.splice(0, lmtLogBuffer.length - MAX_LMT_LOGS);
  }
}

async function pushLmtLog(entry: Record<string, unknown>): Promise<void> {
  pushLocal(entry);
  try {
    if (!isRedisConnected()) return;
    const redis = getRedisClient();
    if (!redis) return;
    await redis.lpush(REDIS_KEY, JSON.stringify(entry));
    await redis.ltrim(REDIS_KEY, 0, MAX_LMT_LOGS - 1);
    await redis.expire(REDIS_KEY, 60 * 60 * 24); // 24h
  } catch {
    // Never fail the request because of Redis.
  }
}

async function readLmtLogs(limit: number): Promise<Record<string, unknown>[]> {
  try {
    if (isRedisConnected()) {
      const redis = getRedisClient();
      if (redis) {
        const rows = await redis.lrange(REDIS_KEY, 0, limit - 1);
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
  return lmtLogBuffer.slice(-limit).reverse();
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
      ? Math.min(Math.max(Math.floor(limitRaw), 1), MAX_LMT_LOGS)
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

export default router;
