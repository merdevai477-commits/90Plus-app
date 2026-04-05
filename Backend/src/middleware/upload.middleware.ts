import multer from 'multer';
import { FILE_SIZE_LIMITS } from '../config/app.config';

// Configure multer to store files in memory
const storage = multer.memoryStorage();

// File filter for images
const imageFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'));
    }
};

// File filter for videos
const videoFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only video and image files are allowed'));
    }
};

// Create multer instance for avatars
export const uploadAvatar = multer({
    storage: storage,
    limits: {
        fileSize: FILE_SIZE_LIMITS.AVATAR,
    },
    fileFilter: imageFilter,
});

// Create multer instance for reels
export const uploadReel = multer({
    storage: storage,
    limits: {
        fileSize: FILE_SIZE_LIMITS.REEL,
    },
    fileFilter: videoFilter,
});

// Create multer instance for thumbnails
export const uploadThumbnail = multer({
    storage: storage,
    limits: {
        fileSize: FILE_SIZE_LIMITS.THUMBNAIL,
    },
    fileFilter: imageFilter,
});

// General upload middleware (for profile routes)
export const uploadMiddleware = multer({
    storage: storage,
    limits: {
        fileSize: FILE_SIZE_LIMITS.REEL, // Use largest limit
    },
    fileFilter: videoFilter,
});
