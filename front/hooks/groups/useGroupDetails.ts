import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

import { PredictionGroupsService, type PredictionGroupDetails } from '../../services/predictionGroups.service';
import { toastManager } from '../../services/toastManager';

const GROUP_DETAILS_CACHE_TTL_MS = 15000;
const groupDetailsCache = new Map<string, { data: PredictionGroupDetails; ts: number }>();

interface UseGroupDetailsOptions {
  groupId: string;
  errorTitle: string;
  errorMessage: string;
}

export function useGroupDetails({ groupId, errorTitle, errorMessage }: UseGroupDetailsOptions) {
  const { getToken } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [details, setDetails] = useState<PredictionGroupDetails | null>(null);

  const requestInFlightRef = useRef(false);

  const loadDetails = useCallback(async (opts?: { force?: boolean }) => {
    if (requestInFlightRef.current || !groupId) return;

    if (!opts?.force) {
      const cached = groupDetailsCache.get(groupId);
      const isFresh = cached && Date.now() - cached.ts < GROUP_DETAILS_CACHE_TTL_MS;
      if (isFresh && cached) {
        setDetails(cached.data);
        return;
      }
    }

    const token = await getToken();
    if (!token) return;

    requestInFlightRef.current = true;
    try {
      const payload = await PredictionGroupsService.getGroupDetails(token, groupId);
      setDetails(payload);
      groupDetailsCache.set(groupId, { data: payload, ts: Date.now() });
    } catch {
      toastManager.showError(errorTitle, errorMessage);
      router.back();
    } finally {
      requestInFlightRef.current = false;
    }
  }, [errorMessage, errorTitle, getToken, groupId, router]);

  useEffect(() => {
    if (!groupId) {
      router.back();
      return;
    }

    let cancelled = false;
    setDetails(null);

    const run = async () => {
      try {
        setLoading(true);
        await loadDetails();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [groupId, loadDetails, router]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadDetails({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadDetails]);

  return {
    loading,
    refreshing,
    details,
    loadDetails,
    onRefresh,
  };
}
