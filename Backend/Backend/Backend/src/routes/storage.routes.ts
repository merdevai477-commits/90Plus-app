import { Router } from 'express';
import { StorageController } from '../controllers/storage.controller';
import { uploadAvatar, uploadReel, uploadThumbnail } from '../middleware/upload.middleware';
import { requireAuth } from '../middleware/clerk.middleware';

const router = Router();

// Avatar Upload
router.post(
    '/avatar',
    uploadAvatar.single('file'),
    StorageController.uploadAvatar
);

// Reel Upload
router.post(
    '/reel',
    uploadReel.single('file'),
    StorageController.uploadReel
);

// Thumbnail Upload
router.post(
    '/thumbnail',
    uploadThumbnail.single('file'),
    StorageController.uploadThumbnail
);

// Delete File - requires authentication
// TODO: Add proper file ownership verification
router.delete('/:bucket/:path(*)', requireAuth, StorageController.deleteFile);

export default router;
