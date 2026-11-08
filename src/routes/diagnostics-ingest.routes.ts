import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { requireDiagnosticsEnabled } from '../middleware/diagnostics-gate.middleware';
import { clientIpKey, hashRateLimitKey, perMinuteLimiter } from '../middleware/diagnostics-rate-limit.middleware';
import { logger } from '../utils/logger';
import { DIAG_LIMITS, getDiagnosticsSecrets, getIngestRateLimits } from '../services/diagnostics/diagnostics.config';
import { computeRef, readDiagAuthorization, verifyIngestToken } from '../services/diagnostics/diagnostics-token';
import { batchEnvelopeSchema, summarizeIssues } from '../services/diagnostics/diagnostics.schema';
import { ingestBatch } from '../services/diagnostics/diagnostics-ingest.service';

/**
 * POST /api/diagnostics/events
 *
 * Mounted before the global 10 MB JSON parser so this route enforces its own
 * 256 KB limit. Returns 404 unless DIAGNOSTICS_ENABLED is set.
 */

const ipLimiter = perMinuteLimiter('rl:diag-ip:', () => getIngestRateLimits().perIpPerMin, clientIpKey);

const tokenLimiter = perMinuteLimiter(
    'rl:diag-token:',
    () => getIngestRateLimits().perTokenPerMin,
    (req) => {
        const token = readDiagAuthorization(req.headers.authorization);
        return token ? `tok:${hashRateLimitKey(token)}` : clientIpKey(req);
    },
);

function stampReceiveTime(_req: Request, res: Response, next: NextFunction): void {
    res.locals.diagRecvAt = Date.now();
    next();
}

async function handleIngest(req: Request, res: Response): Promise<void> {
    const serverRecvAt: number = res.locals.diagRecvAt ?? Date.now();
    const secrets = getDiagnosticsSecrets();
    if (!secrets) {
        res.status(503).setHeader('Retry-After', '300');
        res.json({ error: 'diagnostics_unconfigured' });
        return;
    }

    const token = readDiagAuthorization(req.headers.authorization);
    if (!token) {
        res.status(401).json({ error: 'missing_token' });
        return;
    }
    const verified = verifyIngestToken(token, secrets.tokenSecret, serverRecvAt);
    if (!verified.ok) {
        res.status(verified.reason === 'expired' ? 410 : 401).json({ error: `token_${verified.reason}` });
        return;
    }

    const parsed = batchEnvelopeSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'invalid_envelope', issues: summarizeIssues(parsed.error) });
        return;
    }
    const envelope = parsed.data;
    if (envelope.sessionId !== verified.sessionId) {
        res.status(401).json({ error: 'session_mismatch' });
        return;
    }
    const deviceRef = computeRef('device', envelope.deviceId, secrets.idSecret);
    if (deviceRef !== verified.deviceRef) {
        res.status(401).json({ error: 'device_mismatch' });
        return;
    }

    try {
        const result = await ingestBatch({ envelope, deviceRef, nowMs: serverRecvAt });
        if (result.kind === 'gone') {
            res.status(410).json({ error: 'session_gone', sessionState: result.sessionState });
            return;
        }
        if (result.kind === 'forbidden') {
            res.status(403).json({ error: result.reason });
            return;
        }
        res.status(200).json({
            ok: true,
            accepted: result.accepted,
            duplicates: result.duplicates,
            rejected: result.rejected,
            sessionState: result.sessionState,
            maxEventsRemaining: result.maxEventsRemaining,
            serverRecvAt,
            serverSendAt: Date.now(),
        });
    } catch (err) {
        logger.error('[DIAG] ingest failed', (err as Error)?.message);
        res.status(503).setHeader('Retry-After', '30');
        res.json({ error: 'storage_unavailable' });
    }
}

function bodyErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
    const type = (err as { type?: string } | null)?.type;
    if (type === 'entity.too.large') {
        res.status(413).json({ error: 'payload_too_large', limitBytes: DIAG_LIMITS.maxBodyBytes });
        return;
    }
    if (type === 'entity.parse.failed' || type === 'encoding.unsupported' || err instanceof SyntaxError) {
        res.status(400).json({ error: 'invalid_json' });
        return;
    }
    next(err);
}

const router = Router();

router.post(
    '/',
    stampReceiveTime,
    requireDiagnosticsEnabled,
    ipLimiter,
    express.json({ limit: DIAG_LIMITS.maxBodyBytes }),
    tokenLimiter,
    (req, res, next) => {
        handleIngest(req, res).catch(next);
    },
);
router.use(bodyErrorHandler);

export default router;
