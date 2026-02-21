/**
 * Predictions Store
 * مخزن التوقعات - Zustand Store for Predictions
 */

import { create } from 'zustand';
import { getApiUrl } from '../../config/api.config';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

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

    // Match prediction counts
    matchPredictionCounts: { [matchId: string]: number };

    // Prediction statistics
    stats: PredictionStats;

    // Loading states
    isLoading: boolean;
    isSubmitting: boolean;

    // Actions
    fetchUserData: (token: string | null) => Promise<void>;
    fetchUserPredictions: (token: string | null) => Promise<void>;
    fetchPredictionStats: (token: string | null) => Promise<void>;
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
    fetchMatchPredictionCounts: (matchIds: number[]) => Promise<void>;
    reset: () => void;
}

export const usePredictionsStore = create<PredictionsState>((set, get) => ({
    userCoins: 0,
    remainingPredictions: 5,
    totalDailyPredictions: 5,
    userPredictions: {},
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

    fetchUserData: async (token: string | null) => {
        if (!token) return;

        try {
            set({ isLoading: true });

            const response = await fetchWithTimeout(`${getApiUrl()}/predictions/remaining`, {
                timeout: 15000, // 15 seconds
                headers: {
                    'Content-Type': 'application/json',
                    'x-clerk-user-id': token,
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
            console.error('Error fetching user data:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    fetchUserPredictions: async (token: string | null) => {
        if (!token) return;

        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/predictions/user`, {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json',
                    'x-clerk-user-id': token,
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    set({ userPredictions: data.data.predictionsMap || {} });
                }
            }
        } catch (error) {
            console.error('Error fetching user predictions:', error);
        }
    },

    fetchPredictionStats: async (token: string | null) => {
        if (!token) return;

        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/predictions/stats`, {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    set({ stats: data.data });
                }
            }
        } catch (error) {
            console.error('Error fetching prediction stats:', error);
        }
    },

    submitPrediction: async (token, matchId, prediction, matchInfo) => {
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }

        const { remainingPredictions, userCoins } = get();

        if (remainingPredictions <= 0) {
            return { success: false, error: 'Daily limit reached' };
        }

        if (userCoins < 5) {
            return { success: false, error: 'Insufficient coins' };
        }

        try {
            set({ isSubmitting: true });

            const response = await fetchWithTimeout(`${getApiUrl()}/predictions`, {
                method: 'POST',
                timeout: 20000, // 20 seconds for submission
                headers: {
                    'Content-Type': 'application/json',
                    'x-clerk-user-id': token,
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
                            coinsSpent: 5,
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

    fetchMatchPredictionCounts: async (matchIds: number[]) => {
        if (matchIds.length === 0) return;

        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/predictions/matches/counts`, {
                method: 'POST',
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json',
                },
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
            remainingPredictions: 5,
            totalDailyPredictions: 5,
            userPredictions: {},
            matchPredictionCounts: {},
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
