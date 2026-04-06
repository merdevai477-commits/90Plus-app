/**
 * Application Configuration
 * Storage, file limits, and comment settings
 */

// Storage buckets configuration
export const STORAGE_BUCKETS = {
    AVATARS: 'avatars',
    REELS: 'reels',
    THUMBNAILS: 'thumbnails',
} as const;

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
    AVATAR: 5 * 1024 * 1024,     // 5MB
    REEL: 50 * 1024 * 1024,      // 50MB
    THUMBNAIL: 2 * 1024 * 1024,  // 2MB
} as const;

// Comment limits
export const COMMENT_LIMITS = {
    MAX_COMMENTS_PER_USER_PER_REEL: 5,
    MAX_REPLIES_PER_USER_PER_REEL: 5,
    MAX_PER_USER_PER_REEL: 5,
} as const;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
    IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const,
    VIDEOS: ['video/mp4', 'video/webm', 'video/quicktime'] as const,
} as const;
