import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireDiagnosticsEnabled } from '../middleware/diagnostics-gate.middleware';
import { requireDiagnosticsAdmin, type DiagnosticsAdminIdentity } from '../middleware/diagnostics-admin.middleware';
import { clientIpKey, perMinuteLimiter } from '../middleware/diagnostics-rate-limit.middleware';
import { validateZod } from '../middleware/zod-validation.middleware';
import { isRedisConnected } from '../lib/redis';
import { logger } from '../utils/logger';
import {
    DIAG_LIMITS,
    getDiagnosticsAdminKey,
    getDiagnosticsSecrets,
    getRetentionDays,
    getServerDiagnosticsEnvironment,
    isBackendTraceConfigured,
} from '../services/diagnostics/diagnostics.config';
import {
    createSession,
    createSessionRequestSchema,
    effectiveSessionState,
    type CreateSessionRequest,
    getSessionSnapshot,
    listSeenDevices,
    listSessionDevices,
    listSessions,
    stopSession,
} from '../services/diagnostics/diagnostics-session.service';

/**
 * /api/diagnostics/admin/* — session management for the diagnostics
 * dashboard and CLI. Requires the admin key or a developer account.
 */

const router = Router();

const adminLimiter = perMinuteLimiter('rl:diag-admin:', () => 120, clientIpKey);

router.use(requireDiagnosticsEnabled, adminLimiter, requireDiagnosticsAdmin);

const sessionParams = { params: z.object({ id: z.string().uuid() }) };
/** Only valid after `validateZod(sessionParams)` has run. */
const sessionIdOf = (req: Request): string => String(req.params.id);

function handleFailure(res: Response, what: string, err: unknown): void {
    logger.error(`[DIAG] admin ${what} failed`, (err as Error)?.message);
    res.status(500).json({ error: 'internal_error' });
}

router.get('/status', (_req: Request, res: Response) => {
    res.json({
        enabled: true,
        environment: getServerDiagnosticsEnvironment(),
        secretsConfigured: getDiagnosticsSecrets() !== null,
        adminKeyConfigured: getDiagnosticsAdminKey() !== null,
        backendTraceConfigured: isBackendTraceConfigured(),
        redisConnected: isRedisConnected(),
        retentionDays: getRetentionDays(),
        limits: DIAG_LIMITS,
    });
});

router.get('/sessions', async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    try {
        res.json({ sessions: await listSessions(Number.isFinite(limit) ? limit : 20, Date.now()) });
    } catch (err) {
        handleFailure(res, 'list sessions', err);
    }
});

router.post('/sessions', validateZod({ body: createSessionRequestSchema }), async (req: Request, res: Response) => {
    const secrets = getDiagnosticsSecrets();
    if (!secrets) {
        res.status(503).json({ error: 'diagnostics_unconfigured' });
        return;
    }
    const admin = res.locals.diagAdmin as DiagnosticsAdminIdentity | undefined;
    const createdBy = admin?.kind === 'developer' ? `developer:${admin.userId ?? 'unknown'}` : 'admin_key';
    try {
        const result = await createSession(req.body as CreateSessionRequest, secrets, createdBy, Date.now());
        if (!result.ok) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.status(201).json({ session: { ...result.session, state: 'active' } });
    } catch (err) {
        handleFailure(res, 'create session', err);
    }
});

router.get('/sessions/:id', validateZod(sessionParams), async (req: Request, res: Response) => {
    const id = sessionIdOf(req);
    try {
        const session = await getSessionSnapshot(id);
        if (!session) {
            res.status(404).json({ error: 'session_not_found' });
            return;
        }
        const devices = await listSessionDevices(id);
        res.json({ session: { ...session, state: effectiveSessionState(session, Date.now()) }, devices });
    } catch (err) {
        handleFailure(res, 'get session', err);
    }
});

router.post('/sessions/:id/stop', validateZod(sessionParams), async (req: Request, res: Response) => {
    const id = sessionIdOf(req);
    try {
        const nowMs = Date.now();
        const session = await stopSession(id, nowMs);
        if (!session) {
            res.status(404).json({ error: 'session_not_found' });
            return;
        }
        res.json({ session: { ...session, state: effectiveSessionState(session, nowMs) } });
    } catch (err) {
        handleFailure(res, 'stop session', err);
    }
});

router.get('/sessions/:id/devices', validateZod(sessionParams), async (req: Request, res: Response) => {
    try {
        res.json({ devices: await listSessionDevices(sessionIdOf(req)) });
    } catch (err) {
        handleFailure(res, 'list devices', err);
    }
});

router.get('/devices/seen', async (_req: Request, res: Response) => {
    try {
        res.json({ devices: await listSeenDevices(Date.now()), redisConnected: isRedisConnected() });
    } catch (err) {
        handleFailure(res, 'list seen devices', err);
    }
});

export default router;
