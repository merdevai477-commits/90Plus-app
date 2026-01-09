import { getApiUrl } from '../../config/api.config';
import { requestDeduplicator } from '../../services/requestDeduplicator';

const API_URL = getApiUrl();

// ✅ OPTIMIZATION: Faster timeout for API calls
const API_TIMEOUT = 10000; // 10 seconds (was default ~30s)

// ✅ SUPER SPEED: In-memory cache for instant responses
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const MEMORY_CACHE_TTL = 60 * 1000; // 1 minute for memory cache

// Debouncing for syncUserWithBackend to prevent multiple simultaneous calls
const syncDebounceTimers = new Map<string, NodeJS.Timeout>();
const SYNC_DEBOUNCE_MS = 500; // Wait 500ms before calling, cancel previous if new call comes

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
}

export interface AuthResponse {
    status: 'SUCCESS' | 'ERROR';
    data?: {
        user: UserProfile;
    };
    message?: string;
}

/**
 * Authentication Service
 * Handles all communication with the backend for user authentication
 */
export class AuthService {
    /**
     * Sync user with backend after Clerk authentication
     * This creates the user in the database if they don't exist
     * ✅ SUPER SPEED: Uses memory cache + timeout for instant response
     * ✅ DEBOUNCING: Prevents multiple simultaneous calls
     */
    static async syncUserWithBackend(token: string): Promise<UserProfile | null> {
        try {
            // ✅ SUPER SPEED: Check memory cache first
            const cacheKey = `user_${token.substring(0, 20)}`;
            const cached = getFromMemoryCache(cacheKey);
            if (cached) {
                console.log('⚡ User from memory cache');
                return cached;
            }

            // ✅ DEBOUNCING: Cancel previous call if new one comes within 500ms
            const existingTimer = syncDebounceTimers.get(cacheKey);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            // Return a promise that will resolve after debounce period
            return new Promise((resolve) => {
                const timer = setTimeout(async () => {
                    syncDebounceTimers.delete(cacheKey);
                    
                    try {
                        console.log('🔄 Syncing user with backend...');

                        const response = await fetchWithTimeout(`${API_URL}/clerk/me`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        });

                        const data: AuthResponse = await response.json();

                        if (data.status === 'SUCCESS' && data.data?.user) {
                            console.log('✅ User synced successfully:', data.data.user.username);
                            // ✅ Cache in memory for instant future access
                            setMemoryCache(cacheKey, data.data.user);
                            resolve(data.data.user);
                        } else {
                            // Silent error handling - don't log sync errors
                            resolve(null);
                        }
                    } catch (error: any) {
                        // Silent error handling - don't log sync errors (including rate limits)
                        resolve(null);
                    }
                }, SYNC_DEBOUNCE_MS);

                syncDebounceTimers.set(cacheKey, timer);
            });
        } catch (error: any) {
            console.error('❌ Error syncing user with backend:', error);
            return null;
        }
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
        console.log('🧹 AuthService memory cache cleared');
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
            console.log('🔄 Updating user profile...');

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
                console.log('✅ Profile updated successfully');
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
            console.log('🔄 Updating username...');

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
                console.log('✅ Username updated successfully');
                return { success: true, username: data.data?.username };
            } else if (data.code === 'COOLDOWN_ACTIVE') {
                console.log('⏳ Username change on cooldown:', data.daysRemaining, 'days remaining');
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
            console.log('🔄 Syncing user data from Clerk...');

            const response = await fetch(`${API_URL}/clerk/sync`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data: AuthResponse = await response.json();

            if (data.status === 'SUCCESS' && data.data?.user) {
                console.log('✅ User synced from Clerk successfully');
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
    static async searchUsers(
        token: string,
        query: string,
        limit: number = 10
    ): Promise<SearchUserResult[]> {
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

    /**
     * Get public user profile by username
     */
    static async getUserByUsername(
        token: string,
        username: string
    ): Promise<SearchUserResult | null> {
        try {
            const response = await fetch(`${API_URL}/clerk/user/${username}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
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
        token: string,
        username: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<UserReel[]> {
        try {
            const response = await fetch(
                `${API_URL}/clerk/user/${username}/reels?limit=${limit}&offset=${offset}`,
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
                return data.data.reels || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting user reels:', error);
            return [];
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
    socialLinks?: Array<{ // ✅ NEW
        platform: string;
        url: string;
        username?: string;
    }>;
}

export interface UserReel {
    id: string;
    uri: string;
    thumbnail: string | null;
    caption: string | null;
    views: string;
    likes: number;
    comments: number;
    createdAt: string;
}

export interface FollowStats {
    followersCount: number;
    followingCount: number;
    reelsCount: number;
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

            const data = await response.json();
            if (data.status === 'SUCCESS') {
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
    static async getFollowers(token: string, userId: string): Promise<any[]> {
        try {
            const response = await fetch(`${API_URL}/clerk/followers/${userId}`, {
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
    static async getFollowing(token: string, userId: string): Promise<any[]> {
        try {
            const response = await fetch(`${API_URL}/clerk/following/${userId}`, {
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
     * Increment view count
     */
    static async recordView(token: string, reelId: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/view`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            return data.status === 'SUCCESS';
        } catch (error) {
            console.error('Error recording view:', error);
            return false;
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
    static async getComments(token: string, reelId: string, limit: number = 3): Promise<any[]> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/comments?limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return data.data.comments || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting comments:', error);
            return [];
        }
    }

    /**
     * Add a comment to a reel
     */
    static async addComment(
        token: string, 
        reelId: string, 
        content: string
    ): Promise<{ success: boolean; comment?: any; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/comments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content }),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, comment: data.data.comment };
            }
            return { success: false, error: data.message };
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
        content: string
    ): Promise<{ success: boolean; reply?: any; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/reels/${reelId}/comments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content, parentId: parentCommentId }),
            });

            const data = await response.json();
            if (data.status === 'SUCCESS') {
                return { success: true, reply: data.data.comment };
            }
            return { success: false, error: data.message };
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
    static async searchReels(
        token: string,
        query: string,
        limit: number = 10,
        type: 'all' | 'reels' | 'hashtags' = 'all'
    ): Promise<{ reels: any[]; hashtags: any[] }> {
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

    /**
     * Get trending hashtags (no auth required)
     */
    static async getTrendingHashtags(): Promise<any[]> {
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
    static async getSavedReels(token: string, cursor?: string): Promise<{ savedReels: ReelFeedItem[]; hasMore: boolean; nextCursor: string | null } | null> {
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

export class ProfileService {
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

            const data = await response.json();
            if (data.status === 'SUCCESS') {
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

            const data = await response.json();
            if (data.status === 'SUCCESS') {
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
    type: 'FOLLOW' | 'LIKE' | 'COMMENT' | 'REPLY' | 'MENTION' | 'MATCH_UPDATE' | 'MATCH_FAVORITE' | 'GENERAL' | 'MODERATION_ALERT';
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
                body: JSON.stringify({ token: pushToken }),
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
