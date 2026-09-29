/**
 * Predictions Store
 * مخزن التوقعات - Zustand Store for Predictions
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../../config/api.config';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import {
    profilePredictionsListKey,
    profilePredictionStatsKey,
} from '../../services/predictionsCacheKeys';

/** Coalesce parallel remaining-count fetches (multiple screens mount at once). */
let fetchUserDataInFlight: Promise<void> | null = null;
let fetchUserPredictionsInFlight: Promise<void> | null = null;
let fetchPredictionStatsInFlight: Promise<void> | null = null;
let preloadProfilePredictionsInFlight: Promise<void> | null = null;

async function persistProfilePredictionsCache(
    userId: string,
    data: { allPredictions: PredictionsState['allPredictions']; stats: PredictionStats },
): Promise<void> {
    try {
        await Promise.all([
            AsyncStorage.setItem(profilePredictionsListKey(userId), JSON.stringify(data.allPredictions)),
            AsyncStorage.setItem(profilePredictionStatsKey(userId), JSON.stringify(data.stats)),
        ]);
    } catch {
        // cache write is best-effort
    }
}

interface PredictionData {
    type: 'home' | 'draw' | 'away';
    homeScore?: number;
    awayScore?: number;
}

interface UserPrediction {
    id: string;
    prediction: PredictionData;
    coinsSpent: number;
    coinsWon?: number;
    isCorrect?: boolean;
    createdAt: string;
}

interface PredictionStats {
    total: number;
    correct: number;
    incorrect: number;
    pending: number;
    accuracy: number;
    resolved: number;
    totalCoinsWon: number; // إجمالي الكوينز المكتسبة من التوقعات الصحيحة
}

interface PredictionsState {
    // User state
    userCoins: number;
    remainingPredictions: number;
    totalDailyPredictions: number;

    // Predictions map (matchId -> prediction)
    userPredictions: { [matchId: string]: UserPrediction };

    // Full predictions list (for "My Predictions" screen)
    allPredictions: Array<{
        id: string;
        apiMatchId: number;
        predictionType: string;
        homeTeam: string | null;
        awayTeam: string | null;
        homeTeamLogo: string | null;
        awayTeamLogo: string | null;
        matchDate: string | null;
        leagueName: string | null;
        isCorrect: boolean | null;
        coinsWon: number | null;
        coinsSpent: number;
        createdAt: string;
    }>;

    // Match prediction counts
    matchPredictionCounts: { [matchId: string]: number };

    // Prediction statistics
    stats: PredictionStats;

    // Loading states
    isLoading: boolean;
    isSubmitting: boolean;

    // Actions
    hydrateFromCache: (userId: string) => Promise<void>;
    fetchUserData: (token: string | null) => Promise<void>;
    fetchUserPredictions: (token: string | null, userId?: string) => Promise<void>;
    fetchPredictionStats: (token: string | null, userId?: string) => Promise<void>;
    preloadProfilePredictions: (token: string, userId: string) => Promise<void>;
    submitPrediction: (
        token: string | null,
        matchId: number,
        prediction: PredictionData,
        matchInfo: {
            homeTeam?: string;
            awayTeam?: string;
            homeTeamLogo?: string;
            awayTeamLogo?: string;
            matchDate?: string;
            leagueName?: string;
        }
    ) => Promise<{ success: boolean; error?: string }>;
    fetchMatchPredictionCounts: (matchIds: number[], token?: string | null) => Promise<void>;
    reset: () => void;
}

