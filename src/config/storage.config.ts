// Centralized storage config (R2-only).

export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  COVERS: 'covers',
  REELS: 'reels',
  VIDEOS: 'videos',
  THUMBNAILS: 'thumbnails',
} as const;

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  AVATAR: 5 * 1024 * 1024, // 5MB
  COVER: 8 * 1024 * 1024, // 8MB
  REEL: 50 * 1024 * 1024, // 50MB (Hard Limit)
  THUMBNAIL: 2 * 1024 * 1024, // 2MB
} as const;

// Comment limits - Requirements 15.1, 15.2
export const COMMENT_LIMITS = {
  MAX_COMMENTS_PER_USER_PER_REEL: 5,
  MAX_REPLIES_PER_USER_PER_REEL: 5,
  MAX_PER_USER_PER_REEL: 5, // legacy
} as const;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const,
  VIDEOS: ['video/mp4', 'video/webm', 'video/quicktime'] as const,
} as const;

