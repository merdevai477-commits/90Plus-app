import type { NextFunction, Request, Response } from 'express';
import { isDiagnosticsEnabled } from '../services/diagnostics/diagnostics.config';

/** Every diagnostics route is a 404 until DIAGNOSTICS_ENABLED is set. */
export function requireDiagnosticsEnabled(_req: Request, res: Response, next: NextFunction): void {
    if (!isDiagnosticsEnabled()) {
        res.status(404).json({ error: 'not_found' });
        return;
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
}
