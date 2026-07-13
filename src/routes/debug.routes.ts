/**
 * TEMP DEBUG routes — remove after iOS LMT logo diagnosis.
 */
import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

/** In-memory ring buffer so we can pull recent LMT diagnostics without Railway CLI. */
const MAX_LMT_LOGS = 200;
const lmtLogBuffer: Array<Record<string, unknown>> = [];

function pushLmtLog(entry: Record<string, unknown>): void {
  lmtLogBuffer.push(entry);
  if (lmtLogBuffer.length > MAX_LMT_LOGS) {
    lmtLogBuffer.splice(0, lmtLogBuffer.length - MAX_LMT_LOGS);
  }
}

// TEMP DEBUG ENDPOINT - REMOVE AFTER iOS LMT LOGO DIAGNOSIS
router.post('/lmt-log', (req: Request, res: Response): void => {
  const entry = {
    receivedAt: new Date().toISOString(),
    ...(typeof req.body === 'object' && req.body ? req.body : { raw: req.body }),
  };
  pushLmtLog(entry);
  // Both console + logger so Railway HTTP and app log streams show it.
  console.log('[LMT-REMOTE]', JSON.stringify(entry));
  logger.info('[LMT-REMOTE]', entry);
  res.status(200).json({ ok: true });
});

// TEMP DEBUG ENDPOINT - REMOVE AFTER iOS LMT LOGO DIAGNOSIS
// Pull recent payloads: GET /api/debug/lmt-log?limit=50
router.get('/lmt-log', (req: Request, res: Response): void => {
  const limitRaw = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), MAX_LMT_LOGS)
    : 50;
  const items = lmtLogBuffer.slice(-limit);
  res.status(200).json({
    ok: true,
    count: items.length,
    totalBuffered: lmtLogBuffer.length,
    items,
  });
});

export default router;
