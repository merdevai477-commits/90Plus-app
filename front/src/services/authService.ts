import { Platform } from 'react-native';
import { getApiUrl } from '../../config/api.config';
import { requestDeduplicator } from '../../services/requestDeduplicator';
import { logger } from './logger';
import { safeJsonParse } from '../../utils/safeJsonParse';
import { EnhancedApiClient } from '../../utils/enhancedNetworkService';
import { monitorSearchPerformance } from '../../utils/searchPerformanceMonitor';

const API_URL = getApiUrl();

// Custom error classes for sync operations
export class SyncTimeoutError extends Error {
    constructor(message: string = 'Sync operation timeout after 15 seconds') {
        super(message);
        this.name = 'SyncTimeoutError';
    }
}

export class SyncNetworkError extends Error {
    constructor(message: string = 'Network error during sync operation') {
        super(message);
        this.name = 'SyncNetworkError';
    }
}

export class SyncServerError extends Error {
    constructor(message: string = 'Server error during sync operation', public statusCode?: number) {
        super(message);
        this.name = 'SyncServerError';
    }
}

export class SyncValidationError extends Error {
    constructor(message: string = 'Invalid response data from server') {
        super(message);
        this.name = 'SyncValidationError';
    }
}

// ✅ OPTIMIZED: Balanced timeout for Railway cold starts
const API_TIMEOUT = 15000; // 15 seconds per request

// Overall sync operation timeout
const SYNC_OPERATION_TIMEOUT = 12000; // 12 seconds total

// Retry configuration
const MAX_RETRY_ATTEMPTS = 4; // Clerk/me + cold DB: extra retries for transient 5xx
const RETRY_DELAY_MS = 500; // 500ms between retries

// ✅ SUPER SPEED: In-memory cache for instant responses
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const MEMORY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes — fewer repeat calls while switching tabs

// Debouncing for syncUserWithBackend to prevent stampedes (short delay — first paint stays fast)
const syncDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SYNC_DEBOUNCE_MS = 120;

// Helper function to get from memory cache
const getFromMemoryCache = (key: string): any | null => {
    const cached = memoryCache.get(key);
    if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
        return cached.data;
    }
    memoryCache.delete(key);
    return null;
};

// Helper function to set memory cache
const setMemoryCache = (key: string, data: any): void => {
    memoryCache.set(key, { data, timestamp: Date.now() });
    // Limit cache size
    if (memoryCache.size > 50) {
        const firstKey = memoryCache.keys().next().value;
        if (firstKey) memoryCache.delete(firstKey);
    }
};

// Helper function for fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = API_TIMEOUT): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - please check your connection');
        }
        throw error;
    }
};

export interface UserProfile {
    id: string;
    clerkUserId: string;
    email: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    bio: string | null;
    coins: number;
    level: number;
    xp: number;
    isVerified: boolean;
    isDeveloper: boolean;
    favoriteTeam: string | null;
    lastUsernameChange: string | null;
    // FIFA Card fields
    position: string | null;
    countryFlag: string | null;
    age: number | null;
    height: number | null;
    weight: number | null;
    preferredFoot: string | null;
    createdAt: string;
    updatedAt: string;
    consecutiveLoginDays?: number;
}

/** In-flight dedupe: Home + Profile + others share one /clerk/me per user */
const pendingUserSync = new Map<string, Promise<UserProfile>>();

export interface AuthResponse {
    status: 'SUCCESS' | 'ERROR';
    data?: {
        user: UserProfile;
    };
    xpEvents?: Array<{
        action: string;
        amount: number;
        leveledUp: boolean;
        newLevel: number;
        newTitle?: string;
    }>;
    message?: string;
}

/**
 * Authentication Service
 * Handles all communication with the backend for user authentication
 */
import { toastManager } from '../../services/toastManager';

