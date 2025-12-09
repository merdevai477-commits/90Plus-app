import multer from 'multer';
import { FILE_SIZE_LIMITS } from '../config/supabase.config';

// Configure multer to store files in memory
const storage = multer.memoryStorage();

// Create multer instance for avatars
export const uploadAvatar = multer({
    storage: storage,
    limits: {
        fileSize: FILE_SIZE_LIMITS.AVATAR,
    },
});

// Create multer instance for reels
export const uploadReel = multer({
    storage: storage,
    limits: {
        fileSize: FILE_SIZE_LIMITS.REEL,
    },
});

// Create multer instance for thumbnails
export const uploadThumbnail = multer({
    storage: storage,
    limits: {
        fileSize: FILE_SIZE_LIMITS.THUMBNAIL,
    },
});
