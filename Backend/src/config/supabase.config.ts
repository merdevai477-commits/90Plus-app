import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

// Supabase configuration (optional - only if credentials exist)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Only create clients if credentials exist
let supabaseClient: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
    // Client for frontend (uses anon key - limited permissions)
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    });

    // Admin client for backend (uses service role key - full permissions)
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
} else {
    logger.info('ℹ️  Supabase not configured - using R2 for storage');
}

export { supabaseClient, supabaseAdmin };

export const supabaseConfig = {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceKey: supabaseServiceKey,
};

// Storage buckets configuration
export const STORAGE_BUCKETS = {
    AVATARS: 'avatars',
    REELS: 'reels',
    THUMBNAILS: 'thumbnails',
} as const;

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
    AVATAR: 5 * 1024 * 1024, // 5MB
    REEL: 50 * 1024 * 1024, // 50MB (Hard Limit)
    THUMBNAIL: 2 * 1024 * 1024, // 2MB
} as const;

// Comment limits - Requirements 15.1, 15.2
export const COMMENT_LIMITS = {
    MAX_COMMENTS_PER_USER_PER_REEL: 5, // Top-level comments limit
    MAX_REPLIES_PER_USER_PER_REEL: 5,  // Replies limit
    MAX_PER_USER_PER_REEL: 5, // Legacy - kept for backward compatibility
} as const;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
    IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const,
    VIDEOS: ['video/mp4', 'video/webm', 'video/quicktime'] as const,
} as const;

