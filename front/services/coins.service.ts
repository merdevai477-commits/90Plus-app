import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api.config';
import { safeJsonParse } from '../utils/safeJsonParse';

const COINS_STORAGE_KEY_PREFIX = '@user_coins_';
const INITIAL_COINS = 50;

// Current user ID - must be set before using the service
let currentUserId: string | null = null;
let currentToken: string | null = null;

// ✅ PERFORMANCE: Cache for coins balance (5 seconds TTL)
let coinsCache: { balance: number; timestamp: number } | null = null;
const COINS_CACHE_TTL = 5000; // 5 seconds

/**
 * Get the storage key for the current user
 */
const getStorageKey = (): string => {
    if (!currentUserId) {
        throw new Error('User ID not set. Call setCurrentUser first.');
    }
    return `${COINS_STORAGE_KEY_PREFIX}${currentUserId}`;
};

export const CoinsService = {
    /**
     * Set the current user ID and token - MUST be called when user logs in
     */
    setCurrentUser: (userId: string | null, token: string | null = null) => {
        currentUserId = userId;
        currentToken = token;
    },

    /**
     * Get current user ID
     */
    getCurrentUser: (): string | null => {
        return currentUserId;
    },

    /**
     * Get current coin balance for the logged-in user
     * ✅ FIXED: Fetches from Backend first, then syncs with AsyncStorage
     * ✅ PERFORMANCE: Added cache to reduce API calls
     */
    getBalance: async (forceRefresh = false): Promise<number> => {
        try {
            if (!currentUserId) {
                return INITIAL_COINS;
            }

            // ✅ PERFORMANCE: Check cache first (unless force refresh)
            if (!forceRefresh && coinsCache && Date.now() - coinsCache.timestamp < COINS_CACHE_TTL) {
                return coinsCache.balance;
            }

            // ✅ PRIORITY 1: Fetch from Backend (source of truth)
            if (currentToken) {
                try {
                    const response = await fetch(`${getApiUrl()}/coins/balance`, {
                        headers: {
                            'Authorization': `Bearer ${currentToken}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    if (response.ok) {
                        const data = await safeJsonParse<any>(response, { status: 'ERROR', data: null });
                        if (data && data.status === 'SUCCESS' && data.data?.coins !== undefined) {
                            const backendCoins = data.data.coins;
                            
                            // ✅ Update cache
                            coinsCache = { balance: backendCoins, timestamp: Date.now() };
                            
                            // Sync with AsyncStorage
                            const storageKey = getStorageKey();
                            await AsyncStorage.setItem(storageKey, backendCoins.toString());
                            
                            return backendCoins;
                        }
                    }
                } catch (apiError) {
                    // Silent fail - use cache
                }
            }

            // ✅ FALLBACK: Use AsyncStorage cache
            const storageKey = getStorageKey();
            const storedCoins = await AsyncStorage.getItem(storageKey);
            if (storedCoins !== null) {
                const cachedBalance = parseInt(storedCoins, 10);
                // Update cache
                coinsCache = { balance: cachedBalance, timestamp: Date.now() };
                return cachedBalance;
            } else {
                // Initialize for new user
                await AsyncStorage.setItem(storageKey, INITIAL_COINS.toString());
                coinsCache = { balance: INITIAL_COINS, timestamp: Date.now() };
                return INITIAL_COINS;
            }
        } catch (error) {
            return INITIAL_COINS;
        }
    },

    /**
     * Update coin balance for the logged-in user
     * ✅ FIXED: Updates Backend first, then syncs with AsyncStorage
     * ✅ PERFORMANCE: Updates cache immediately
     */
    updateBalance: async (newBalance: number): Promise<void> => {
        try {
            if (!currentUserId) {
                return;
            }

            // ✅ PERFORMANCE: Update cache immediately
            coinsCache = { balance: newBalance, timestamp: Date.now() };

            // ✅ PRIORITY 1: Update Backend (source of truth)
            if (currentToken) {
                try {
                    // Get current balance first (with cache)
                    const currentBalance = await CoinsService.getBalance(true); // Force refresh
                    const difference = newBalance - currentBalance;

                    if (difference > 0) {
                        // Add coins
                        await fetch(`${getApiUrl()}/coins/add`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${currentToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                amount: difference,
                                description: 'Balance update',
                                type: 'OTHER'
                            }),
                        });
                    } else if (difference < 0) {
                        // Subtract coins
                        await fetch(`${getApiUrl()}/coins/subtract`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${currentToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                amount: Math.abs(difference),
                                description: 'Balance update',
                                type: 'OTHER'
                            }),
                        });
                    }
                } catch (apiError) {
                    // Silent fail - cache already updated
                }
            }

            // ✅ FALLBACK: Update AsyncStorage cache
            const storageKey = getStorageKey();
            await AsyncStorage.setItem(storageKey, newBalance.toString());
        } catch (error) {
            throw error;
        }
    },

    /**
     * Reset balance for the logged-in user
     */
    resetBalance: async (): Promise<number> => {
        try {
            if (!currentUserId) {
                console.warn('CoinsService: No user logged in, cannot reset balance');
                return INITIAL_COINS;
            }
            const storageKey = getStorageKey();
            await AsyncStorage.setItem(storageKey, INITIAL_COINS.toString());
            return INITIAL_COINS;
        } catch (error) {
            console.error('Error resetting coin balance:', error);
            throw error;
        }
    },

    /**
     * Set auth token for API calls
     */
    setToken: (token: string | null) => {
        currentToken = token;
    },

    /**
     * Clear user data on logout
     */
    clearCurrentUser: () => {
        currentUserId = null;
        currentToken = null;
        coinsCache = null; // Clear cache on logout
    },

    /**
     * Invalidate cache (force refresh on next getBalance)
     */
    invalidateCache: () => {
        coinsCache = null;
    }
};
