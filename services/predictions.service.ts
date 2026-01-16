/**
 * Predictions Service
 * خدمة التوقعات - للتعامل مع APIs التوقعات
 */

import { logger } from '../utils/logger';
import { getApiUrl } from '../config/api.config';

const getAPIUrl = () => {
  const apiUrl = getApiUrl();
  // Remove /api suffix if present since we'll add it in the endpoints
  return apiUrl.replace(/\/api$/, '');
};

export interface PredictionType {
  type: 'home' | 'draw' | 'away';
}

export interface Prediction {
  id: string;
  apiMatchId: string;
  predictionType: 'home' | 'draw' | 'away';
  coinsSpent: number;
  coinsWon?: number;
  isCorrect?: boolean;
  createdAt: string;
  homeTeam?: string;
  awayTeam?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  matchDate?: string;
  leagueName?: string;
}

export interface PredictionRemaining {
  remaining: number;
  total: number;
  used: number;
  coins: number;
  predictionCost: number;
}

export const PredictionsService = {
  /**
   * Get remaining daily predictions
   */
  getRemainingPredictions: async (token: string): Promise<PredictionRemaining> => {
    try {
      const API_URL = getAPIUrl();
      const response = await fetch(`${API_URL}/api/predictions/remaining`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-clerk-user-id': token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get remaining predictions: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        return result.data;
      }

      throw new Error('Invalid response format');
    } catch (error) {
      logger.error('Error getting remaining predictions:', error);
      throw error;
    }
  },

  /**
   * Submit a prediction
   */
  submitPrediction: async (
    token: string,
    matchData: {
      apiMatchId: string;
      predictionType: 'home' | 'draw' | 'away';
      homeTeam: string;
      awayTeam: string;
      homeTeamLogo?: string;
      awayTeamLogo?: string;
      matchDate: string;
      leagueName?: string;
    }
  ): Promise<Prediction> => {
    try {
      const API_URL = getAPIUrl();
      const response = await fetch(`${API_URL}/api/predictions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-clerk-user-id': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(matchData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to submit prediction: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        return result.data;
      }

      throw new Error('Invalid response format');
    } catch (error) {
      logger.error('Error submitting prediction:', error);
      throw error;
    }
  },

  /**
   * Get user predictions
   */
  getUserPredictions: async (token: string): Promise<{ predictions: Prediction[]; predictionsMap: { [key: string]: any } }> => {
    try {
      const API_URL = getAPIUrl();
      const response = await fetch(`${API_URL}/api/predictions/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-clerk-user-id': token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user predictions: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        return result.data;
      }

      throw new Error('Invalid response format');
    } catch (error) {
      logger.error('Error getting user predictions:', error);
      throw error;
    }
  },

  /**
   * Get prediction count for a specific match
   */
  getMatchPredictionCount: async (token: string, matchId: string): Promise<{
    home: number;
    draw: number;
    away: number;
    total: number;
  }> => {
    try {
      const API_URL = getAPIUrl();
      const response = await fetch(`${API_URL}/api/predictions/match/${matchId}/count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-clerk-user-id': token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get match prediction count: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        return result.data;
      }

      throw new Error('Invalid response format');
    } catch (error) {
      logger.error('Error getting match prediction count:', error);
      throw error;
    }
  },
};
