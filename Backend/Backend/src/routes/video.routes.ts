import { Router } from 'express';
import { VideoController } from '../controllers/video.controller';
import { requireAuth } from '../middleware/clerk.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { verifyVideoOwnership } from '../middleware/ownership.middleware';

const router = Router();

// ============================================
// VIDEO ROUTES
// ============================================

// Protected routes
router.get('/', requireAuth, VideoController.getMyVideos);
router.get('/delete-status', requireAuth, VideoController.getDeleteStatus);
router.post(
  '/',
  requireAuth,
  uploadMiddleware.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  VideoController.uploadVideo
);

// Public routes (must come before /:id routes)
router.get('/user/:username', VideoController.getVideosByUsername);
router.post('/:id/view', VideoController.recordView);

// Protected routes with :id parameter (must come after specific routes)
// ✅ ZERO TRUST: Ownership verification prevents IDOR
router.delete('/:id', requireAuth, verifyVideoOwnership, VideoController.deleteVideo);

export default router;
