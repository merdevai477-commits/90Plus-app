import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { requireAuth } from '../middleware/clerk.middleware';
import { strictLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Settings Routes (Protected)
router.get('/settings', requireAuth, UserController.getSettings);
router.patch('/settings', requireAuth, UserController.updateSettings);

// Account Routes (Protected + Rate Limited)
router.delete('/me', requireAuth, strictLimiter, UserController.deleteAccount);

export default router;

