import { Router } from 'express';
import { StorageController } from '../controllers/storage.controller';
import { uploadAvatar, uploadReel, uploadThumbnail } from '../middleware/upload.middleware';
import { validateAvatarUpload, validateReelUpload, validateThumbnailUpload } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/clerk.middleware';
import { verifyFileOwnership } from '../middleware/ownership.middleware';

const router = Router();

// Avatar Upload
router.post(
    '/avatar',
    uploadAvatar.single('file'),
    validateAvatarUpload,
    StorageController.uploadAvatar
);

// Reel Upload
router.post(
    '/reel',
    uploadReel.single('file'),
    validateReelUpload,
    StorageController.uploadReel
);

// Thumbnail Upload
router.post(
    '/thumbnail',
    uploadThumbnail.single('file'),
    validateThumbnailUpload,
    StorageController.uploadThumbnail
);

// Delete File - requires authentication and ownership verification
router.delete('/:bucket/:path(*)', requireAuth, verifyFileOwnership, StorageController.deleteFile);

export default router;
