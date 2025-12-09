import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️  Supabase credentials not found in .env file');
    console.warn('   Please add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file');
}

// Client for frontend (uses anon key - limited permissions)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});

// Admin client for backend (uses service role key - full permissions)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

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
    REEL: 100 * 1024 * 1024, // 100MB
    THUMBNAIL: 2 * 1024 * 1024, // 2MB
} as const;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
    IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const,
    VIDEOS: ['video/mp4', 'video/webm', 'video/quicktime'] as const,
} as const;

