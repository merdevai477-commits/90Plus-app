import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { DailySpinService, NotificationService, type SocialNotification } from '../../../src/services/authService';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../../../services/cacheService';
import { useNotificationEvents } from '../../../hooks/useWebSocket';

const ITEMS_PER_PAGE = 20;
/** Skip full refetch on focus if we loaded recently. */
const FOCUS_REFETCH_THROTTLE_MS = 45_000;
/** Hard cap on merged list size shown in the UI. */
const MAX_MERGED_NOTIFICATIONS = 200;

export function useNotifications() {
  const { getToken, userId } = useAuth();
  const notificationsCacheKey = userId ? `${CACHE_KEYS.NOTIFICATIONS}_${userId}` : CACHE_KEYS.NOTIFICATIONS;

  const [backendNotifications, setBackendNotifications] = useState<SocialNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [canSpin, setCanSpin] = useState(false);
  const [spinTimeRemaining, setSpinTimeRemaining] = useState<{ hours: number; minutes: number } | null>(null);

  const lastFetchAtRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const loadNotificationsRef = useRef<(pageNum?: number, append?: boolean, forceRefresh?: boolean) => Promise<void>>(
    async () => undefined,
  );

  const checkSpinStatus = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const status = await DailySpinService.getStatus(token);
      if (status) {
        setCanSpin(status.canSpin);
        setSpinTimeRemaining(status.timeRemaining);
      }
    } catch (error) {
      console.error('Error checking spin status:', error);
    }
  }, [getToken]);

  const loadNotifications = useCallback(
    async (pageNum: number = 1, append: boolean = false, forceRefresh: boolean = false) => {
      if (append) setIsLoadingMore(true);

      try {
        setError(null);
        if (pageNum === 1 && !forceRefresh && !append) {
          const cached = await cacheService.get<SocialNotification[]>(notificationsCacheKey);
          if (cached && cached.length > 0) {
            setBackendNotifications(cached);
            setIsLoading(false);
          }
        }

        const token = await getToken();
        if (!token) return;

        const offset = (pageNum - 1) * ITEMS_PER_PAGE;
        const [data, backendUnread] = await Promise.all([
          NotificationService.getNotifications(token, ITEMS_PER_PAGE, offset),
          pageNum === 1 ? NotificationService.getUnreadCount(token) : Promise.resolve(null),
        ]);

        setBackendNotifications(prev => {
          if (!append) return data;
          const merged = [...prev, ...data];
          const deduped = new Map<string, SocialNotification>();
          for (const item of merged) {
            deduped.set(item.id, item);
          }
          return Array.from(deduped.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
        setHasMore(data.length === ITEMS_PER_PAGE);
        setPage(pageNum);

        if (pageNum === 1) {
          lastFetchAtRef.current = Date.now();
          setUnreadCount(backendUnread ?? 0);
        }

        if (pageNum === 1) {
          if (data.length > 0) {
            cacheService.set(notificationsCacheKey, data, CACHE_TTL.NOTIFICATIONS);
          } else {
            cacheService.invalidate(notificationsCacheKey);
          }
        }
      } catch (err: any) {
        console.error('Error loading notifications:', err);
        setError(err.message || 'Failed to load notifications');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [getToken, notificationsCacheKey]
  );

  loadNotificationsRef.current = loadNotifications;

  const refreshNotifications = useCallback(() => {
    setIsRefreshing(true);
    setHasMore(true);
    return loadNotifications(1, false, true);
  }, [loadNotifications]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || isRefreshing || isLoadingMore || !hasMore) return;
    loadNotifications(page + 1, true);
  }, [isLoading, isRefreshing, isLoadingMore, hasMore, loadNotifications, page]);

  const allNotifications = useMemo(
    () =>
      [...backendNotifications]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_MERGED_NOTIFICATIONS),
    [backendNotifications],
  );

  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        const elapsed = Date.now() - lastFetchAtRef.current;
        if (elapsed >= FOCUS_REFETCH_THROTTLE_MS) {
          loadNotificationsRef.current(1, false, false);
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) return;
      const elapsed = Date.now() - lastFetchAtRef.current;
      if (elapsed < FOCUS_REFETCH_THROTTLE_MS) return;
      loadNotificationsRef.current(1, false, false);
    }, [])
  );

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadNotificationsRef.current(1, false, false);
    checkSpinStatus();
  }, [checkSpinStatus]);

  useNotificationEvents(notification => {
    setBackendNotifications(prev => {
      const exists = prev.some(n => n.id === (notification as any).id);
      if (exists) return prev;
      setUnreadCount(prevCount => prevCount + 1);
      return [notification as SocialNotification, ...prev];
    });

    cacheService
      .get<SocialNotification[]>(notificationsCacheKey)
      .then(cached => {
        const merged = [notification as SocialNotification, ...(cached || [])];
        const deduped = new Map<string, SocialNotification>();
        for (const item of merged) {
          deduped.set(item.id, item);
        }
        cacheService.set(
          notificationsCacheKey,
          Array.from(deduped.values()).slice(0, ITEMS_PER_PAGE * 3),
          CACHE_TTL.NOTIFICATIONS
        );
      })
      .catch(err => console.error('Cache update error:', err));
  });

  return {
    notifications: allNotifications,
    backendNotifications,

    page,
    hasMore,
    handleLoadMore,

    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    unreadCount,

    canSpin,
    spinTimeRemaining,
    checkSpinStatus,

    loadNotifications,
    refreshNotifications,
    setBackendNotifications,
    setUnreadCount,
    setHasMore,
    setPage,
  };
}
