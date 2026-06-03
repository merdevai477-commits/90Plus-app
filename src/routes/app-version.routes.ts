/**
 * App Version Control Routes
 * للتحكم في إصدارات التطبيق وإجبار التحديث
 */

import { Router, Request, Response } from 'express';
import { getAppFeatures } from '../services/app-features.service';
import { requireAuth } from '../middleware/clerk.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';

const router = Router();

// Current app version configuration
// يمكن تحديثها من خلال admin endpoint
let appVersionConfig = {
    currentVersion: process.env.APP_CURRENT_VERSION || '1.0.0',
    minimumVersion: process.env.APP_MINIMUM_VERSION || '1.0.0',
    forceUpdate: process.env.APP_FORCE_UPDATE === 'true',
    maintenanceMode: process.env.APP_MAINTENANCE_MODE === 'true',
    maintenanceMessage: process.env.APP_MAINTENANCE_MESSAGE || 'التطبيق تحت الصيانة. يرجى المحاولة لاحقاً.',
    updateMessage: process.env.APP_UPDATE_MESSAGE || 'يجب تحديث التطبيق لاستمرار الاستخدام.',
    updateUrl: {
        android: process.env.APP_UPDATE_URL_ANDROID || 'https://play.google.com/store/apps/details?id=com.mrdev187.ninetyplusapp',
        ios: process.env.APP_UPDATE_URL_IOS || 'https://apps.apple.com/app/id123456789',
    },
};

/**
 * GET /api/app/version
 * Check app version and get update requirements
 * Public endpoint - no auth required
 */
router.get('/version', async (req: Request, res: Response): Promise<void> => {
    try {
        const clientVersion = req.query.version as string || req.headers['x-app-version'] as string;
        const platform = (req.query.platform as string || req.headers['x-platform'] as string || 'android').toLowerCase();

        // If maintenance mode is enabled, block all requests
        if (appVersionConfig.maintenanceMode) {
            res.status(503).json({
                status: 'MAINTENANCE',
                message: appVersionConfig.maintenanceMessage,
                maintenance: true,
                maintenanceMessage: appVersionConfig.maintenanceMessage,
            });
            return;
        }

        // Compare versions (simple string comparison - works for semantic versioning)
        const needsUpdate = clientVersion && compareVersions(clientVersion, appVersionConfig.minimumVersion) < 0;
        const forceUpdateRequired = needsUpdate && appVersionConfig.forceUpdate;

        res.json({
            status: 'SUCCESS',
            data: {
                currentVersion: appVersionConfig.currentVersion,
                minimumVersion: appVersionConfig.minimumVersion,
                clientVersion: clientVersion || 'unknown',
                needsUpdate,
                forceUpdate: forceUpdateRequired,
                updateMessage: forceUpdateRequired ? appVersionConfig.updateMessage : null,
                updateUrl: appVersionConfig.updateUrl[platform as 'android' | 'ios'] || appVersionConfig.updateUrl.android,
                maintenance: false,
            },
        });
    } catch (error: any) {
        logger.error('App version check error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/app/status
 * Get app status (maintenance mode, etc.)
 * Public endpoint
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
    try {
        res.json({
            status: 'SUCCESS',
            data: {
                maintenance: appVersionConfig.maintenanceMode,
                maintenanceMessage: appVersionConfig.maintenanceMessage,
                currentVersion: appVersionConfig.currentVersion,
                minimumVersion: appVersionConfig.minimumVersion,
            },
        });
    } catch (error: any) {
        logger.error('App status check error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/app/features
 * Public feature flags (World Cup tab unlock, etc.)
 */
router.get('/features', (_req: Request, res: Response): void => {
    res.json({
        status: 'SUCCESS',
        features: getAppFeatures(),
    });
});

/**
 * POST /api/app/admin/version
 * Update app version configuration (Admin only)
 */
router.post('/admin/version', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            currentVersion,
            minimumVersion,
            forceUpdate,
            maintenanceMode,
            maintenanceMessage,
            updateMessage,
            updateUrl,
        } = req.body;

        // Update configuration
        if (currentVersion !== undefined) appVersionConfig.currentVersion = currentVersion;
        if (minimumVersion !== undefined) appVersionConfig.minimumVersion = minimumVersion;
        if (forceUpdate !== undefined) appVersionConfig.forceUpdate = forceUpdate === true || forceUpdate === 'true';
        if (maintenanceMode !== undefined) appVersionConfig.maintenanceMode = maintenanceMode === true || maintenanceMode === 'true';
        if (maintenanceMessage !== undefined) appVersionConfig.maintenanceMessage = maintenanceMessage;
        if (updateMessage !== undefined) appVersionConfig.updateMessage = updateMessage;
        if (updateUrl) {
            if (updateUrl.android) appVersionConfig.updateUrl.android = updateUrl.android;
            if (updateUrl.ios) appVersionConfig.updateUrl.ios = updateUrl.ios;
        }

        logger.info('App version config updated:', appVersionConfig);

        res.json({
            status: 'SUCCESS',
            message: 'تم تحديث إعدادات الإصدار بنجاح',
            data: appVersionConfig,
        });
    } catch (error: any) {
        logger.error('Update app version config error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/app/admin/version
 * Get current app version configuration (Admin only)
 */
router.get('/admin/version', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        res.json({
            status: 'SUCCESS',
            data: appVersionConfig,
        });
    } catch (error: any) {
        logger.error('Get app version config error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * Helper function to compare semantic versions
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
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

export default router;


/**
 * GET /api/app/check-update
 * Check if app update is available (alias for /version with simpler response)
 * Public endpoint
 */
router.get('/check-update', async (req: Request, res: Response): Promise<void> => {
    try {
        const currentVersion = req.query.currentVersion as string || req.query.version as string;
        const platform = (req.query.platform as string || 'android').toLowerCase();
        
        if (!currentVersion) {
            sendError(req, res, ErrorCode.VALIDATION, 'currentVersion is required');
            return;
        }
        
        // Check if maintenance mode
        if (appVersionConfig.maintenanceMode) {
            res.json({
                status: 'SUCCESS',
                data: {
                    updateAvailable: false,
                    currentVersion,
                    maintenance: true,
                    message: appVersionConfig.maintenanceMessage
                }
            });
            return;
        }
        
        // Compare versions
        const updateAvailable = compareVersions(currentVersion, appVersionConfig.currentVersion) < 0;
        const forceUpdate = compareVersions(currentVersion, appVersionConfig.minimumVersion) < 0;
        
        res.json({
            status: 'SUCCESS',
            data: {
                updateAvailable,
                currentVersion,
                latestVersion: appVersionConfig.currentVersion,
                minimumVersion: appVersionConfig.minimumVersion,
                forceUpdate,
                message: updateAvailable ? appVersionConfig.updateMessage : 'No updates available',
                downloadUrl: appVersionConfig.updateUrl[platform as 'android' | 'ios'] || appVersionConfig.updateUrl.android
            }
        });
    } catch (error: any) {
        logger.error('Check update error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});
