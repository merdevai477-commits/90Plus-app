/**
 * App Version Middleware
 * للتحقق من إصدار التطبيق قبل السماح بالوصول
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// App version configuration (should match app-version.routes.ts)
const APP_MINIMUM_VERSION = process.env.APP_MINIMUM_VERSION || '1.0.0';
const APP_FORCE_UPDATE = process.env.APP_FORCE_UPDATE === 'true';
const APP_MAINTENANCE_MODE = process.env.APP_MAINTENANCE_MODE === 'true';

/**
 * Middleware to check app version
 * Blocks requests from outdated app versions
 */
export function checkAppVersion(req: Request, res: Response, next: NextFunction) {
    // Skip version check for health/status endpoints
    if (req.path.includes('/health') || req.path.includes('/status') || req.path.includes('/version')) {
        return next();
    }

    // If maintenance mode is enabled, block all requests
    if (APP_MAINTENANCE_MODE) {
        res.status(503).json({
            status: 'MAINTENANCE',
            message: 'التطبيق تحت الصيانة. يرجى المحاولة لاحقاً.',
            maintenance: true,
        });
        return;
    }

    // Get client version from headers or query
    const clientVersion = req.headers['x-app-version'] as string || req.query.version as string;
    
    if (!clientVersion) {
        // Allow requests without version header (for web/browser)
        // But log for monitoring
        logger.debug('Request without app version header', { path: req.path });
        return next();
    }

    // Compare versions
    if (compareVersions(clientVersion, APP_MINIMUM_VERSION) < 0) {
        logger.warn('Blocked request from outdated app version', {
            clientVersion,
            minimumVersion: APP_MINIMUM_VERSION,
            path: req.path,
        });

        res.status(426).json({
            status: 'UPDATE_REQUIRED',
            message: 'يجب تحديث التطبيق لاستمرار الاستخدام.',
            forceUpdate: APP_FORCE_UPDATE,
            minimumVersion: APP_MINIMUM_VERSION,
            clientVersion,
        });
        return;
    }

    next();
}

/**
 * Helper function to compare semantic versions
 */
function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;

        if (part1 < part2) return -1;
        if (part1 > part2) return 1;
    }

    return 0;
}

