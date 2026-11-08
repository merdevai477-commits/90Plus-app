import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { requireAuth } from './clerk.middleware';
import { requireAdmin } from './admin.middleware';
import { getDiagnosticsAdminKey } from '../services/diagnostics/diagnostics.config';
import { timingSafeEqualString } from '../services/diagnostics/diagnostics-token';

export interface DiagnosticsAdminIdentity {
    kind: 'admin_key' | 'developer';
    /** Internal user id for developer accounts; null for the shared admin key. */
    userId: string | null;
}

function digest(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Admin access for the diagnostics API and dashboard: either the
 * `x-diagnostics-admin-key` header (compared in constant time) or a signed-in
 * developer account (`User.isDeveloper`) through the existing Clerk guards.
 */
export function requireDiagnosticsAdmin(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers['x-diagnostics-admin-key'];
    const provided = Array.isArray(header) ? header[0] : header;

    if (provided !== undefined) {
        const configured = getDiagnosticsAdminKey();
        if (configured && timingSafeEqualString(digest(provided), digest(configured))) {
            res.locals.diagAdmin = { kind: 'admin_key', userId: null } satisfies DiagnosticsAdminIdentity;
            next();
            return;
        }
        res.status(401).json({ error: 'invalid_admin_key' });
        return;
    }

    void requireAuth(req, res, (authErr?: unknown) => {
        if (authErr) {
            next(authErr);
            return;
        }
        void requireAdmin(req, res, () => {
            const adminUser = (req as Request & { adminUser?: { id: string } }).adminUser;
            res.locals.diagAdmin = { kind: 'developer', userId: adminUser?.id ?? null } satisfies DiagnosticsAdminIdentity;
            next();
        });
    });
}
