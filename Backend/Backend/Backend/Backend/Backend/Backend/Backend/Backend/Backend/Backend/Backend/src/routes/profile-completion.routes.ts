/**
 * Profile Completion Routes
 */

import { Router } from 'express';
import { ProfileCompletionController } from '../controllers/profile-completion.controller';
import { requireAuth } from '../middleware/clerk.middleware';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get profile completion status
router.get('/completion', ProfileCompletionController.getCompletionStatus);

// Mark step as completed
router.post('/completion/step', ProfileCompletionController.markStepCompleted);

export default router;