export class AuthService {
  /**
   * Get trending hashtags
   * @returns Promise<string[]> Array of trending hashtag strings
   */
  static getTrendingHashtags = async (): Promise<any[]> => {
    try {
      const response = await fetch(`${API_URL}/reels/trending-hashtags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.status === 'SUCCESS') {
        return data.data.hashtags || [];
      }
      return [];
    } catch (error) {
      console.error('Error getting trending hashtags:', error);
      return [];
    }
  };
  
  /**
     * Check if API is reachable
     */
    static async checkApiHealth(): Promise<boolean> {
        try {
            console.log('🏥 Checking API health...');
            const response = await fetchWithTimeout(`${API_URL}/health`, {
                method: 'GET',
            }, 5000); // 5 second timeout for health check

            if (response.ok) {
                console.log('✅ API is healthy');
                return true;
            }
            console.warn('⚠️ API returned non-OK status:', response.status);
            return false;
        } catch (error: any) {
            console.error('❌ API health check failed:', error.message);
            return false;
        }
    }

    /**
     * Sync user with backend after Clerk authentication
     * This creates the user in the database if they don't exist
     * ✅ SUPER SPEED: Uses memory cache + timeout for instant response
     * ✅ DEBOUNCING: Prevents multiple simultaneous calls
     * ✅ TIMEOUT: 15-second overall timeout with proper error handling
     * ✅ VALIDATION: Validates response data for required fields
     */
    static async syncUserWithBackend(token: string): Promise<UserProfile | null> {
        const startTime = Date.now();
        
        // ✅ STABLE KEY: Use clerkUserId from JWT instead of token substring.
        // Tokens rotate every hour; userId is stable → cache survives token refresh.
        let stableUserId: string | null = null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            stableUserId = payload.sub || null;
        } catch (_) { /* malformed token – fall through to network */ }

        const cacheKey = stableUserId ? `user_${stableUserId}` : `user_${token.substring(0, 20)}`;
        const cached = getFromMemoryCache(cacheKey);
        if (cached) {
            logger.debug('⚡ User from memory cache (stable key)');
            return cached;
        }

        const inflight = pendingUserSync.get(cacheKey);
        if (inflight) {
            logger.debug('🔗 Reusing in-flight /clerk/me sync');
            return inflight;
        }

        const runSync = async (): Promise<UserProfile> => {
        // ✅ DEBOUNCING: Cancel previous call if a burst of navigations fires sync
        const existingTimer = syncDebounceTimers.get(cacheKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Wait for debounce if needed (but don't count it against timeout)
        await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                syncDebounceTimers.delete(cacheKey);
                resolve();
            }, SYNC_DEBOUNCE_MS);
            syncDebounceTimers.set(cacheKey, timer);
        });

        // Create timeout promise that rejects after 15 seconds FROM NOW
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new SyncTimeoutError('Sync operation timeout after 15 seconds'));
            }, SYNC_OPERATION_TIMEOUT);
        });

        // Create the actual sync operation promise
        const syncPromise = new Promise<UserProfile>(async (resolve, reject) => {
            let lastError: Error | null = null;
            
            // Retry logic with reduced delays
            for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
                try {
                    logger.debug(`🔄 Syncing user with backend (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})...`);

                    const response = await fetchWithTimeout(`${API_URL}/clerk/me`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'X-Request-Priority': 'high',
                            'X-Retry-Attempt': `${attempt}`,
                        },
                    }, 10000); // 10 seconds per request

                    // Handle non-OK responses
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new SyncServerError(
                            `Server returned ${response.status}: ${errorText}`,
                            response.status
                        );
                    }

                    const data: AuthResponse = await response.json();

                    // Validate response structure
                    if (data.status !== 'SUCCESS' || !data.data?.user) {
                        throw new SyncServerError('Invalid response structure from server');
                    }

                    const user = data.data.user;

                    // Validate required fields
                    if (!user.id || !user.username) {
                        throw new SyncValidationError('Response missing required fields (id, username)');
                    }

                    logger.debug('✅ User synced successfully:', user.username);
                    
                    // ✅ Cache in memory for instant future access
                    setMemoryCache(cacheKey, user);
                    
                    resolve(user);
                    return;
                } catch (error: any) {
                    lastError = error;
                    
                    // Determine if error is retryable
                    const isRetryable = 
                        error.name === 'SyncNetworkError' ||
                        (error.name === 'SyncServerError' && error.statusCode && (error.statusCode >= 500 || error.statusCode === 502)) ||
                        error.message?.includes('timeout') ||
                        error.message?.includes('network') ||
                        error.message?.includes('fetch') ||
                        error.message?.includes('ECONNREFUSED');

                    // If not retryable or last attempt, reject immediately
                    if (!isRetryable || attempt === MAX_RETRY_ATTEMPTS) {
                        // Convert generic errors to specific error types
                        if (error.name === 'SyncTimeoutError' || error.name === 'SyncNetworkError' || 
                            error.name === 'SyncServerError' || error.name === 'SyncValidationError') {
                            reject(error);
                        } else if (error.message?.includes('timeout') || error.message?.includes('Request timeout')) {
                            reject(new SyncNetworkError('Network timeout during sync operation'));
                        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                            reject(new SyncNetworkError(error.message));
                        } else {
                            reject(new SyncServerError(error.message || 'Unknown error during sync'));
                        }
                        return;
                    }

                    // Wait before retry with exponential backoff
                    const delay = RETRY_DELAY_MS * Math.pow(1.5, attempt - 1); // ✅ Exponential backoff
                    logger.debug(`⚠️ Sync attempt ${attempt} failed, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // If we get here, all retries failed
            if (lastError) {
                reject(lastError);
            } else {
                reject(new SyncServerError('All sync attempts failed'));
            }
        });

