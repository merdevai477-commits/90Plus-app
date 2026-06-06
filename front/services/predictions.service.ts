/**
 * Predictions Service
 * خدمة التوقعات - للتعامل مع APIs التوقعات
 */

import { logger } from '../utils/logger';
import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl(); // Already includes /api

// ─── In-flight deduplication ──────────────────────────────────────────────────
// Multiple screens (Home, Matches, Rank) call getRemainingPredictions and
// getUserPredictions on mount at the same time. Without dedup, that's 3+
// concurrent requests to the same endpoint which burns rate-limit quota.
let _inFlightRemaining: Promise<PredictionRemaining> | null = null;
let _inFlightUserPreds: Promise<any> | null = null;
let _inFlightPublicPreds = new Map<string, Promise<PublicUserPredictionsPayload>>();

export interface PublicUserPredictionsPayload {
  stats: {
    total: number;
    correct: number;
    incorrect: number;
    pending: number;
    accuracy: number;
    resolved: number;
    totalCoinsWon: number;
  };
  predictions: Prediction[];
}

export interface PredictionType {
  type: 'home' | 'draw' | 'away';
}

export interface Prediction {
  id: string;
  apiMatchId: string;
  predictionType: 'home' | 'draw' | 'away';
  coinsSpent: number;
  coinsWon?: number;
  isCorrect?: boolean | null;
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

/**
 * Strongly-typed prediction API error. The frontend matches on `code` (a
 * stable identifier from the backend, e.g. 'E005') rather than the human
 * `message`, so localization or wording changes never break branching logic.
 */
export class PredictionApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PredictionApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const PredictionsService = {
  /**
   * Best-effort error parsing for non-OK responses.
   * Handles JSON and non-JSON bodies (e.g., 502 HTML). Returns a typed
   * PredictionApiError so callers can branch on the error code instead of
   * substring-matching the message.
   */
  _parseError: async (response: Response): Promise<PredictionApiError> => {
    const contentType = response.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        const data: any = await response.json();
        const code = typeof data?.error === 'string' ? data.error : 'E010';
        const message = data?.message || data?.error || response.statusText || `HTTP ${response.status}`;
        const details = data?.details && typeof data.details === 'object' ? data.details as Record<string, unknown> : undefined;
        return new PredictionApiError(code, String(message), response.status, details);
      }
      const text = await response.text();
      const snippet = text ? text.slice(0, 500) : (response.statusText || `HTTP ${response.status}`);
      return new PredictionApiError('E010', snippet, response.status);
    } catch {
      return new PredictionApiError('E010', response.statusText || `HTTP ${response.status}`, response.status);
    }
  },

  /**
   * Get remaining daily predictions
   */
  getRemainingPredictions: async (token: string): Promise<PredictionRemaining> => {
    // Collapse concurrent calls — multiple screens call this on mount.
    if (_inFlightRemaining) return _inFlightRemaining;

    _inFlightRemaining = (async () => {
      try {
        const response = await fetch(`${API_URL}/predictions/remaining`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw await PredictionsService._parseError(response);
        }

        const result = await response.json();
        if (result.success && result.data) return result.data;
        // Return safe defaults instead of crashing
        logger.warn('Predictions remaining: invalid response format, using defaults');
        return { remaining: 10, total: 10, coins: 0 } as PredictionRemaining;
      } catch (error) {
        logger.error('Error getting remaining predictions:', error);
        return { remaining: 10, total: 10, coins: 0 } as PredictionRemaining;
      } finally {
        _inFlightRemaining = null;
      }
    })();

    return _inFlightRemaining;
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
        throw await PredictionsService._parseError(response);
      }

      const result = await response.json();

      if (result.success && result.data) {
        return result.data;
      }

      throw new PredictionApiError('E010', 'Invalid response format', response.status);
    } catch (error) {
      logger.error('Error submitting prediction:', error);
      throw error;
    }
  },

  /**
   * Get user predictions
   */
  getUserPredictions: async (token: string): Promise<{ predictions: Prediction[]; predictionsMap: Record<string, Prediction & { prediction: { type: 'home' | 'draw' | 'away' } }> }> => {
    // Collapse concurrent calls.
    if (_inFlightUserPreds) return _inFlightUserPreds;

    _inFlightUserPreds = (async () => {
      try {
        const response = await fetch(`${API_URL}/predictions/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw await PredictionsService._parseError(response);
        }

        const result = await response.json();
        if (result.success && result.data) return result.data;
        // Return empty defaults instead of crashing
        logger.warn('User predictions: invalid response format, using empty defaults');
        return { predictions: [], predictionsMap: {} };
      } catch (error) {
        logger.error('Error getting user predictions:', error);
        // Return empty defaults when backend is unreachable
        return { predictions: [], predictionsMap: {} };
      } finally {
        _inFlightUserPreds = null;
      }
    })();

    return _inFlightUserPreds;
  },

  /**
   * Public prediction analytics for another user's profile
   */
  getPublicUserPredictions: async (
    username: string,
    token?: string | null,
  ): Promise<PublicUserPredictionsPayload> => {
    const key = username.trim().toLowerCase();
    const inflight = _inFlightPublicPreds.get(key);
    if (inflight) return inflight;

    const flight = (async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${API_URL}/predictions/public/${encodeURIComponent(key)}`, {
          headers,
        });

        if (!response.ok) {
          throw await PredictionsService._parseError(response);
        }

        const result = await response.json();
        if (result.success && result.data) {
          return {
            stats: result.data.stats ?? {
              total: 0,
              correct: 0,
              incorrect: 0,
              pending: 0,
              accuracy: 0,
              resolved: 0,
              totalCoinsWon: 0,
            },
            predictions: result.data.predictions ?? [],
          };
        }
        return { stats: { total: 0, correct: 0, incorrect: 0, pending: 0, accuracy: 0, resolved: 0, totalCoinsWon: 0 }, predictions: [] };
      } catch (error) {
        logger.error('Error getting public user predictions:', error);
        throw error;
      } finally {
        _inFlightPublicPreds.delete(key);
      }
    })();

    _inFlightPublicPreds.set(key, flight);
    return flight;
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
        throw await PredictionsService._parseError(response);
      }

      const result = await response.json();

      if (result.success && result.data) {
        return result.data;
      }

      throw new PredictionApiError('E010', 'Invalid response format', response.status);
    } catch (error) {
      logger.error('Error getting match prediction count:', error);
      throw error;
    }
  },
};
