/**
 * Predictions Service
 * خدمة التوقعات - للتعامل مع APIs التوقعات
 */

import { logger } from '../utils/logger';
import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl(); // Already includes /api

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
   * Best-effort error parsing for non-OK responses.
   * Handles JSON and non-JSON bodies (e.g., 502 HTML).
   */
  _parseError: async (response: Response): Promise<string> => {
    const contentType = response.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        const data: any = await response.json();
        return data?.message || data?.error || data?.statusText || response.statusText || `HTTP ${response.status}`;
      }
      const text = await response.text();
      if (text) return text.slice(0, 500);
    } catch {
      // ignore parsing errors
    }
    return response.statusText || `HTTP ${response.status}`;
  },

  /**
   * Get remaining daily predictions
   */
  getRemainingPredictions: async (token: string): Promise<PredictionRemaining> => {
    try {
      const response = await fetch(`${API_URL}/predictions/remaining`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const msg = await PredictionsService._parseError(response);
        throw new Error(msg || `Failed to get remaining predictions: ${response.statusText}`);
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
      const response = await fetch(`${API_URL}/predictions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(matchData),
      });

      if (!response.ok) {
        const msg = await PredictionsService._parseError(response);
        throw new Error(msg || `Failed to submit prediction: ${response.statusText}`);
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
  getUserPredictions: async (token: string): Promise<{ predictions: Prediction[]; predictionsMap: Record<string, Prediction & { prediction: { type: 'home' | 'draw' | 'away' } }> }> => {
    try {
      const response = await fetch(`${API_URL}/predictions/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const msg = await PredictionsService._parseError(response);
        throw new Error(msg || `Failed to get user predictions: ${response.statusText}`);
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
      const response = await fetch(`${API_URL}/predictions/match/${matchId}/count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const msg = await PredictionsService._parseError(response);
        throw new Error(msg || `Failed to get match prediction count: ${response.statusText}`);
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
