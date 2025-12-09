import { Router } from 'express';
import { StorageController } from '../controllers/storage.controller';
import { uploadAvatar, uploadReel, uploadThumbnail } from '../middleware/upload.middleware';
import { validateAvatarUpload, validateReelUpload, validateThumbnailUpload } from '../middleware/validation.middleware';

// Note: Auth middleware should be added here once Lucia is integrated
// For now, we assume the user ID is passed in the body or handled by a placeholder auth middleware

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

// Delete File
router.delete('/:bucket/:path(*)', StorageController.deleteFile);

export default router;
