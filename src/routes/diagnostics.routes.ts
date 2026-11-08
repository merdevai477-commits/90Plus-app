import { Router, type Request, type Response } from 'express';
import { optionalAuth } from '../middleware/clerk.middleware';
import { requireDiagnosticsEnabled } from '../middleware/diagnostics-gate.middleware';
import { clientIpKey, perMinuteLimiter } from '../middleware/diagnostics-rate-limit.middleware';
import { logger } from '../utils/logger';
import { getDiagnosticsSecrets, getDirectiveRateLimit } from '../services/diagnostics/diagnostics.config';
import { directiveRequestSchema, summarizeIssues } from '../services/diagnostics/diagnostics.schema';
import { resolveDirective } from '../services/diagnostics/diagnostics-session.service';

/**
 * POST /api/diagnostics/directive
 *
 * Asked by diagnostics-capable builds on cold start and on foreground only.
 * Answers whether this device is part of an active session and, if so, hands
 * out a session-scoped ingest token. Returns 404 unless DIAGNOSTICS_ENABLED.
 */

const router = Router();

const directiveLimiter = perMinuteLimiter('rl:diag-directive:', getDirectiveRateLimit, clientIpKey);

router.post(
    '/directive',
    requireDiagnosticsEnabled,
    directiveLimiter,
    optionalAuth,
    async (req: Request, res: Response): Promise<void> => {
        const secrets = getDiagnosticsSecrets();
        if (!secrets) {
            res.status(503).json({ error: 'diagnostics_unconfigured' });
            return;
        }
        const parsed = directiveRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'invalid_request', issues: summarizeIssues(parsed.error) });
            return;
        }

        const userId = (req.auth as { userId?: unknown } | undefined)?.userId;
        const nowMs = Date.now();
        try {
            const result = await resolveDirective({
                deviceId: parsed.data.deviceId,
                app: parsed.data.app,
                clerkUserId: typeof userId === 'string' && userId ? userId : null,
                secrets,
                nowMs,
            });
            if (!result.active) {
                res.json({ active: false, serverNow: Date.now() });
                return;
            }
            const { session } = result;
            res.json({
                active: true,
                sessionId: session.id,
                token: result.token,
                expiresAt: session.expiresAt,
                expiresInMs: Math.max(0, session.expiresAt - nowMs),
                uploadUntil: result.uploadUntil,
                serverNow: Date.now(),
                config: {
                    maxEvents: session.config.maxEvents,
                    features: session.config.features,
                    sampling: session.config.sampling,
                },
            });
        } catch (err) {
            logger.error('[DIAG] directive failed', (err as Error)?.message);
            res.status(503).json({ error: 'unavailable' });
        }
    },
);

export default router;