        // Race between timeout and sync operation
        try {
            const result = await Promise.race([syncPromise, timeoutPromise]);
            return result;
        } catch (error: any) {
            // Clean up debounce timer on error
            const timer = syncDebounceTimers.get(cacheKey);
            if (timer) {
                clearTimeout(timer);
                syncDebounceTimers.delete(cacheKey);
            }
            
            // Re-throw the error for UI layer to handle
            throw error;
        }
        };

        const flight = runSync().finally(() => {
            pendingUserSync.delete(cacheKey);
        });
        pendingUserSync.set(cacheKey, flight);
        return flight;
    }

    /**
     * Clear memory cache for user data
     * Should be called on logout to prevent serving stale cached data
     */
    static clearMemoryCache(): void {
        memoryCache.clear();
        // Also clear any pending debounce timers
        syncDebounceTimers.forEach(timer => clearTimeout(timer));
        syncDebounceTimers.clear();
        pendingUserSync.clear();
        logger.debug('🧹 AuthService memory cache cleared');
    }

    /**
     * Update user profile
     */
    static async updateProfile(
        token: string,
        updates: {
            username?: string;
            displayName?: string;
            bio?: string;
            favoriteTeam?: string;
        }
    ): Promise<{ user: UserProfile | null; error?: string }> {
        try {
            logger.debug('🔄 Updating user profile...');

            const response = await fetch(`${API_URL}/clerk/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            const data: AuthResponse = await response.json();

            if (data.status === 'SUCCESS' && data.data?.user) {
                logger.debug('✅ Profile updated successfully');
                return { user: data.data.user };
            } else {
                console.error('❌ Failed to update profile:', data.message);
                return { user: null, error: data.message || 'Failed to update profile' };
            }
        } catch (error: any) {
            console.error('❌ Error updating profile:', error);
            return { user: null, error: error.message || 'Network error' };
        }
    }

    /**
     * Update username with 15-day cooldown enforcement
     * Requirements: 12.1, 12.2, 12.3
     */
    static async updateUsername(
        token: string,
        username: string
    ): Promise<{ success: boolean; username?: string; error?: string; daysRemaining?: number }> {
        try {
            logger.debug('🔄 Updating username...');

            const response = await fetch(`${API_URL}/profile/username`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username }),
            });

            const data = await response.json();

            if (data.status === 'SUCCESS') {
                logger.debug('✅ Username updated successfully');
                return { success: true, username: data.data?.username };
            } else if (data.code === 'COOLDOWN_ACTIVE') {
                logger.debug('⏳ Username change on cooldown:', data.daysRemaining, 'days remaining');
                return { 
                    success: false, 
                    error: data.message || 'Username change on cooldown',
                    daysRemaining: data.daysRemaining 
                };
            } else {
                console.error('❌ Failed to update username:', data.message);
                return { success: false, error: data.message || 'Failed to update username' };
            }
        } catch (error: any) {
            console.error('❌ Error updating username:', error);
            return { success: false, error: error.message || 'Network error' };
        }
    }

    /**
     * Sync user data from Clerk (useful after profile updates in Clerk)
     */
    static async syncFromClerk(token: string): Promise<UserProfile | null> {
        try {
            logger.debug('🔄 Syncing user data from Clerk...');

            const response = await fetch(`${API_URL}/clerk/sync`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data: AuthResponse = await response.json();

            if (data.status === 'SUCCESS' && data.data?.user) {
                logger.debug('✅ User synced from Clerk successfully');
                return data.data.user;
            } else {
                // Silent error handling - don't log sync errors
                return null;
            }
        } catch (error: any) {
            // Silent error handling - don't log sync errors
            return null;
        }
    }

    /**
     * Get user settings
     */
    static async getSettings(token: string): Promise<Record<string, any> | null> {
        try {
            const response = await fetch(`${API_URL}/users/settings`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (data.status === 'SUCCESS') {
                return data.data || {};
            }
            return null;
        } catch (error) {
            console.error('Error getting settings:', error);
            return null;
        }
    }

    /**
     * Update user settings
     */
    static async updateSettings(
        token: string,
        settings: Record<string, any>
    ): Promise<boolean> {
        try {
            const response = await fetch(`${API_URL}/users/settings`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ settings }),
            });

            const data = await response.json();
            return data.status === 'SUCCESS';
        } catch (error) {
            console.error('Error updating settings:', error);
            return false;
        }
    }

    /**
     * Search users by username or displayName
     */
    static searchUsers = monitorSearchPerformance(
        '/clerk/search',
        async (
            token: string,
            query: string,
            limit: number = 10
        ): Promise<SearchUserResult[]> => {
            try {
                const response = await fetch(
                    `${API_URL}/clerk/search?q=${encodeURIComponent(query)}&limit=${limit}`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                const data = await response.json();
                if (data.status === 'SUCCESS') {
                    return data.data.users || [];
                }
                return [];
            } catch (error) {
                console.error('Error searching users:', error);
                return [];
            }
        }
    );

    /**
     * Get public user profile by username
     */
    static async getUserByUsername(
        token: string | null | undefined,
        username: string
    ): Promise<SearchUserResult | null> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
            const response = await fetch(`${API_URL}/clerk/user/${username}`, {
                method: 'GET',
                headers,
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data.user;
            }
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    /**
     * Get user's reels/videos by username
     */
    static async getUserReels(
        token: string | null | undefined,
        username: string,
        limit: number = 20,
        offset: number = 0,
        bustCache: boolean = false
    ): Promise<UserReel[]> {
        try {
            const cleanUsername = username?.trim();
            if (!cleanUsername) {
                console.error('❌ [getUserReels] Invalid username:', username);
                return [];
            }
            
            // Add cache-busting timestamp when forced refresh is needed
            const cacheBuster = bustCache ? `&_t=${Date.now()}` : '';
            const url = `${API_URL}/clerk/user/${cleanUsername}/reels?limit=${limit}&offset=${offset}${cacheBuster}`;
            
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...(bustCache && { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }),
            };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers,
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'SUCCESS') {
                    return data.data.reels || [];
                }
            }
            
            return [];
        } catch (error) {
            console.error('❌ [getUserReels] Error:', error);
            return [];
        }
    }

    /**
     * Update user profile with comprehensive field support
     */
    static async updateUserProfile(
        token: string,
        updates: {
            username?: string;
            displayName?: string;
            bio?: string;
            position?: string;
            countryFlag?: string;
            age?: number;
            height?: number;
            weight?: number;
            preferredFoot?: string;
            favoriteTeam?: string;
            favoriteClub?: string;
            favoriteBrand?: string;
            socialLinks?: Array<{
                platform: string;
                url: string;
                username?: string;
            }>;
        }
    ): Promise<AuthResponse> {
        try {
            logger.debug('🔄 Updating user profile with comprehensive data...');

            // Determine which endpoint to use based on update type
            let endpoint = `${API_URL}/clerk/profile`;
            let body = { ...updates };

            // If updating FIFA card fields, use card-profile endpoint
            const cardFields = ['position', 'countryFlag', 'age', 'height', 'weight', 'preferredFoot'];
            const hasCardFields = cardFields.some(field => updates.hasOwnProperty(field));
            
            if (hasCardFields) {
                endpoint = `${API_URL}/clerk/card-profile`;
            }

            // Social links use a dedicated endpoint that expects an array payload
            if (updates.socialLinks) {
                endpoint = `${API_URL}/clerk/social-links`;
                body = {
                    socialLinks: updates.socialLinks,
                };
            }

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const data: AuthResponse = await response.json();

            if (data.status === 'SUCCESS') {
                logger.debug('✅ Profile updated successfully');
                // Don't show toast here - let the calling function handle it
                return data;
            } else {
                // Don't log username cooldown errors as errors
                if (data.message && (data.message.includes('يمكنك تغيير اسم المستخدم بعد') || 
                    data.message.includes('يوم')) && updates.username) {
                    logger.info('ℹ️ Username change cooldown:', data.message);
                } else {
                    console.error('❌ Failed to update profile:', data.message);
                }
                // Don't show toast here - let the calling function handle it
                return data;
            }
        } catch (error: any) {
            // Don't log username cooldown errors as errors
            if (error.message && (error.message.includes('يمكنك تغيير اسم المستخدم بعد') || 
                error.message.includes('يوم')) && updates.username) {
                logger.info('ℹ️ Username change cooldown:', error.message);
            } else {
                console.error('❌ Error updating profile:', error);
            }
            // Don't show toast here - let the calling function handle it
            return {
                status: 'ERROR',
                message: error.message || 'Network error'
            };
        }
    }
}

export interface SearchUserResult {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    bio: string | null;
    isVerified: boolean;
    isDeveloper: boolean;
    level: number;
    xp?: number;
    favoriteTeam: string | null;
    createdAt?: string;
    followersCount?: number;
    followingCount?: number;
    reelsCount?: number;
    isFollowing?: boolean;
    isFollowingMe?: boolean; // True if this user is following the current user
    // FIFA Card fields
    position?: string | null;
    countryFlag?: string | null;
    country?: string; // ✅ NEW
    location?: string; // ✅ NEW (optional for compatibility)
    age?: number | null;
    height?: number | null;
    weight?: number | null;
    preferredFoot?: string | null;
    clubLogo?: string | null;
    brandLogo?: string | null;
    socialLinks?: Array<{
        platform: string;
        url: string;
        username?: string;
    }>;
    coverImage?: string | null;
    consecutiveLoginDays?: number;
    blockStatus?: {
        blockedByMe: boolean;
        blockedMe: boolean;
    };
}

export interface UserReel {
    id: string;
    uri: string;
    thumbnail: string | null;
    caption: string | null;
    views: string;
    likes: number;
    comments: number;
    status?: 'READY' | 'PROCESSING' | 'FAILED'; // Backend returns status for owner's reels
    createdAt: string;
}

export interface FollowStats {
    followersCount: number;
    followingCount: number;
    reelsCount: number;
    savedReelsCount?: number;
}

export interface CardProfile {
    position?: string;
    countryFlag?: string;
    country?: string; // ✅ NEW
    age?: number;
    height?: number;
    weight?: number;
    preferredFoot?: string;
    clubLogo?: string;
    brandLogo?: string;
    favoriteTeam?: string;
}

export class CardProfileService {
    /**
     * Update FIFA card profile fields
     */
    static async updateCardProfile(
        token: string,
        cardProfile: CardProfile
    ): Promise<{ success: boolean; data?: CardProfile; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/clerk/card-profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(cardProfile),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, data: data.data.cardProfile };
            }
            return { success: false, error: data.message };
        } catch (error: any) {
            console.error('Error updating card profile:', error);
            return { success: false, error: error.message };
        }
    }
}

export class FollowService {
    /**
     * Follow a user
     */
    static async followUser(token: string, username: string): Promise<{ success: boolean; data?: FollowStats; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/clerk/follow/${username}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, data: data.data };
            }
            return { success: false, error: data.message };
        } catch (error: any) {
            console.error('Error following user:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Unfollow a user
     */
    static async unfollowUser(token: string, username: string): Promise<{ success: boolean; data?: FollowStats; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/clerk/follow/${username}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, data: data.data };
            }
            return { success: false, error: data.message };
        } catch (error: any) {
            console.error('Error unfollowing user:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current user's follow stats
     */
    static async getMyStats(token: string): Promise<FollowStats | null> {
        try {
            const response = await fetch(`${API_URL}/clerk/stats`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await safeJsonParse<any>(response, null);
            if (data && data.status === 'SUCCESS') {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('Error getting stats:', error);
            return null;
        }
    }

    /**
     * Follow a user by ID
     */
    static async follow(token: string, userId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/clerk/follow/id/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true };
            }
            return { success: false, error: data.message };
        } catch (error: any) {
            console.error('Error following user:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Unfollow a user by ID
     */
    static async unfollow(token: string, userId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/clerk/follow/id/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true };
            }
            return { success: false, error: data.message };
        } catch (error: any) {
            console.error('Error unfollowing user:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get followers list for a user
     */
    static async getFollowers(token: string, userId: string, limit = 50, offset = 0): Promise<any[]> {
        try {
            const response = await fetch(`${API_URL}/clerk/followers/${userId}?limit=${limit}&offset=${offset}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data?.followers || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting followers:', error);
            return [];
        }
    }

    /**
     * Get following list for a user
     */
    static async getFollowing(token: string, userId: string, limit = 50, offset = 0): Promise<any[]> {
        try {
            const response = await fetch(`${API_URL}/clerk/following/${userId}?limit=${limit}&offset=${offset}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data?.following || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting following:', error);
            return [];
        }
    }
}

// ============================================
// REELS SERVICE
// ============================================

export interface ReelFeedItem {
    id: string;
    videoUrl: string;
    thumbnail: string | null;
    caption: string | null;
    views: number;
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    isLiked: boolean;
    isSaved: boolean;
    hashtags: string[];
    mentions: string[];
    previewComments: {
        id: string;
        content: string;
        createdAt: string;
        user: { username: string; avatar: string | null };
    }[];
    user: {
        id: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
        isVerified: boolean;
    };
    createdAt: string;
}

export interface ReelsFeedResponse {
    reels: ReelFeedItem[];
    nextCursor: string | null;
    hasMore: boolean;
}

export interface HashtagInfo {
    name: string;
    reelCount: number;
}

export interface ProfileAnalytics {
    profileViews: number;
    followersCount: number;
    followingCount: number;
    reelsCount: number;
    totalLikes: number;
    totalViews: number;
    totalComments: number;
    recentFollowers: number;
    memberSince: string;
}

export interface CooldownInfo {
    canChange: boolean;
    daysRemaining: number;
    hoursRemaining: number;
}

export interface ReelDeleteInfo {
    canDelete: boolean;
    deletesUsed: number;
    remainingDeletes: number;
    maxDeletes: number;
}

export interface CooldownsResponse {
    avatar: CooldownInfo;
    cover: CooldownInfo;
    reelUpload: CooldownInfo;
    username: CooldownInfo;
    reelDelete?: ReelDeleteInfo;  // Requirements 13.4, 13.5, 13.6, 13.7
}

function parseReelsCommentApiError(
    data: Record<string, unknown>,
    status: number,
    method: 'GET' | 'POST' = 'POST',
): string {
    const code = typeof data?.code === 'string' ? data.code : undefined;
    const message = typeof data?.message === 'string' ? data.message : undefined;
    if (message) return message;
    const details = data?.details as Record<string, unknown> | undefined;
    if (details?.reason && typeof details.reason === 'string') return details.reason;
    if (status === 404) return method === 'GET' ? 'تعذر تحميل التعليقات' : 'الريل غير موجود';
    if (status === 401) return 'يرجى تسجيل الدخول مرة أخرى';
    if (status === 429) {
        if (code === 'SPAM_DETECTED') return 'تم رفض التعليق — يبدو أنه spam';
        return message || 'تم الوصول للحد الأقصى للتعليقات';
    }
    if (status === 400) {
        if (code === 'CONTENT_MODERATION_FAILED') return 'محتوى التعليق غير مسموح';
        return method === 'GET' ? 'تعذر تحميل التعليقات' : 'فشل إرسال التعليق';
    }
    return method === 'GET' ? 'تعذر تحميل التعليقات' : 'فشل إرسال التعليق';
}

export class ReelsService {
    /**
     * Get reels feed with pagination (5 reels per request)
     */
    static async getFeed(token: string, cursor?: string): Promise<ReelsFeedResponse | null> {
        try {
            const url = cursor 
                ? `${API_URL}/reels/feed?cursor=${cursor}`
                : `${API_URL}/reels/feed`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('Error getting reels feed:', error);
            return null;
        }
    }

    /**
     * Fetch a single reel by ID (deep links / share)
     */
    static async getReelById(
        token: string | null,
        reelId: string,
    ): Promise<ReelFeedItem | null> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
            const response = await fetch(`${API_URL}/reels/${reelId}`, {
                method: 'GET',
                headers,
            });
            const data = await response.json();
            if (data.status === 'SUCCESS' && data.data?.reel) {
                return data.data.reel;
            }
            return null;
        } catch (error) {
            console.error('Error getting reel by id:', error);
            return null;
        }
    }

    /**
     * Get reels by hashtag
     */
    static async getByHashtag(
        token: string, 
        hashtag: string, 
        cursor?: string
    ): Promise<{ hashtag: HashtagInfo | null; reels: ReelFeedItem[]; hasMore: boolean; nextCursor: string | null } | null> {
        try {
            const url = cursor
                ? `${API_URL}/reels/hashtag/${hashtag}?cursor=${cursor}`
                : `${API_URL}/reels/hashtag/${hashtag}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('Error getting hashtag reels:', error);
            return null;
        }
    }

    /**
     * Upload a new reel
     */
    static async uploadReel(
        token: string,
        reel: {
            videoUrl: string;
            thumbnail?: string;
            caption?: string;
            hashtags?: string[];
            mentions?: string[];
        }
    ): Promise<{ success: boolean; reel?: any; error?: string; hoursRemaining?: number }> {
        try {
            const response = await fetch(`${API_URL}/reels`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reel),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, reel: data.data.reel };
            }
            return { 
                success: false, 
                error: data.message,
                hoursRemaining: data.hoursRemaining 
            };
        } catch (error: any) {
            console.error('Error uploading reel:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Record a reel view.
     *
     * Returns the structured result so callers know whether the view was
     * actually counted (`counted: true`) or skipped server-side (owner,
     * duplicate, not_found, error). When counted, `views` contains the new
     * server-side count and callers can confidently bump the UI optimistically.
     *
     * Network/server failure returns `{ ok: false }` so the caller can retry
     * the next playback.
     */
    static async recordView(
        token: string,
        reelId: string,
    ): Promise<{
        ok: boolean;
        counted: boolean;
        views?: number;
        reason?: 'owner' | 'duplicate' | 'not_found' | 'error';
    }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/view`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                return { ok: false, counted: false };
            }

            const data = await response.json();
            const payload = data?.data ?? {};
            return {
                ok: data?.status === 'SUCCESS',
                counted: Boolean(payload?.counted),
                views: typeof payload?.views === 'number' ? payload.views : undefined,
                reason: payload?.reason,
            };
        } catch (error) {
            console.error('Error recording view:', error);
            return { ok: false, counted: false };
        }
    }

    /**
     * Like a reel
     */
    static async likeReel(token: string, reelId: string): Promise<{ success: boolean; likesCount?: number }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/like`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, likesCount: data.data.likesCount };
            }
            return { success: false };
        } catch (error) {
            console.error('Error liking reel:', error);
            return { success: false };
        }
    }

    /**
     * Unlike a reel
     */
    static async unlikeReel(token: string, reelId: string): Promise<{ success: boolean; likesCount?: number }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/like`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, likesCount: data.data.likesCount };
            }
            return { success: false };
        } catch (error) {
            console.error('Error unliking reel:', error);
            return { success: false };
        }
    }

    /**
     * Get comments for a reel
     */
    static async getComments(
        token: string,
        reelId: string,
        limit: number = 3,
    ): Promise<{ comments: any[]; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/comments?limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (response.ok && data.status === 'SUCCESS') {
                return { comments: data.data.comments || [] };
            }
            return {
                comments: [],
                error: parseReelsCommentApiError(data, response.status, 'GET'),
            };
        } catch (error) {
            console.error('Error getting comments:', error);
            return { comments: [], error: 'تعذر تحميل التعليقات' };
        }
    }

    /**
     * Add a comment to a reel
     */
    static async addComment(
        token: string, 
        reelId: string, 
        content: string,
        mentions?: string[]
    ): Promise<{ success: boolean; comment?: any; error?: string; status?: number }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/comments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    content,
                    mentions: mentions || []
                }),
            });

            const data = await response.json();
            if (response.ok && data.status === 'SUCCESS') {
                return { success: true, comment: data.data.comment };
            }
            return {
                success: false,
                error: parseReelsCommentApiError(data, response.status, 'POST'),
                status: response.status,
            };
        } catch (error: any) {
            console.error('Error adding comment:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add a reply to a comment
     * Requirements 14.1, 14.2: Reply functionality for comments
     */
    static async addReply(
        token: string, 
        reelId: string, 
        parentCommentId: string,
        content: string,
        mentions?: string[]
    ): Promise<{ success: boolean; reply?: any; error?: string; status?: number }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/comments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    content, 
                    parentId: parentCommentId,
                    mentions: mentions || []
                }),
            });

            const data = await response.json();
            if (response.ok && data.status === 'SUCCESS') {
                return { success: true, reply: data.data.comment };
            }
            return {
                success: false,
                error: parseReelsCommentApiError(data, response.status, 'POST'),
                status: response.status,
            };
        } catch (error: any) {
            console.error('Error adding reply:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get replies for a comment
     * Requirements 14.4: View replies with count
     */
    static async getReplies(
        token: string, 
        commentId: string,
        limit: number = 20
    ): Promise<any[]> {
        try {
            const response = await fetch(`${API_URL}/reels/comments/${commentId}/replies?limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data.replies || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting replies:', error);
            return [];
        }
    }

    /**
     * Search users for mentions
     */
    static async searchUsersForMention(token: string, query: string): Promise<any[]> {
        try {
            const response = await fetch(`${API_URL}/reels/search/users?q=${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data.users || [];
            }
            return [];
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }

    /**
     * Search reels/videos by caption, hashtags, or username
     */
    static searchReels = monitorSearchPerformance(
        '/reels/search',
        async (
            token: string,
            query: string,
            limit: number = 10,
            type: 'all' | 'reels' | 'hashtags' = 'all'
        ): Promise<{ reels: any[]; hashtags: any[] }> => {
            try {
                const response = await fetch(
                    `${API_URL}/reels/search?q=${encodeURIComponent(query)}&limit=${limit}&type=${type}`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                const data = await response.json();
                if (data.status === 'SUCCESS') {
                    return data.data || { reels: [], hashtags: [] };
                }
                return { reels: [], hashtags: [] };
            } catch (error) {
                console.error('Error searching reels:', error);
                return { reels: [], hashtags: [] };
            }
        }
    );

    /**
     * Get trending hashtags (no auth required)
     */
    static getTrendingHashtags = monitorSearchPerformance(
        '/reels/trending-hashtags',
        async (): Promise<any[]> => {
            try {
                const response = await fetch(`${API_URL}/reels/trending-hashtags`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                const data = await response.json();
                if (data.status === 'SUCCESS') {
                    return data.data.hashtags || [];
                }
                return [];
            } catch (error) {
                console.error('Error getting trending hashtags:', error);
                return [];
            }
        }
    );

    /**
     * Delete a comment (own comments only)
     */
    static async deleteComment(token: string, commentId: string): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await fetch(`${API_URL}/reels/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, message: data.message };
            }
            return { success: false, message: data.message };
        } catch (error: any) {
            console.error('Error deleting comment:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Report a comment
     */
    static async reportComment(token: string, commentId: string, reason: string): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await fetch(`${API_URL}/reels/comments/${commentId}/report`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, message: data.message };
            }
            return { success: false, message: data.message };
        } catch (error: any) {
            console.error('Error reporting comment:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Delete own reel
     */
    static async deleteReel(token: string, reelId: string): Promise<{ success: boolean; message?: string; deletesUsed?: number; remainingDeletes?: number }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return {
                    success: true,
                    message: data.message,
                    deletesUsed: data.data?.deletesUsed,
                    remainingDeletes: data.data?.remainingDeletes,
                };
            }
            return { success: false, message: data.message };
        } catch (error: any) {
            console.error('Error deleting reel:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Edit reel caption and hashtags (own reels only)
     */
    static async editReel(
        token: string,
        reelId: string,
        updates: { caption?: string; hashtags?: string[] }
    ): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, message: data.message };
            }
            return { success: false, message: data.message };
        } catch (error: any) {
            console.error('Error editing reel:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Report a reel
     */
    static async reportReel(token: string, reelId: string, reason: string): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/report`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, message: data.message };
            }
            return { success: false, message: data.message };
        } catch (error: any) {
            console.error('Error reporting reel:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Like a comment
     */
    static async likeComment(token: string, commentId: string): Promise<{ success: boolean; likesCount?: number }> {
        try {
            const response = await fetch(`${API_URL}/reels/comments/${commentId}/like`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, likesCount: data.data?.likesCount };
            }
            return { success: false };
        } catch (error) {
            console.error('Error liking comment:', error);
            return { success: false };
        }
    }

    /**
     * Unlike a comment
     */
    static async unlikeComment(token: string, commentId: string): Promise<{ success: boolean; likesCount?: number }> {
        try {
            const response = await fetch(`${API_URL}/reels/comments/${commentId}/like`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, likesCount: data.data?.likesCount };
            }
            return { success: false };
        } catch (error) {
            console.error('Error unliking comment:', error);
            return { success: false };
        }
    }

    /**
     * Save a reel
     */
    static async saveReel(token: string, reelId: string): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/save`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, message: data.message };
            }
            return { success: false, message: data.message };
        } catch (error: any) {
            console.error('Error saving reel:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Unsave a reel
     */
    static async unsaveReel(token: string, reelId: string): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/save`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, message: data.message };
            }
            return { success: false, message: data.message };
        } catch (error: any) {
            console.error('Error unsaving reel:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Get saved reels
     */
    static async getSavedReels(token: string, cursor?: string): Promise<{ savedReels: ReelFeedItem[]; hasMore: boolean; nextCursor: string | null; totalCount?: number } | null> {
        try {
            const url = cursor
                ? `${API_URL}/reels/saved?cursor=${cursor}`
                : `${API_URL}/reels/saved`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('Error getting saved reels:', error);
            return null;
        }
    }

    /**
     * Record share action
     */
    static async recordShare(token: string, reelId: string, platform: string): Promise<{ success: boolean; sharesCount?: number }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/share`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ platform }),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, sharesCount: data.data?.sharesCount };
            }
            return { success: false };
        } catch (error) {
            console.error('Error recording share:', error);
            return { success: false };
        }
    }
}

