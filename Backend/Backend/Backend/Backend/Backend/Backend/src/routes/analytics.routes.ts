import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { requireAuth } from '../middleware/clerk.middleware';

const router = Router();

// ============================================
// ANALYTICS ROUTES (Protected - Owner only)
// ============================================

router.get('/me', requireAuth, AnalyticsController.getMyAnalytics);
router.get('/video/:id', requireAuth, AnalyticsController.getVideoAnalytics);

export default router;
