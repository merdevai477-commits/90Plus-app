/**
 * Hook to fetch daily predictions remaining count
 * Caches result for 1 minute to reduce API calls
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';

interface DailyPredictionsData {
  remaining: number;
  total: number;
  used: number;
  coins: number;
  predictionCost: number;
}

interface UseDailyPredictionsResult {
  data: DailyPredictionsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Cache for 1 minute
const CACHE_TTL = 60 * 1000;
let cache: { data: DailyPredictionsData; timestamp: number } | null = null;

export const useDailyPredictions = (token?: string | null): UseDailyPredictionsResult => {
  const [data, setData] = useState<DailyPredictionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchPredictions = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // Check cache first
      if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
        setData(cache.data);
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      if (!token) {
        setData(null);
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      setLoading(true);
      setError(null);

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/predictions/remaining`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch predictions: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const predictionsData: DailyPredictionsData = {
          remaining: result.data.remaining || 0,
          total: result.data.total || 10,
          used: result.data.used || 0,
          coins: result.data.coins || 0,
          predictionCost: result.data.predictionCost || 5,
        };

        // Update cache
        cache = {
          data: predictionsData,
          timestamp: Date.now(),
        };

        setData(predictionsData);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      logger.error('Error fetching daily predictions:', err);
      setError(err.message || 'Failed to load predictions');
      setData(null);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const refetch = useCallback(async () => {
    // Clear cache on manual refetch
    cache = null;
    await fetchPredictions();
  }, [fetchPredictions]);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

