import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { DailySpinService, NotificationService, type SocialNotification } from '../../../src/services/authService';
import { useHomeStore } from '../../../src/store/home.store';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../../../services/cacheService';
import { useNotificationEvents } from '../../../hooks/useWebSocket';

const ITEMS_PER_PAGE = 20;

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

  const { notifications: matchNotifications, clearNotifications: clearMatchNotifications } = useHomeStore();

  const matchNotificationsRef = useRef(matchNotifications);
  matchNotificationsRef.current = matchNotifications;

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
          const localUnread = matchNotificationsRef.current.filter(n => !n.read).length;
          setUnreadCount((backendUnread ?? 0) + localUnread);
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

  const refreshNotifications = useCallback(() => {
    setIsRefreshing(true);
    setHasMore(true);
    return loadNotifications(1, false, true);
  }, [loadNotifications]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || isRefreshing || isLoadingMore || !hasMore) return;
    loadNotifications(page + 1, true);
  }, [isLoading, isRefreshing, isLoadingMore, hasMore, loadNotifications, page]);

  const allNotifications = useMemo(() => {
    const convertedMatchNotifications: SocialNotification[] = matchNotifications.map(mn => {
      // mn.time may be a display string like '21:00', not a parseable ISO date.
      // Use it only if it parses to a valid Date, otherwise use now.
      let createdAt = mn.time;
      const parsed = new Date(mn.time);
      if (isNaN(parsed.getTime())) {
        createdAt = new Date().toISOString();
      }
      return {
        id: mn.id,
        type: 'MATCH_UPDATE' as const,
        title: mn.title,
        message: mn.message,
        isRead: mn.read,
        createdAt,
        data: mn.fixtureId ? { matchId: mn.fixtureId } : undefined,
      };
    });

    const merged = [...backendNotifications, ...convertedMatchNotifications];
    return merged.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [backendNotifications, matchNotifications]);

  const loadNotificationsRef = useRef(loadNotifications);
  loadNotificationsRef.current = loadNotifications;

  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        loadNotificationsRef.current(1, false, false);
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) return;
      loadNotificationsRef.current(1, false, false);
    }, [])
  );

  const hasLoadedRef = useRef(false);
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
      // UX Fix 7: Increment badge count immediately on WebSocket notification
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
          Array.from(deduped.values()),
          CACHE_TTL.NOTIFICATIONS
        );
      })
      .catch(err => console.error('Cache update error:', err));
  });

  return {
    // data
    notifications: allNotifications,
    backendNotifications,
    matchNotifications,

    // pagination
    page,
    hasMore,
    handleLoadMore,

    // state
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    unreadCount,

    // spin
    canSpin,
    spinTimeRemaining,
    checkSpinStatus,

    // actions
    loadNotifications,
    refreshNotifications,
    clearMatchNotifications,
    setBackendNotifications,
    setUnreadCount,
    setHasMore,
    setPage,
  };
}

