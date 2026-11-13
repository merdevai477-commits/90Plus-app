import { Router, Request, Response } from 'express';
import { listUserEliteBadges } from '../services/elite-badge.service';
import { logger } from '../utils/logger';

const router = Router();

router.get('/users/:userId', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        const data = await listUserEliteBadges(userId);
        res.set('Cache-Control', 'private, max-age=30');
        res.json({ status: 'SUCCESS', data });
    } catch (err) {
        logger.error('[elite-badges] list failed:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to load badges' });
    }
});

export default router;