// ============================================
// PROFILE SERVICE (Extended)
// ============================================

export interface ProfileCompletionStep {
    id: string;
    label: string; // Backend uses 'label' not 'name'
    completed: boolean; // Backend uses 'completed' not 'isCompleted'
    required: boolean;
    weight: number;
}

export interface ProfileCompletionStatus {
    percentage: number;
    completedSteps: number;
    totalSteps: number;
    steps: ProfileCompletionStep[];
    canUploadVideo: boolean;
    missingRequiredSteps: string[];
}

export class ProfileService {
    /**
     * Get profile completion status
     */
    static async getCompletionStatus(token: string): Promise<ProfileCompletionStatus | null> {
        try {
            logger.debug('[ProfileService] Fetching completion status...');
            
            const apiClient = new EnhancedApiClient(token);
            const response = await apiClient.get('/profile/completion', {
                priority: 'high',
                timeout: 20000, // 20 seconds for this critical operation
                retries: 3,
            });

            if (response.status === 'SUCCESS' && response.data) {
                logger.debug('[ProfileService] Completion status loaded successfully:', {
                    percentage: response.data.percentage,
                    completedSteps: response.data.completedSteps,
                });
                return response.data;
            }
            
            logger.warn('[ProfileService] Invalid response format:', response);
            return null;
        } catch (error: any) {
            logger.error('[ProfileService] Error getting profile completion:', {
                error: error.message,
                name: error.name,
            });
            return null;
        }
    }

