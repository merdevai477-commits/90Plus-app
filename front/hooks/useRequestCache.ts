/**
 * useRequestCache Hook
 * 
 * React hook for cached API requests with deduplication.
 * Prevents duplicate requests from multiple components.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { requestDeduplicator } from '../services/requestDeduplicator';

interface UseRequestCacheOptions<T> {
  endpoint: string;
  fetchFn: (token: string | null) => Promise<T>;
  params?: Record<string, any>;
  enabled?: boolean;
  userId?: string;
}

interface UseRequestCacheResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRequestCache<T>({
  endpoint,
  fetchFn,
  params,
  enabled = true,
  userId,
}: UseRequestCacheOptions<T>): UseRequestCacheResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const { getToken } = useAuth();

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getToken({ template: undefined });
      
      // Use deduplicator to prevent duplicate requests
      const result = await requestDeduplicator.execute(
        endpoint,
        () => fetchFn(token),
        params,
        userId
      );

      if (isMountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Request failed'));
        setData(null);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [endpoint, fetchFn, params, enabled, userId, getToken]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}

export default useRequestCache;