export const usePredictionsStore = create<PredictionsState>((set, get) => ({
    userCoins: 0,
    remainingPredictions: 10,
    totalDailyPredictions: 10,
    userPredictions: {},
    allPredictions: [],
    matchPredictionCounts: {},
    stats: {
        total: 0,
        correct: 0,
        incorrect: 0,
        pending: 0,
        accuracy: 0,
        resolved: 0,
        totalCoinsWon: 0
    },
    isLoading: false,
    isSubmitting: false,

    hydrateFromCache: async (userId: string) => {
        try {
            const [listRaw, statsRaw] = await Promise.all([
                AsyncStorage.getItem(profilePredictionsListKey(userId)),
                AsyncStorage.getItem(profilePredictionStatsKey(userId)),
            ]);
            const patch: Partial<PredictionsState> = {};
            if (listRaw) {
                const list = JSON.parse(listRaw);
                if (Array.isArray(list)) patch.allPredictions = list;
            }
            if (statsRaw) {
                const stats = JSON.parse(statsRaw);
                if (stats && typeof stats === 'object') patch.stats = stats;
            }
            if (Object.keys(patch).length) set(patch);
        } catch {
            // ignore corrupt cache
        }
    },

    preloadProfilePredictions: async (token: string, userId: string) => {
        if (preloadProfilePredictionsInFlight) {
            return preloadProfilePredictionsInFlight;
        }

        preloadProfilePredictionsInFlight = (async () => {
            try {
                const { fetchUserPredictions, fetchPredictionStats } = get();
                await Promise.all([
                    fetchUserPredictions(token, userId),
                    fetchPredictionStats(token, userId),
                ]);
            } finally {
                preloadProfilePredictionsInFlight = null;
            }
        })();

        return preloadProfilePredictionsInFlight;
    },

    fetchUserData: async (token: string | null) => {
        if (!token) return;

        if (fetchUserDataInFlight) {
            return fetchUserDataInFlight;
        }

        fetchUserDataInFlight = (async () => {
            try {
                set({ isLoading: true });

                const response = await fetchWithTimeout(`${getApiUrl()}/predictions/remaining`, {
                    timeout: 30000, // 30s to tolerate Railway cold-starts
                    retries: 1,
                    retryDelay: 1500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        set({
                            userCoins: data.data.coins,
                            remainingPredictions: data.data.remaining,
                            totalDailyPredictions: data.data.total,
                        });
                    }
                }
            } catch (error) {
                console.warn('⚠️ Could not fetch predictions data (server may be starting):', (error as any)?.message || error);
            } finally {
                set({ isLoading: false });
                fetchUserDataInFlight = null;
            }
        })();

        return fetchUserDataInFlight;
    },

    fetchUserPredictions: async (token: string | null, userId?: string) => {
        if (!token) return;

        if (fetchUserPredictionsInFlight) {
            return fetchUserPredictionsInFlight;
        }

        fetchUserPredictionsInFlight = (async () => {
            try {
                const response = await fetchWithTimeout(`${getApiUrl()}/predictions/user`, {
                    timeout: 30000,
                    retries: 1,
                    retryDelay: 1500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        const allPredictions = data.data.predictions || [];
                        set({
                            userPredictions: data.data.predictionsMap || {},
                            allPredictions,
                        });
                        if (userId) {
                            await persistProfilePredictionsCache(userId, {
                                allPredictions,
                                stats: get().stats,
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching user predictions:', error);
            } finally {
                fetchUserPredictionsInFlight = null;
            }
        })();

        return fetchUserPredictionsInFlight;
    },

    fetchPredictionStats: async (token: string | null, userId?: string) => {
        if (!token) return;

        if (fetchPredictionStatsInFlight) {
            return fetchPredictionStatsInFlight;
        }

        fetchPredictionStatsInFlight = (async () => {
            try {
                const response = await fetchWithTimeout(`${getApiUrl()}/predictions/stats`, {
                    timeout: 30000,
                    retries: 1,
                    retryDelay: 1500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        const stats = data.data;
                        set({ stats });
                        if (userId) {
                            await persistProfilePredictionsCache(userId, {
                                allPredictions: get().allPredictions,
                                stats,
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching prediction stats:', error);
            } finally {
                fetchPredictionStatsInFlight = null;
            }
        })();

        return fetchPredictionStatsInFlight;
    },

    submitPrediction: async (token, matchId, prediction, matchInfo) => {
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }

        const { remainingPredictions } = get();

        if (remainingPredictions <= 0) {
            return { success: false, error: 'Daily limit reached' };
        }

        try {
            set({ isSubmitting: true });

            const response = await fetchWithTimeout(`${getApiUrl()}/predictions`, {
                method: 'POST',
                timeout: 20000, // 20 seconds for submission
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    apiMatchId: matchId,
                    predictionType: prediction.type,
                    ...matchInfo,
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update local state
                set(state => ({
                    userCoins: data.data.newBalance,
                    remainingPredictions: data.data.remaining,
                    userPredictions: {
                        ...state.userPredictions,
                        [matchId]: {
                            id: data.data.prediction.id,
                            prediction: {
                                type: prediction.type,
                                homeScore: prediction.homeScore || 0,
                                awayScore: prediction.awayScore || 0,
                            },
                            coinsSpent: 0,
                            createdAt: new Date().toISOString(),
                        },
                    },
                    matchPredictionCounts: {
                        ...state.matchPredictionCounts,
                        [matchId]: (state.matchPredictionCounts[matchId] || 0) + 1,
                    },
                }));

                // ✅ SYNC: Update CoinsContext to sync with backend
                try {
                    const { CoinsService } = await import('../../services/coins.service');
                    await CoinsService.getBalance(); // This will sync from backend
                } catch (syncError) {
                    console.warn('Failed to sync coins after prediction:', syncError);
                }

                return { success: true };
            } else {
                return { success: false, error: data.error || 'Failed to submit prediction' };
            }
        } catch (error) {
            console.error('Error submitting prediction:', error);
            return { success: false, error: 'Network error' };
        } finally {
            set({ isSubmitting: false });
        }
    },

    fetchMatchPredictionCounts: async (matchIds: number[], token?: string | null) => {
        if (matchIds.length === 0) return;

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const response = await fetchWithTimeout(`${getApiUrl()}/predictions/matches/counts`, {
                method: 'POST',
                timeout: 30000,
                retries: 1,
                retryDelay: 1500,
                headers,
                body: JSON.stringify({ matchIds }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    set(state => ({
                        matchPredictionCounts: {
                            ...state.matchPredictionCounts,
                            ...data.data,
                        },
                    }));
                }
            }
        } catch (error) {
            console.error('Error fetching match prediction counts:', error);
        }
    },

    reset: () => {
        set({
            userCoins: 0,
            remainingPredictions: 10,
            totalDailyPredictions: 10,
            userPredictions: {},
            allPredictions: [],
            matchPredictionCounts: {},
            stats: {
                total: 0,
                correct: 0,
                incorrect: 0,
                pending: 0,
                accuracy: 0,
                resolved: 0,
                totalCoinsWon: 0,
            },
            isLoading: false,
            isSubmitting: false,
        });
    },
}));

// Helper hook to format prediction count
export const formatPredictionCount = (count: number): string => {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
};