    /**
     * Mark a profile completion step as completed
     */
    static async markStepCompleted(token: string, stepId: string): Promise<{ success: boolean; data?: ProfileCompletionStatus }> {
        try {
            logger.debug('[ProfileService] Marking step as completed:', stepId);
            
            const apiClient = new EnhancedApiClient(token);
            const response = await apiClient.post('/profile/completion/step', { stepId }, {
                priority: 'high',
                timeout: 15000,
                retries: 2,
            });

            if (response.status === 'SUCCESS' && response.data) {
                logger.debug('[ProfileService] Step marked as completed successfully:', {
                    stepId,
                    newPercentage: response.data.percentage,
                });
                return { success: true, data: response.data };
            }
            
            logger.warn('[ProfileService] Failed to mark step as completed:', {
                stepId,
                response,
            });
            return { success: false };
        } catch (error: any) {
            logger.error('[ProfileService] Error marking step completed:', {
                stepId,
                error: error.message,
                name: error.name,
            });
            return { success: false };
        }
    }

    /**
     * Update avatar (7 days cooldown)
     */
    static async updateAvatar(
        token: string, 
        avatarUrl: string, 
        storagePath?: string
    ): Promise<{ success: boolean; error?: string; daysRemaining?: number }> {
        try {
            const response = await fetch(`${API_URL}/profile/avatar`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ avatarUrl, storagePath }),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true };
            }
            return { success: false, error: data.message, daysRemaining: data.daysRemaining };
        } catch (error: any) {
            console.error('Error updating avatar:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update cover image (7 days cooldown)
     */
    static async updateCover(
        token: string, 
        coverUrl: string, 
        storagePath?: string
    ): Promise<{ success: boolean; error?: string; daysRemaining?: number }> {
        try {
            const response = await fetch(`${API_URL}/profile/cover`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ coverUrl, storagePath }),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true };
            }
            return { success: false, error: data.message, daysRemaining: data.daysRemaining };
        } catch (error: any) {
            console.error('Error updating cover:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Record profile view
     */
    static async recordProfileView(token: string, username: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_URL}/profile/${username}/view`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            return data.status === 'SUCCESS';
        } catch (error) {
            console.error('Error recording profile view:', error);
            return false;
        }
    }

    /**
     * Get profile analytics
     */
    static async getAnalytics(token: string): Promise<ProfileAnalytics | null> {
        try {
            const response = await fetch(`${API_URL}/profile/analytics`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 401 || response.status === 403) {
                return null;
            }

            const data = await safeJsonParse<any>(response, null);
            if (!data) return null;
            if (data.status === 'SUCCESS' && data.data) {
                return data.data;
            }
            // Backend returns { data: analytics } without a status wrapper.
            if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('Error getting analytics:', error);
            return null;
        }
    }

    /**
     * Get cooldowns for avatar, cover, reel upload, username
     */
    static async getCooldowns(token: string): Promise<CooldownsResponse | null> {
        try {
            const response = await fetch(`${API_URL}/profile/cooldowns`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 401 || response.status === 403) {
                return null;
            }

            const data = await safeJsonParse<any>(response, null);
            if (!data) return null;
            if (data.status === 'SUCCESS' && data.data) {
                return data.data;
            }
            if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('Error getting cooldowns:', error);
            return null;
        }
    }

    /**
     * Update social links
     */
    static async updateSocialLinks(
        token: string,
        socialLinks: Array<{ platform: string; url: string }>
    ): Promise<{ success: boolean; error?: string; socialLinks?: any[] }> {
        try {
            // Validate links
            if (socialLinks.length > 5) {
                return { success: false, error: 'Maximum 5 social links allowed' };
            }

            // Filter out empty links
            const validLinks = socialLinks.filter(link => link.url && link.url.trim() !== '');

            // Validate URLs
            for (const link of validLinks) {
                if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
                    link.url = `https://${link.url}`;
                }
            }

            const response = await fetch(`${API_URL}/clerk/social-links`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ socialLinks: validLinks }),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, socialLinks: data.data.socialLinks || [] };
            }
            return { success: false, error: data.message || 'Failed to update social links' };
        } catch (error: any) {
            console.error('Error updating social links:', error);
            return { success: false, error: error.message || 'Network error' };
        }
    }
}

