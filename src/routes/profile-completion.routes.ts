/**
 * Profile Completion Routes
 */

import { Router } from 'express';
import { ProfileCompletionController } from '../controllers/profile-completion.controller';
import { requireAuth } from '../middleware/clerk.middleware';
import { responseCacheMiddleware } from '../middleware/responseCache.middleware';

const router = Router();

// IMPORTANT: do NOT use `router.use(requireAuth)` here.
// This router is mounted on `/api/profile`, so router-level middleware fires
// on every `/api/profile/*` request — including those that fall through to
// `profile.routes.ts`. `requireAuth` overwrites `req.auth` from a function
// (Clerk's accessor) to a plain object, breaking the second `requireAuth`
// in `profile.routes.ts` and returning 401 on `/cooldowns`, `/analytics`, etc.
// Apply per-route instead.
router.get('/completion', requireAuth, responseCacheMiddleware({ ttl: 30 * 1000 }), ProfileCompletionController.getCompletionStatus);

router.post('/completion/step', requireAuth, ProfileCompletionController.markStepCompleted);

export default router;
