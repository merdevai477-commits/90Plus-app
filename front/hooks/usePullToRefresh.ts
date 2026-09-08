import { useCallback, useRef, useState } from 'react';
import { shouldSkipClientPullCooldown } from '../utils/pullRefreshQuery';

/**
 * Shared RefreshControl handler for Matches / Match Details.
 * Client cooldown is 2.5s; the server still enforces 10–60s + abuse limits.
 */
export function usePullToRefresh(refresh: () => Promise<void>): {
  refreshing: boolean;
  onRefresh: () => Promise<void>;
} {
  const [refreshing, setRefreshing] = useState(false);
  const lastAtRef = useRef(0);
  const inFlightRef = useRef(false);

  const onRefresh = useCallback(async () => {
    if (inFlightRef.current) return;
    if (shouldSkipClientPullCooldown(lastAtRef.current)) return;
    lastAtRef.current = Date.now();
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }, [refresh]);

  return { refreshing, onRefresh };
}
