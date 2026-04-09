import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Gift } from 'lucide-react-native';

import { COLORS } from '../reels/constants';
import LuckyWheelModal from '../common/LuckyWheelModal';
import { useTranslation } from '../../src/i18n';
import type { SocialNotification } from '../../src/services/authService';
import { executeOptimisticUpdate } from '../../utils/optimisticUpdate';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../../services/cacheService';
import { analytics, trackPerformance } from '../../services/analytics.service';
import { useAuth } from '@clerk/clerk-expo';

import { NotificationHeader } from './NotificationHeader';
import { NotificationTabs } from './NotificationTabs';
import { NotificationSearch } from './NotificationSearch';
import { NotificationItem } from './NotificationItem';
import { NotificationEmpty } from './NotificationEmpty';
import { useNotifications } from './hooks/useNotifications';
import { useNotificationActions } from './hooks/useNotificationActions';
import { useNotificationFilters } from './hooks/useNotificationFilters';

export default function NotificationScreen() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const notificationsCacheKey = userId ? `${CACHE_KEYS.NOTIFICATIONS}_${userId}` : CACHE_KEYS.NOTIFICATIONS;

  const {
    notifications,
    backendNotifications,
    matchNotifications,

    page,
    hasMore,
    handleLoadMore,

    isLoading,
    isRefreshing,
    isLoadingMore,
    unreadCount,

    canSpin,
    checkSpinStatus,

    refreshNotifications,
    clearMatchNotifications,
    setBackendNotifications,
    setUnreadCount,
    setHasMore,
    setPage,
  } = useNotifications();

  const { markAsRead, deleteNotification, markAllAsRead, clearAll } = useNotificationActions();
  const { filteredNotifications, activeTab, setActiveTab, searchQuery, setSearchQuery, debouncedSearchQuery } =
    useNotificationFilters(notifications);

  const [showLuckyWheel, setShowLuckyWheel] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const screenLoadStartRef = useRef<number>(Date.now());
  const loadTrackedRef = useRef(false);

  useEffect(() => {
    analytics.logScreenView('notifications');
  }, []);

  useEffect(() => {
    if (loadTrackedRef.current) return;
    if (isLoading) return;
    loadTrackedRef.current = true;
    trackPerformance('notifications_load_time', Date.now() - screenLoadStartRef.current);
  }, [isLoading]);

  const parseNotificationData = useCallback((data: SocialNotification['data']) => {
    if (!data) return {};
    if (typeof data === 'object') return data as Record<string, any>;
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, []);

  const handleNotificationPress = useCallback((notification: SocialNotification) => {
    analytics.logEvent('notification_pressed', {
      notificationId: notification.id,
      notificationType: notification.type,
      isRead: notification.isRead,
    });

    const data = parseNotificationData(notification.data);

    if (!notification.isRead) {
      // local state update is handled by item callbacks too, but keep behavior consistent
      // by marking read before navigating where possible
    }

    switch (notification.type) {
      case 'FOLLOW': {
        const followerUsername = (data as any)?.followerUsername || (data as any)?.actorUsername || (data as any)?.username;
        if (followerUsername) {
          router.push({ pathname: '/user/[username]', params: { username: followerUsername } });
        }
        break;
      }
      case 'LIKE':
      case 'COMMENT':
      case 'REPLY':
      case 'MENTION': {
        if ((data as any)?.commentId && (data as any)?.reelId) {
          router.push({
            pathname: '/(tabs)/reels',
            params: {
              reelId: (data as any).reelId,
              commentId: (data as any).commentId,
              autoOpenComments: 'true',
            },
          });
        } else if ((data as any)?.reelId) {
          router.push({ pathname: '/(tabs)/reels', params: { reelId: (data as any).reelId } });
        } else if ((data as any)?.actorUsername) {
          router.push({ pathname: '/user/[username]', params: { username: (data as any).actorUsername } });
        } else if ((data as any)?.username) {
          router.push({ pathname: '/user/[username]', params: { username: (data as any).username } });
        }
        break;
      }
      case 'MATCH_UPDATE':
      case 'MATCH_FAVORITE':
        router.push('/(tabs)/Home');
        break;
      default:
        break;
    }
  }, [parseNotificationData]);

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      analytics.logEvent('notification_marked_read', { notificationId });

      const isMatchNotification = matchNotifications.some(n => n.id === notificationId);
      if (isMatchNotification) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        return;
      }

      const success = await markAsRead(notificationId);
      if (!success) return;

      setBackendNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    },
    [markAsRead, matchNotifications, setBackendNotifications, setUnreadCount]
  );

  const handleDeleteNotification = useCallback(
    async (notificationId: string) => {
      analytics.logEvent('notification_deleted', { notificationId });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const previous = [...backendNotifications];
      setBackendNotifications(prev => prev.filter(n => n.id !== notificationId));

      const success = await deleteNotification(notificationId);
      if (!success) {
        setBackendNotifications(previous);
        return;
      }

      const updated = previous.filter(n => n.id !== notificationId);
      cacheService.set(notificationsCacheKey, updated, CACHE_TTL.NOTIFICATIONS);
    },
    [backendNotifications, deleteNotification, notificationsCacheKey, setBackendNotifications]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    analytics.logEvent('notifications_mark_all_read', { count: backendNotifications.length });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const previous = [...backendNotifications];
    const previousUnread = unreadCount;

    const optimistic = backendNotifications.map(n => ({ ...n, isRead: true }));
    setBackendNotifications(optimistic);
    setUnreadCount(0);

    const success = await markAllAsRead();
    if (!success) {
      setBackendNotifications(previous);
      setUnreadCount(previousUnread);
      return;
    }

    cacheService.set(notificationsCacheKey, optimistic, CACHE_TTL.NOTIFICATIONS);
  }, [backendNotifications, markAllAsRead, notificationsCacheKey, unreadCount, setBackendNotifications, setUnreadCount]);

  const handleClearAll = useCallback(async () => {
    analytics.logEvent('notifications_cleared_all', { count: notifications.length });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const previousBackend = [...backendNotifications];
    const previousUnread = unreadCount;

    await executeOptimisticUpdate({
      optimisticAction: () => {
        clearMatchNotifications();
        setBackendNotifications([]);
        setUnreadCount(0);
        setHasMore(true);
        setPage(1);
        cacheService.invalidate(notificationsCacheKey);
      },
      asyncAction: async () => {
        const success = await clearAll();
        if (!success) throw new Error('Failed to clear notifications on server');
        await cacheService.invalidate(notificationsCacheKey);
        return success;
      },
      rollbackAction: () => {
        setBackendNotifications(previousBackend);
        setUnreadCount(previousUnread);
        cacheService.set(notificationsCacheKey, previousBackend, CACHE_TTL.NOTIFICATIONS);
      },
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: err => {
        console.error('Error clearing notifications:', err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
    });
  }, [
    backendNotifications,
    clearAll,
    clearMatchNotifications,
    notifications.length,
    setBackendNotifications,
    setHasMore,
    setPage,
    setUnreadCount,
    notificationsCacheKey,
    unreadCount,
  ]);

  useEffect(() => {
    if (debouncedSearchQuery.trim().length >= 3) {
      analytics.logEvent('notification_search', {
        query: debouncedSearchQuery.trim(),
        resultsCount: filteredNotifications.length,
      });
    }
  }, [debouncedSearchQuery, filteredNotifications.length]);

  const emptyText = useMemo(() => {
    if (searchQuery.trim()) {
      return {
        title: t.notifications?.noSearchResults || 'No results found',
        subtitle: t.notifications?.tryDifferentSearch || 'Try a different search term',
      };
    }
    if (activeTab === 'unread') {
      return {
        title: t.notifications?.noUnread || 'No unread notifications',
        subtitle: t.notifications?.noNotificationsSubtitle || 'Follow, like, and comment notifications will appear here',
      };
    }
    if (activeTab === 'mentions') {
      return {
        title: t.notifications?.noMentions || 'No mentions yet',
        subtitle: t.notifications?.noNotificationsSubtitle || 'Follow, like, and comment notifications will appear here',
      };
    }
    return {
      title: t.notifications?.noNotifications || 'No notifications yet',
      subtitle: t.notifications?.noNotificationsSubtitle || 'Follow, like, and comment notifications will appear here',
    };
  }, [activeTab, searchQuery, t.notifications]);

  const renderItem = useCallback(
    ({ item, index }: { item: SocialNotification; index: number }) => (
      <NotificationItem
        notification={item}
        index={index}
        onPress={() => handleNotificationPress(item)}
        onMarkAsRead={() => handleMarkAsRead(item.id)}
        onDelete={() => handleDeleteNotification(item.id)}
      />
    ),
    [handleDeleteNotification, handleMarkAsRead, handleNotificationPress]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: t.settings?.notifications || 'الإشعارات',
            headerStyle: { backgroundColor: COLORS.deepBlack },
            headerTintColor: COLORS.white,
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <LinearGradient colors={[COLORS.deepBlack, '#1a1a1a']} style={styles.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.neonGreen} />
          <Text style={styles.loadingText}>{t.notifications?.loading || 'Loading notifications...'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t.settings?.notifications || 'الإشعارات',
          headerStyle: { backgroundColor: COLORS.deepBlack },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: 'bold' },
          headerRight: () => (
            <NotificationHeader
              hasNotifications={filteredNotifications.length > 0}
              unreadCount={unreadCount}
              labels={{
                markAllRead: t.notifications?.markAllRead || 'Mark All Read',
                clearAll: t.notifications?.clearAll || 'Clear All',
              }}
              onOpenSearch={() => setIsSearchVisible(true)}
              onMarkAllAsRead={handleMarkAllAsRead}
              onClearAll={handleClearAll}
            />
          ),
        }}
      />

      <LinearGradient colors={[COLORS.deepBlack, '#1a1a1a']} style={styles.background} />

      <NotificationSearch
        visible={isSearchVisible}
        query={searchQuery}
        placeholder={t.notifications?.searchPlaceholder || 'Search notifications...'}
        onQueryChange={setSearchQuery}
        onClose={() => setIsSearchVisible(false)}
      />

      <NotificationTabs
        activeTab={activeTab}
        onTabChange={setActiveTab as any}
        unreadCount={unreadCount}
        labels={{
          all: t.notifications?.tabs?.all || 'All',
          unread: t.notifications?.tabs?.unread || 'Unread',
          mentions: t.notifications?.tabs?.mentions || 'Mentions',
        }}
      />

      {canSpin && (
        <TouchableOpacity
          onPress={() => {
            setShowLuckyWheel(true);
            Haptics.selectionAsync();
          }}
          activeOpacity={0.9}
          style={styles.luckyWheelBanner}
        >
          <LinearGradient
            colors={['rgba(50, 205, 50, 0.25)', 'rgba(34, 139, 34, 0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.luckyWheelGradient}
          >
            <View style={styles.luckyWheelContent}>
              <Gift size={24} color={COLORS.neonGreen} />
              <View style={styles.luckyWheelTextContainer}>
                <Text style={styles.luckyWheelTitle}>{t.notifications?.luckyWheelReady || '🎡 Lucky Wheel Ready!'}</Text>
                <Text style={styles.luckyWheelSubtitle}>{t.notifications?.tapToWin || 'Tap here to win free coins'}</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {unreadCount > 0 && (
        <View style={styles.unreadBadgeContainer}>
          <Text style={styles.unreadBadgeText}>
            {unreadCount} {t.notifications?.newNotification || 'new'}
          </Text>
        </View>
      )}

      <LuckyWheelModal
        visible={showLuckyWheel}
        onClose={() => {
          setShowLuckyWheel(false);
          checkSpinStatus();
        }}
        onCoinsWon={() => {}}
      />

      <FlashList
        data={filteredNotifications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        estimatedItemSize={100}
        removeClippedSubviews
        getItemType={item => (item.type === 'FOLLOW' ? 'follow' : 'regular')}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshNotifications}
            tintColor={COLORS.neonGreen}
            colors={[COLORS.neonGreen]}
          />
        }
        ListFooterComponent={
          hasMore && isLoadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={COLORS.neonGreen} />
            </View>
          ) : null
        }
        ListEmptyComponent={<NotificationEmpty title={emptyText.title} subtitle={emptyText.subtitle} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepBlack,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginTop: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  unreadBadgeContainer: {
    backgroundColor: COLORS.neonGreen,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  unreadBadgeText: {
    color: COLORS.deepBlack,
    fontSize: 14,
    fontWeight: 'bold',
  },
  luckyWheelBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(50, 205, 50, 0.3)',
  },
  luckyWheelGradient: {
    padding: 14,
    borderRadius: 16,
  },
  luckyWheelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  luckyWheelTextContainer: {
    flex: 1,
  },
  luckyWheelTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  luckyWheelSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
});