// ============================================
// NOTIFICATION SERVICE
// ============================================

export interface SocialNotification {
    id: string;
    type:
        | 'FOLLOW'
        | 'FOLLOW_ACTIVITY'
        | 'LIKE'
        | 'COMMENT'
        | 'COMMENT_LIKE'
        | 'REPLY'
        | 'MENTION'
        | 'SHARE'
        | 'MATCH_UPDATE'
        | 'MATCH_GOAL'
        | 'MATCH_START'
        | 'MATCH_END'
        | 'MATCH_HALFTIME'
        | 'MATCH_FAVORITE'
        | 'MATCH_YELLOW_CARD'
        | 'MATCH_RED_CARD'
        | 'PREDICTION_RESULT'
        | 'GENERAL'
        | 'MODERATION_ALERT'
        | 'REPORT_SUBMITTED'
        | 'REPORT_RESOLVED'
        | 'AVATAR_UPLOAD'
        | 'AI_CHECKIN'
        | 'LEVEL_UP'
        | 'ACHIEVEMENT'
        | 'QUIZ_REWARD'
        | 'LEADERBOARD_TOP10'
        | 'LEADERBOARD_TOP3'
        | 'VIDEO_PROCESSED'
        | 'GIFT'
        | 'COIN_MILESTONE'
        | 'MILESTONE'
        | 'LUCKY_WHEEL'
        | 'LUCKY_WHEEL_RENEWED'
        | 'DAILY_QUIZ_RENEWED'
        | 'COOLDOWN_EXPIRED'
        | 'RE_ENGAGEMENT';
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    data?: {
        userId?: string;
        username?: string;
        avatar?: string;
        reelId?: string;
        commentId?: string;
        parentCommentId?: string;
        followerUsername?: string;
        followerAvatar?: string;
        matchId?: string;
        actorId?: string;
        actorUsername?: string;
        actorDisplayName?: string;
        actorAvatar?: string;
    };
}

