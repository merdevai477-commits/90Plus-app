/**
 * Custom hook for managing League Center data fetching and state
 * ✅ OPTIMIZED: Cache-first pattern with background refresh
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Match } from './matchCardUtils';
import { fetchMatchesByDate, fetchLiveMatches } from './leagueApiUtils';
import { cacheService } from '../../services/cacheService';
import { logger } from '../../utils/logger';

export interface UseLeagueCenterDataResult {
  matches: Match[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Cache key for league center data
const getLeagueCacheKey = (date: Date) => `league_center_${date.toISOString().split('T')[0]}`;

export const useLeagueCenterData = (selectedDate: Date): UseLeagueCenterDataResult => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (isFetchingRef.current && !forceRefresh) return;
    isFetchingRef.current = true;
    
    setError(null);

    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const isToday = dateString === today;
      const cacheKey = getLeagueCacheKey(selectedDate);

      // ✅ OPTIMIZATION: Try cache first for instant display
      if (!forceRefresh) {
        const cached = await cacheService.get<Match[]>(cacheKey);
        if (cached && cached.length > 0) {
          logger.debug(`📦 League center cache hit for ${dateString}`);
          setMatches(cached);
          setLoading(false);
          
          // For past dates, don't refresh (data won't change)
          if (dateString < today) {
            isFetchingRef.current = false;
            return;
          }
          
          // For today/future, refresh in background
          fetchDataInBackground(selectedDate, isToday, cacheKey);
          isFetchingRef.current = false;
          return;
        }
      }

      setLoading(true);

      let fetchedMatches: Match[];

      if (isToday) {
        // For today, fetch both live matches and scheduled matches
        const [liveMatches, scheduledMatches] = await Promise.all([
          fetchLiveMatches(),
          fetchMatchesByDate(selectedDate),
        ]);

        // Merge and deduplicate matches (live matches take priority)
        const liveMatchIds = new Set(liveMatches.map((m: Match) => m.id));
        const uniqueScheduledMatches = scheduledMatches.filter((m: Match) => !liveMatchIds.has(m.id));
        fetchedMatches = [...liveMatches, ...uniqueScheduledMatches];
      } else {
        // For other dates, just fetch scheduled matches
        fetchedMatches = await fetchMatchesByDate(selectedDate);
      }

      setMatches(fetchedMatches);
      
      // Cache the results
      const cacheTTL = dateString < today 
        ? 30 * 24 * 60 * 60 * 1000  // 30 days for past
        : isToday 
          ? 2 * 60 * 1000           // 2 minutes for today
          : 60 * 60 * 1000;         // 1 hour for future
      await cacheService.set(cacheKey, fetchedMatches, cacheTTL);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load matches';
      setError(errorMessage);
      logger.error('Error fetching league center data:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [selectedDate]);

  // Background refresh function (non-blocking)
  const fetchDataInBackground = async (date: Date, isToday: boolean, cacheKey: string) => {
    try {
      let fetchedMatches: Match[];

      if (isToday) {
        const [liveMatches, scheduledMatches] = await Promise.all([
          fetchLiveMatches(),
          fetchMatchesByDate(date),
        ]);
        const liveMatchIds = new Set(liveMatches.map((m: Match) => m.id));
        const uniqueScheduledMatches = scheduledMatches.filter((m: Match) => !liveMatchIds.has(m.id));
        fetchedMatches = [...liveMatches, ...uniqueScheduledMatches];
      } else {
        fetchedMatches = await fetchMatchesByDate(date);
      }

      setMatches(fetchedMatches);
      await cacheService.set(cacheKey, fetchedMatches, isToday ? 2 * 60 * 1000 : 60 * 60 * 1000);
    } catch (err) {
      // Silent fail for background refresh
      logger.warn('Background refresh failed:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    matches,
    loading,
    error,
    refetch,
  };
};

export default useLeagueCenterData;

