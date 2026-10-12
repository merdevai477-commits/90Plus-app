import { Router } from 'express';
import { logger } from '../utils/logger';
import { parseWidgetTeamIds } from '../services/widget-feed.service';
import {
  registerLiveActivityToken,
  removeLiveActivityToken,
  type LiveActivityKind,
} from '../services/live-activity.service';

const router = Router();

const TOKEN_RE = /^[0-9a-f]{32,512}$/i;
const DEVICE_RE = /^[0-9A-Za-z-]{8,64}$/;

/**
 * POST /api/live-activity/tokens
 * Body: { kind: 'update' | 'start', token, deviceId, fixtureId?, teamIds?, language? }
 * Called by the iOS app whenever ActivityKit hands it a new push token.
 */
router.post('/tokens', async (req, res) => {
  const body = req.body ?? {};
  const kind = body.kind as LiveActivityKind;
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  const fixtureId = Number.parseInt(String(body.fixtureId ?? ''), 10);
  const language = body.language === 'ar' ? 'ar' : 'en';

  if ((kind !== 'update' && kind !== 'start') || !TOKEN_RE.test(token) || !DEVICE_RE.test(deviceId)) {
    res.status(400).json({ status: 'ERROR', message: 'Invalid live activity token' });
    return;
  }
  if (kind === 'update' && !(fixtureId > 0)) {
    res.status(400).json({ status: 'ERROR', message: 'fixtureId is required for update tokens' });
    return;
  }

  try {
    await registerLiveActivityToken({
      kind,
      token: token.toLowerCase(),
      deviceId,
      fixtureId: kind === 'update' ? fixtureId : null,
      teamIds: kind === 'start' ? parseWidgetTeamIds(body.teamIds) : [],
      language,
    });
    res.json({ status: 'SUCCESS' });
  } catch (error) {
    logger.warn('[LiveActivity] register failed:', (error as Error)?.message);
    res.status(503).json({ status: 'ERROR', message: 'Could not register token' });
  }
});

/** DELETE /api/live-activity/tokens/:token — the activity ended on the device. */
router.delete('/tokens/:token', async (req, res) => {
  const token = String(req.params.token ?? '').trim();
  if (!TOKEN_RE.test(token)) {
    res.status(400).json({ status: 'ERROR', message: 'Invalid token' });
    return;
  }
  try {
    await removeLiveActivityToken(token.toLowerCase());
    res.json({ status: 'SUCCESS' });
  } catch (error) {
    logger.warn('[LiveActivity] remove failed:', (error as Error)?.message);
    res.status(503).json({ status: 'ERROR', message: 'Could not remove token' });
  }
});

export default router;