export class NotificationService {
    /**
     * Get user notifications
     */
    static async getNotifications(
        token: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<SocialNotification[]> {
        try {
            const response = await fetch(
                `${API_URL}/notifications?limit=${limit}&offset=${offset}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data.notifications || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting notifications:', error);
            return [];
        }
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(token: string, notificationId: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            return data.status === 'SUCCESS';
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    }

    /**
     * Mark all notifications as read
     */
    static async markAllAsRead(token: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_URL}/notifications/read-all`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            return data.status === 'SUCCESS';
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            return false;
        }
    }

    /**
     * Delete a single notification
     */
    static async deleteNotification(token: string, notificationId: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_URL}/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            return data.status === 'SUCCESS';
        } catch (error) {
            console.error('Error deleting notification:', error);
            return false;
        }
    }

    /**
     * Delete all notifications (clear all)
     */
    static async clearAll(token: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_URL}/notifications/clear-all`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            // Surface unexpected errors to keep client/server state consistent
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error clearing all notifications:', response.status, errorText);
                return false;
            }

            const data = await response.json();
            return data.status === 'SUCCESS';
        } catch (error) {
            console.error('Error clearing all notifications:', error);
            return false;
        }
    }

    /**
     * Get unread count
     */
    static async getUnreadCount(token: string): Promise<number> {
        try {
            const response = await fetch(`${API_URL}/notifications/unread-count`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data.count || 0;
            }
            return 0;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    /**
     * Get API URL for external use
     */
    static getApiUrl(): string {
        return API_URL;
    }
}

export default AuthService;


// ============================================
// MATCHES SERVICE (Favorites & Push Notifications)
// ============================================

export interface FavoriteMatch {
    id: string;
    apiMatchId: number;
    homeTeam: string;
    awayTeam: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    matchDate: string;
    leagueName?: string;
}

export class MatchesService {
    /**
     * Add match to favorites
     */
    static async addFavorite(
        token: string,
        matchId: number,
        matchData: {
            homeTeam: string;
            awayTeam: string;
            homeTeamLogo?: string;
            awayTeamLogo?: string;
            matchDate: string;
            leagueName?: string;
        }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/matches/favorite/${matchId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(matchData),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true };
            }
            return { success: false, error: data.message };
        } catch (error: any) {
            console.error('Add favorite error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove match from favorites
     */
    static async removeFavorite(token: string, matchId: number): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/matches/favorite/${matchId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true };
            }
            return { success: false, error: data.message };
        } catch (error: any) {
            console.error('Remove favorite error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all favorite matches
     */
    static async getFavorites(token: string): Promise<FavoriteMatch[]> {
        try {
            const response = await fetch(`${API_URL}/matches/favorites`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data.favorites || [];
            }
            return [];
        } catch (error) {
            console.error('Get favorites error:', error);
            return [];
        }
    }

    /**
     * Check if match is favorited
     */
    static async isFavorite(token: string, matchId: number): Promise<boolean> {
        try {
            const response = await fetch(`${API_URL}/matches/favorite/${matchId}/check`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            return data.data?.isFavorite || false;
        } catch (error) {
            console.error('Check favorite error:', error);
            return false;
        }
    }

    /**
     * Register push token for notifications
     */
    static async registerPushToken(token: string, pushToken: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_URL}/matches/push-token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: pushToken,
                    platform: Platform.OS,
                }),
            });

            const data = await response.json();
            return data.status === 'SUCCESS';
        } catch (error) {
            console.error('Register push token error:', error);
            return false;
        }
    }
}

// ============================================
// DAILY SPIN SERVICE (عجلة الحظ اليومية)
// ============================================

export interface SpinPrize {
    coins: number;
    label: string;
    color: string;
}

export interface SpinStatus {
    canSpin: boolean;
    timeRemaining: { hours: number; minutes: number };
    currentCoins: number;
    lastSpin: string | null;
    spinHistory: { coinsWon: number; date: string }[];
    totalCoinsThisWeek: number;
    prizes: SpinPrize[];
}

export interface SpinResult {
    prize: SpinPrize;
    newBalance: number;
    nextSpinTime: string;
}

export class DailySpinService {
    /**
     * Get spin status - check if user can spin today
     */
    static async getStatus(token: string): Promise<SpinStatus | null> {
        try {
            const response = await fetch(`${API_URL}/daily-spin/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('Error getting spin status:', error);
            return null;
        }
    }

    /**
     * Spin the wheel
     */
    static async spin(token: string): Promise<{ success: boolean; data?: SpinResult; error?: string; timeRemaining?: { hours: number; minutes: number } }> {
        try {
            const response = await fetch(`${API_URL}/daily-spin/spin`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, data: data.data };
            }
            return { 
                success: false, 
                error: data.message,
                timeRemaining: data.timeRemaining 
            };
        } catch (error: any) {
            console.error('Error spinning wheel:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get spin history
     */
    static async getHistory(token: string, limit: number = 30): Promise<{ coinsWon: number; date: string }[]> {
        try {
            const response = await fetch(`${API_URL}/daily-spin/history?limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data.history || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting spin history:', error);
            return [];
        }
    }
}
