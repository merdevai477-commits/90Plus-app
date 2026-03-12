import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Image, AppState, AppStateStatus, TextInput } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { COLORS } from '../components/reels/constants';
import { Bell, Heart, MessageCircle, UserPlus, AtSign, Info, Reply, Star, Gift, Trash2, CheckCircle, Search, X, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInRight, FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import { useTranslation } from '../src/i18n';
import { useAuth } from '@clerk/clerk-expo';
import { NotificationService, SocialNotification, DailySpinService } from '../src/services/authService';
import { useHomeStore } from '../src/store/home.store';
import LuckyWheelModal from '../components/common/LuckyWheelModal';
import { executeOptimisticUpdate } from '../utils/optimisticUpdate';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../services/cacheService';
import { useNotificationEvents } from '../hooks/useWebSocket';
import { BlurView } from 'expo-blur';
import MiniProfileCard from '../components/profile/MiniProfileCard';

// Memoized NotificationItem for better performance
const NotificationItem: React.FC<{ 
    notification: SocialNotification; 
    index: number;
    onPress: () => void;
    onMarkAsRead: () => void;
    onDelete: () => void;
}> = ({ notification, index, onPress, onMarkAsRead, onDelete }) => {
    // Parse data if it's a string
    const data = typeof notification.data === 'string' 
        ? JSON.parse(notification.data) 
        : notification.data;
    
    // Get avatar from data - prioritize standardized actorAvatar, then fallback to old fields
    const avatarUrl = data?.actorAvatar || data?.followerAvatar || data?.avatar;
    
    // Get actor name for display
    const actorName = data?.actorDisplayName || data?.actorUsername || data?.followerUsername || data?.username;
    
    const getIcon = () => {
        switch (notification.type) {
            case 'FOLLOW':
                return <UserPlus color={COLORS.neonGreen} size={24} />;
            case 'LIKE':
                return <Heart color="#FF4757" size={24} fill="#FF4757" />;
            case 'COMMENT':
                return <MessageCircle color={COLORS.neonBlue} size={24} />;
            case 'REPLY':
                return <Reply color="#9B59B6" size={24} />;
            case 'MENTION':
                return <AtSign color="#FFD700" size={24} />;
            case 'MATCH_UPDATE':
            case 'MATCH_FAVORITE':
                return <Star color="#FFD700" size={24} fill="#FFD700" />;
            case 'MODERATION_ALERT':
                return <AlertCircle color="#FF6B6B" size={24} />;
            default:
                return <Info color={COLORS.neonBlue} size={24} />;
        }
    };

    const getBackgroundColor = () => {
        // Special styling for moderation alerts
        if (notification.type === 'MODERATION_ALERT') {
            return 'rgba(255, 107, 107, 0.15)'; // Light red background
        }
        
        if (!notification.isRead) {
            switch (notification.type) {
                case 'FOLLOW':
                    return 'rgba(50, 205, 50, 0.15)';
                case 'LIKE':
                    return 'rgba(255, 71, 87, 0.15)';
                case 'COMMENT':
                    return 'rgba(0, 168, 255, 0.15)';
                case 'REPLY':
                    return 'rgba(155, 89, 182, 0.15)';
                case 'MENTION':
                    return 'rgba(255, 215, 0, 0.15)';
                case 'MATCH_UPDATE':
                case 'MATCH_FAVORITE':
                    return 'rgba(255, 215, 0, 0.2)';
                default:
                    return 'rgba(255,255,255,0.1)';
            }
        }
        return 'rgba(255,255,255,0.05)';
    };

    const { t, language } = useTranslation();
    
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t.notifications?.now || 'Now';
        if (diffMins < 60) return (t.notifications?.minutesAgo || '{n} minutes ago').replace('{n}', String(diffMins));
        if (diffHours < 24) return (t.notifications?.hoursAgo || '{n} hours ago').replace('{n}', String(diffHours));
        if (diffDays < 7) return (t.notifications?.daysAgo || '{n} days ago').replace('{n}', String(diffDays));
        return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
    };

    const handlePress = () => {
        if (!notification.isRead) {
            onMarkAsRead();
        }
        onPress();
    };

    // Swipe actions
    const renderRightActions = () => {
        if (notification.isRead) {
            return (
                <View style={styles.swipeActionsContainer}>
                    <TouchableOpacity
                        style={[styles.swipeAction, styles.swipeActionDelete]}
                        onPress={onDelete}
                        activeOpacity={0.8}
                    >
                        <Trash2 size={20} color="#fff" />
                        <Text style={styles.swipeActionText}>{t.notifications?.swipe?.delete || 'Delete'}</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View style={styles.swipeActionsContainer}>
                <TouchableOpacity
                    style={[styles.swipeAction, styles.swipeActionRead]}
                    onPress={onMarkAsRead}
                    activeOpacity={0.8}
                >
                    <CheckCircle size={20} color="#fff" />
                    <Text style={styles.swipeActionText}>{t.notifications?.swipe?.markRead || 'Read'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.swipeAction, styles.swipeActionDelete]}
                    onPress={onDelete}
                    activeOpacity={0.8}
                >
                    <Trash2 size={20} color="#fff" />
                    <Text style={styles.swipeActionText}>{t.notifications?.swipe?.delete || 'Delete'}</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderLeftActions = () => {
        if (!notification.isRead) {
            return (
                <View style={styles.swipeActionsContainer}>
                    <TouchableOpacity
                        style={[styles.swipeAction, styles.swipeActionRead]}
                        onPress={onMarkAsRead}
                        activeOpacity={0.8}
                    >
                        <CheckCircle size={20} color="#fff" />
                        <Text style={styles.swipeActionText}>{t.notifications?.swipe?.markRead || 'Read'}</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return null;
    };

    // Special rendering for FOLLOW notifications - FIFA Card style
    if (notification.type === 'FOLLOW') {
        return (
            <Animated.View entering={FadeInRight.delay(index * 30).duration(300)}>
                <Swipeable
                    renderRightActions={renderRightActions}
                    renderLeftActions={renderLeftActions}
                    onSwipeableOpen={(direction) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    friction={2}
                    overshootRight={false}
                    overshootLeft={false}
                >
                    <TouchableOpacity
                        style={styles.followCardContainer}
                        onPress={handlePress}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={notification.isRead 
                                ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']
                                : ['rgba(50, 205, 50, 0.2)', 'rgba(50, 205, 50, 0.1)']
                            }
                            style={styles.followCardGradient}
                        />
                        
                        {/* FIFA Card */}
                        <View style={styles.fifaCardWrapper}>
                            <MiniProfileCard
                                playerImage={avatarUrl || undefined}
                                countryFlag={data?.countryFlag || '🇪🇬'}
                                position={data?.position || undefined}
                                clubLogo={data?.clubLogo || undefined}
                            />
                        </View>

                        {/* User Info */}
                        <View style={styles.followCardContent}>
                            <View style={styles.followCardHeader}>
                                <Text style={styles.followCardTitle} numberOfLines={1}>
                                    {actorName || notification.title}
                                </Text>
                                {!notification.isRead && <View style={styles.unreadDot} />}
                            </View>
                            <Text style={styles.followCardMessage} numberOfLines={1}>
                                {notification.message}
                            </Text>
                            <Text style={styles.followCardTime}>{formatTime(notification.createdAt)}</Text>
                        </View>
                    </TouchableOpacity>
                </Swipeable>
            </Animated.View>
        );
    }

    // Regular notification rendering for other types
    return (
        <Animated.View entering={FadeInRight.delay(index * 30).duration(300)}>
            <Swipeable
                renderRightActions={renderRightActions}
                renderLeftActions={renderLeftActions}
                onSwipeableOpen={(direction) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                friction={2}
                overshootRight={false}
                overshootLeft={false}
            >
                <TouchableOpacity
                    style={[
                        styles.itemContainer,
                        { backgroundColor: getBackgroundColor() }
                    ]}
                    onPress={handlePress}
                    activeOpacity={0.7}
                >
                    <LinearGradient
                        colors={notification.isRead 
                            ? ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']
                            : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']
                        }
                        style={styles.itemGradient}
                    />
                    
                    {/* Avatar or Icon */}
                    <View style={styles.avatarContainer}>
                        {avatarUrl ? (
                            <View style={styles.avatarWrapper}>
                                <Image 
                                    source={{ uri: avatarUrl }} 
                                    style={styles.avatar}
                                    resizeMode="cover"
                                />
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.3)']}
                                    style={styles.avatarOverlay}
                                />
                            </View>
                        ) : (
                            <LinearGradient
                                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.08)']}
                                style={styles.iconContainer}
                            >
                                {getIcon()}
                            </LinearGradient>
                        )}
                    </View>

                    <View style={styles.contentContainer}>
                        <View style={styles.titleRow}>
                            <Text style={styles.itemTitle} numberOfLines={1}>{notification.title}</Text>
                            {!notification.isRead && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={styles.itemMessage} numberOfLines={2}>{notification.message}</Text>
                        <Text style={styles.itemTime}>{formatTime(notification.createdAt)}</Text>
                    </View>
                </TouchableOpacity>
            </Swipeable>
        </Animated.View>
    );
};

// Memoize NotificationItem to prevent unnecessary re-renders
const MemoizedNotificationItem = React.memo(NotificationItem);

export default function NotificationsScreen() {
    const [backendNotifications, setBackendNotifications] = useState<SocialNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showLuckyWheel, setShowLuckyWheel] = useState(false);
    const [canSpin, setCanSpin] = useState(false);
    const [spinTimeRemaining, setSpinTimeRemaining] = useState<{ hours: number; minutes: number } | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'mentions'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const { t, isRTL } = useTranslation();
    const { getToken } = useAuth();
    
    // Debounce search query for better performance
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    
    // Get match notifications from home store
    const { notifications: matchNotifications, clearNotifications: clearMatchNotifications } = useHomeStore();

    // Check daily spin status
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

    // Merge backend and match notifications
    const allNotifications = useMemo(() => {
        // Convert match notifications to SocialNotification format
        const convertedMatchNotifications: SocialNotification[] = matchNotifications.map(mn => ({
            id: mn.id,
            type: 'MATCH_UPDATE' as const,
            title: mn.title,
            message: mn.message,
            isRead: mn.read,
            createdAt: mn.time,
            data: mn.fixtureId ? { matchId: mn.fixtureId } : undefined
        }));
        
        // Merge and sort by date (newest first)
        const merged = [...backendNotifications, ...convertedMatchNotifications];
        return merged.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [backendNotifications, matchNotifications]);

    // Pre-parse notification data for faster search
    const parsedNotifications = useMemo(() => {
        return allNotifications.map(n => {
            const data = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
            const actorName = (data?.actorDisplayName || data?.actorUsername || data?.followerUsername || data?.username || '').toLowerCase();
            return {
                ...n,
                _parsedData: {
                    actorName,
                    titleLower: (n.title || '').toLowerCase(),
                    messageLower: (n.message || '').toLowerCase(),
                }
            };
        });
    }, [allNotifications]);

    // Filter notifications by tab and search - OPTIMIZED
    const notifications = useMemo(() => {
        let filtered = parsedNotifications;

        // Tab filtering
        if (activeTab === 'unread') {
            filtered = filtered.filter(n => !n.isRead);
        } else if (activeTab === 'mentions') {
            filtered = filtered.filter(n => n.type === 'MENTION');
        }

        // Search filtering with debounced query
        if (debouncedSearchQuery.trim()) {
            const query = debouncedSearchQuery.toLowerCase().trim();
            filtered = filtered.filter(n => {
                const { actorName, titleLower, messageLower } = n._parsedData;
                return titleLower.includes(query) || messageLower.includes(query) || actorName.includes(query);
            });
        }

        return filtered;
    }, [parsedNotifications, activeTab, debouncedSearchQuery]);

    // Ref to track matchNotifications without causing re-renders
    const matchNotificationsRef = useRef(matchNotifications);
    matchNotificationsRef.current = matchNotifications;

    // Cache-first loading for instant display - FULLY PARALLEL
    const loadNotifications = useCallback(async (forceRefresh = false) => {
        try {
            // Step 1: Load from cache first (instant) - ONLY if not forcing refresh
            if (!forceRefresh) {
                const cached = await cacheService.get<SocialNotification[]>(CACHE_KEYS.NOTIFICATIONS);
                if (cached && cached.length > 0) {
                    setBackendNotifications(cached);
                    setIsLoading(false); // Show cached data immediately
                }
            }

            // Step 2: Fetch fresh data from backend (always, to verify cache is correct)
            const token = await getToken();
            if (!token) return;

            // PARALLEL: Fetch notifications AND unread count at the same time
            const [data, backendCount] = await Promise.all([
                NotificationService.getNotifications(token),
                NotificationService.getUnreadCount(token),
            ]);
            
            // ✅ FIX: Only update if backend has data OR if we're forcing refresh
            // This prevents deleted notifications from coming back
            if (forceRefresh || data.length > 0) {
                setBackendNotifications(data);
                
                // Save to cache for next time (non-blocking)
                // ✅ FIX: Only cache if there's actual data, or if we explicitly cleared
                if (data.length > 0) {
                    cacheService.set(CACHE_KEYS.NOTIFICATIONS, data, CACHE_TTL.NOTIFICATIONS);
                } else {
                    // If backend is empty, clear cache too
                    cacheService.invalidate(CACHE_KEYS.NOTIFICATIONS);
                }
            } else {
                // If backend is empty but cache has data, clear cache
                const cached = await cacheService.get<SocialNotification[]>(CACHE_KEYS.NOTIFICATIONS);
                if (cached && cached.length > 0) {
                    cacheService.invalidate(CACHE_KEYS.NOTIFICATIONS);
                    setBackendNotifications([]);
                }
            }
            
            // Update unread count (backend + local match notifications)
            const localUnread = matchNotificationsRef.current.filter(n => !n.read).length;
            setUnreadCount(backendCount + localUnread);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [getToken]); // Removed matchNotifications - uses ref

    // Ref to store loadNotifications
    const loadNotificationsRef = useRef(loadNotifications);
    loadNotificationsRef.current = loadNotifications;

    // Auto-refresh when app returns from background
    const appStateRef = useRef(AppState.currentState);
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (
                appStateRef.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                loadNotificationsRef.current(false); // Silent refresh
            }
            appStateRef.current = nextAppState;
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
    }, []); // Empty deps - uses ref
    
    // ✅ FIX: Refresh when screen comes into focus (e.g., after marking all as read)
    useFocusEffect(
        useCallback(() => {
            // Refresh notifications when screen comes into focus
            // This ensures the count in Header is updated after actions like "mark all as read"
            loadNotificationsRef.current(false);
        }, [])
    );

    // Initial load
    const hasLoadedRef = useRef(false);
    useEffect(() => {
        if (!hasLoadedRef.current) {
            hasLoadedRef.current = true;
            loadNotifications();
            checkSpinStatus();
        }
    }, [loadNotifications, checkSpinStatus]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        loadNotificationsRef.current(true); // Force refresh, skip cache
    }, []); // Empty deps - uses ref

    // Real-time notifications via WebSocket - تحديث فوري عند استقبال إشعار جديد
    useNotificationEvents((notification) => {
        // Add new notification to the top of the list immediately
        setBackendNotifications(prev => {
            // Check if notification already exists (avoid duplicates)
            const exists = prev.some(n => n.id === notification.id);
            if (exists) return prev;
            
            // Add to top and update unread count
            setUnreadCount(prevCount => prevCount + 1);
            return [notification as SocialNotification, ...prev];
        });
        
        // Save to cache (non-blocking)
        cacheService.get<SocialNotification[]>(CACHE_KEYS.NOTIFICATIONS).then(cached => {
            const updated = [notification as SocialNotification, ...(cached || [])];
            cacheService.set(CACHE_KEYS.NOTIFICATIONS, updated, CACHE_TTL.NOTIFICATIONS);
        }).catch(err => console.error('Cache update error:', err));
    });

    const handleDeleteNotification = useCallback(async (notificationId: string) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            
            // Optimistic update
            const previousNotifications = [...backendNotifications];
            setBackendNotifications(prev => prev.filter(n => n.id !== notificationId));
            
            const token = await getToken();
            if (!token) {
                // Rollback on error
                setBackendNotifications(previousNotifications);
                return;
            }

            const success = await NotificationService.deleteNotification(token, notificationId);
            if (!success) {
                // Rollback on error
                setBackendNotifications(previousNotifications);
            } else {
                // Update cache
                const updated = previousNotifications.filter(n => n.id !== notificationId);
                cacheService.set(CACHE_KEYS.NOTIFICATIONS, updated, CACHE_TTL.NOTIFICATIONS);
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }, [getToken, backendNotifications]);

    const handleMarkAllAsRead = useCallback(async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            
            const token = await getToken();
            if (!token) return;

            // Store previous state for potential rollback
            const previousNotifications = [...backendNotifications];
            const previousUnreadCount = unreadCount;

            // Optimistic update
            const updatedNotifications = backendNotifications.map(n => ({ ...n, isRead: true }));
            setBackendNotifications(updatedNotifications);
            setUnreadCount(0);

            try {
                // Mark all as read on backend
                const unreadNotifications = backendNotifications.filter(n => !n.isRead);
                await Promise.all(
                    unreadNotifications.map(n => NotificationService.markAsRead(token, n.id))
                );
                
                // Update cache with marked-as-read notifications
                cacheService.set(CACHE_KEYS.NOTIFICATIONS, updatedNotifications, CACHE_TTL.NOTIFICATIONS);
                
                // Also mark match notifications as read
                matchNotifications.forEach(n => {
                    if (!n.read) {
                        // Note: home.store doesn't have markAsRead method, so we'll handle it differently
                        // For now, we'll just update the unread count
                    }
                });
                
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
                // Rollback on error
                setBackendNotifications(previousNotifications);
                setUnreadCount(previousUnreadCount);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                throw error;
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }, [getToken, backendNotifications, unreadCount, matchNotifications]);

    const handleMarkAsRead = useCallback(async (notificationId: string) => {
        try {
            // Check if it's a match notification (local)
            const isMatchNotification = matchNotifications.some(n => n.id === notificationId);
            
            if (isMatchNotification) {
                // Match notifications are local - just update UI
                // Note: home.store doesn't have markAsRead, so we skip for now
                setUnreadCount(prev => Math.max(0, prev - 1));
                return;
            }
            
            const token = await getToken();
            if (!token) return;

            await NotificationService.markAsRead(token, notificationId);
            
            // Update local state
            setBackendNotifications(prev => 
                prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }, [getToken, matchNotifications]);

    // Store previous state for rollback
    const previousNotificationsRef = useRef<SocialNotification[]>([]);
    const previousUnreadCountRef = useRef<number>(0);

    const handleClearAll = useCallback(async () => {
        const token = await getToken();
        if (!token) return;

        // Haptic feedback فوري عند الضغط
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Store current state for potential rollback
        previousNotificationsRef.current = [...backendNotifications];
        previousUnreadCountRef.current = unreadCount;

        await executeOptimisticUpdate({
            // Optimistic action: Clear UI immediately (Requirements 1.1)
            optimisticAction: () => {
                // Clear match notifications immediately
                clearMatchNotifications();
                // Clear local state immediately
                setBackendNotifications([]);
                setUnreadCount(0);
                // ✅ FIX: Clear notifications cache to prevent them from coming back
                cacheService.invalidate(CACHE_KEYS.NOTIFICATIONS);
            },
            // Async action: Execute backend deletion in background (Requirements 1.2)
            asyncAction: async () => {
                try {
                    const success = await NotificationService.clearAll(token);
                    if (!success) {
                        throw new Error('Failed to clear notifications on server');
                    }
                    // ✅ FIX: After successful deletion, verify cache is cleared
                    // Force a refresh to ensure cache is empty
                    await cacheService.invalidate(CACHE_KEYS.NOTIFICATIONS);
                    return success;
                } catch (error: any) {
                    // ✅ Better error handling - log and rethrow
                    console.error('Error in clearAll asyncAction:', error);
                    throw error;
                }
            },
            // Rollback action: Restore notifications if backend fails (Requirements 1.3)
            rollbackAction: () => {
                setBackendNotifications(previousNotificationsRef.current);
                setUnreadCount(previousUnreadCountRef.current);
                // Restore cache on rollback
                cacheService.set(CACHE_KEYS.NOTIFICATIONS, previousNotificationsRef.current, CACHE_TTL.NOTIFICATIONS);
            },
            // Success callback: Provide haptic feedback (Requirements 1.4)
            onSuccess: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // ✅ FIX: Force refresh to ensure everything is cleared
                // This ensures cache is truly empty
                setTimeout(() => {
                    loadNotificationsRef.current(true); // Force refresh
                }, 500);
            },
            // Error callback: Show error feedback
            onError: (error) => {
                console.error('Error clearing notifications:', error);
                // Provide error haptic feedback
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            },
        });
    }, [getToken, clearMatchNotifications, backendNotifications, unreadCount]);

    const handleNotificationPress = useCallback((notification: SocialNotification) => {
        // Parse data if it's a string
        const data = typeof notification.data === 'string' 
            ? JSON.parse(notification.data) 
            : notification.data;
        
        // Mark as read if unread
        if (!notification.isRead) {
            handleMarkAsRead(notification.id);
        }
        
        // Navigate based on notification type
        switch (notification.type) {
            case 'FOLLOW':
                // Navigate to follower's profile
                const followerUsername = data?.followerUsername || data?.actorUsername || data?.username;
                if (followerUsername) {
                    router.push({
                        pathname: '/user/[username]',
                        params: { username: followerUsername }
                    });
                }
                break;
            case 'LIKE':
            case 'COMMENT':
            case 'REPLY':
            case 'MENTION':
                // Priority: Navigate to comment if commentId exists, then reel, then user
                if (data?.commentId && data?.reelId) {
                    // Navigate to reel with commentId to highlight specific comment
                    router.push({
                        pathname: '/(tabs)/reels',
                        params: { 
                            reelId: data.reelId,
                            commentId: data.commentId,
                            autoOpenComments: 'true'
                        }
                    });
                } else if (data?.reelId) {
                    // Navigate to specific reel
                    router.push({
                        pathname: '/(tabs)/reels',
                        params: { reelId: data.reelId }
                    });
                } else if (data?.actorUsername) {
                    // Navigate to actor's profile
                    router.push({
                        pathname: '/user/[username]',
                        params: { username: data.actorUsername }
                    });
                } else if (data?.username) {
                    router.push({
                        pathname: '/user/[username]',
                        params: { username: data.username }
                    });
                }
                break;
            case 'MATCH_UPDATE':
            case 'MATCH_FAVORITE':
                // Navigate to home tab for match notifications
                router.push('/(tabs)/Home');
                break;
            default:
                break;
        }
    }, [handleMarkAsRead]);

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Stack.Screen options={{
                    headerShown: true,
                    title: t.settings?.notifications || 'الإشعارات',
                    headerStyle: { backgroundColor: COLORS.deepBlack },
                    headerTintColor: COLORS.white,
                    headerTitleStyle: { fontWeight: 'bold' },
                }} />
                <LinearGradient
                    colors={[COLORS.deepBlack, '#1a1a1a']}
                    style={styles.background}
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.neonGreen} />
                    <Text style={styles.loadingText}>{t.notifications?.loading || 'Loading notifications...'}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                headerShown: true,
                title: t.settings?.notifications || 'الإشعارات',
                headerStyle: { backgroundColor: COLORS.deepBlack },
                headerTintColor: COLORS.white,
                headerTitleStyle: { fontWeight: 'bold' },
                headerRight: () => (
                    <View style={styles.headerActions}>
                        <TouchableOpacity 
                            onPress={() => {
                                setIsSearchVisible(true);
                                Haptics.selectionAsync();
                            }}
                            style={styles.searchIconButton}
                        >
                            <Search size={20} color={COLORS.neonGreen} />
                        </TouchableOpacity>
                        {notifications.length > 0 && (
                            <>
                                {unreadCount > 0 && (
                                    <TouchableOpacity 
                                        onPress={handleMarkAllAsRead} 
                                        style={styles.markAllReadButton}
                                    >
                                        <CheckCircle size={16} color={COLORS.neonGreen} />
                                        <Text style={styles.markAllReadText}>
                                            {t.notifications?.markAllRead || 'Mark All Read'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
                                    <Trash2 size={16} color={COLORS.neonGreen} />
                                    <Text style={styles.clearButtonText}>
                                        {t.notifications?.clearAll || 'Clear All'}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                ),
            }} />

            <LinearGradient
                colors={[COLORS.deepBlack, '#1a1a1a']}
                style={styles.background}
            />

            {/* Enhanced Search Bar - Animated */}
            {isSearchVisible && (
                <Animated.View 
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(200)}
                    style={styles.searchContainer}
                >
                    <BlurView intensity={20} tint="dark" style={styles.searchBarBlur}>
                        <LinearGradient
                            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']}
                            style={styles.searchBar}
                        >
                            <View style={styles.searchIconContainer}>
                                <Search size={20} color={COLORS.neonGreen} />
                            </View>
                            <TextInput
                                style={styles.searchInput}
                                placeholder={t.notifications?.searchPlaceholder || 'Search notifications...'}
                                placeholderTextColor="rgba(255,255,255,0.5)"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoFocus={true}
                            />
                            <TouchableOpacity 
                                onPress={() => {
                                    setSearchQuery('');
                                    setIsSearchVisible(false);
                                    Haptics.selectionAsync();
                                }} 
                                style={styles.closeSearchButton}
                            >
                                <X size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </LinearGradient>
                    </BlurView>
                </Animated.View>
            )}

            {/* Enhanced Tabs */}
            <View style={styles.tabsContainer}>
                <BlurView intensity={15} tint="dark" style={styles.tabsBlur}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'all' && styles.tabActive]}
                        onPress={() => {
                            setActiveTab('all');
                            Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={activeTab === 'all' 
                                ? [COLORS.neonGreen, '#22c55e']
                                : ['transparent', 'transparent']
                            }
                            style={styles.tabGradient}
                        >
                            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                                {t.notifications?.tabs?.all || 'All'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'unread' && styles.tabActive]}
                        onPress={() => {
                            setActiveTab('unread');
                            Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={activeTab === 'unread' 
                                ? [COLORS.neonGreen, '#22c55e']
                                : ['transparent', 'transparent']
                            }
                            style={styles.tabGradient}
                        >
                            <Text style={[styles.tabText, activeTab === 'unread' && styles.tabTextActive]}>
                                {t.notifications?.tabs?.unread || 'Unread'}
                            </Text>
                            {unreadCount > 0 && activeTab !== 'unread' && (
                                <View style={styles.tabBadge}>
                                    <Text style={styles.tabBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'mentions' && styles.tabActive]}
                        onPress={() => {
                            setActiveTab('mentions');
                            Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={activeTab === 'mentions' 
                                ? [COLORS.neonGreen, '#22c55e']
                                : ['transparent', 'transparent']
                            }
                            style={styles.tabGradient}
                        >
                            <Text style={[styles.tabText, activeTab === 'mentions' && styles.tabTextActive]}>
                                {t.notifications?.tabs?.mentions || 'Mentions'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </BlurView>
            </View>

            {/* Lucky Wheel Banner - Compact design */}
            {canSpin && (
                <Animated.View entering={FadeIn.duration(300)}>
                    <TouchableOpacity 
                        onPress={() => {
                            setShowLuckyWheel(true);
                            Haptics.selectionAsync();
                        }}
                        activeOpacity={0.9}
                        style={styles.luckyWheelBanner}
                    >
                        <BlurView intensity={15} tint="dark" style={styles.luckyWheelBlur}>
                            <LinearGradient
                                colors={['rgba(50, 205, 50, 0.25)', 'rgba(34, 139, 34, 0.15)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.luckyWheelGradient}
                            >
                                <View style={styles.luckyWheelContent}>
                                    <Gift size={24} color={COLORS.neonGreen} />
                                    <View style={styles.luckyWheelTextContainer}>
                                        <Text style={styles.luckyWheelTitle}>
                                            {t.notifications?.luckyWheelReady || '🎡 Lucky Wheel Ready!'}
                                        </Text>
                                        <Text style={styles.luckyWheelSubtitle}>
                                            {t.notifications?.tapToWin || 'Tap here to win free coins'}
                                        </Text>
                                    </View>
                                </View>
                            </LinearGradient>
                        </BlurView>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Unread Count Badge */}
            {unreadCount > 0 && (
                <View style={styles.unreadBadgeContainer}>
                    <Text style={styles.unreadBadgeText}>
                        {unreadCount} {t.notifications?.newNotification || 'new'}
                    </Text>
                </View>
            )}

            {/* Lucky Wheel Modal */}
            <LuckyWheelModal
                visible={showLuckyWheel}
                onClose={() => {
                    setShowLuckyWheel(false);
                    checkSpinStatus(); // Refresh status after closing
                }}
                onCoinsWon={(coins, newBalance) => {
                    console.log(`Won ${coins} coins! New balance: ${newBalance}`);
                }}
            />

            <FlatList
                data={notifications}
                renderItem={({ item, index }) => (
                    <MemoizedNotificationItem 
                        notification={item} 
                        index={index}
                        onPress={() => handleNotificationPress(item)}
                        onMarkAsRead={() => handleMarkAsRead(item.id)}
                        onDelete={() => handleDeleteNotification(item.id)}
                    />
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                getItemLayout={(data, index) => ({
                    length: 92, // Updated height
                    offset: 92 * index,
                    index,
                })}
                removeClippedSubviews={true}
                initialNumToRender={8}
                maxToRenderPerBatch={3}
                windowSize={5}
                updateCellsBatchingPeriod={50}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={COLORS.neonGreen}
                        colors={[COLORS.neonGreen]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Bell size={48} color="rgba(255,255,255,0.3)" />
                        <Text style={styles.emptyText}>
                            {searchQuery.trim() 
                                ? (t.notifications?.noSearchResults || 'No results found')
                                : activeTab === 'unread'
                                ? (t.notifications?.noUnread || 'No unread notifications')
                                : activeTab === 'mentions'
                                ? (t.notifications?.noMentions || 'No mentions yet')
                                : (t.notifications?.noNotifications || 'No notifications yet')
                            }
                        </Text>
                        <Text style={styles.emptySubtext}>
                            {searchQuery.trim()
                                ? (t.notifications?.tryDifferentSearch || 'Try a different search term')
                                : (t.notifications?.noNotificationsSubtitle || 'Follow, like, and comment notifications will appear here')
                            }
                        </Text>
                    </View>
                }
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
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        position: 'relative',
    },
    itemGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    avatarContainer: {
        marginRight: 16,
    },
    avatarWrapper: {
        width: 52,
        height: 52,
        borderRadius: 26,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: COLORS.neonGreen,
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    contentContainer: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.white,
        flex: 1,
    },
    itemMessage: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
        lineHeight: 20,
    },
    itemTime: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.neonGreen,
        marginLeft: 8,
        shadowColor: COLORS.neonGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 3,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        marginTop: 16,
        color: 'rgba(255,255,255,0.7)',
        fontSize: 18,
        fontWeight: '600',
    },
    emptySubtext: {
        marginTop: 8,
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    searchBarBlur: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    searchIconContainer: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        color: COLORS.white,
        fontSize: 16,
        paddingVertical: 0,
    },
    clearSearchButton: {
        marginLeft: 8,
        padding: 4,
    },
    closeSearchButton: {
        marginLeft: 8,
        padding: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    searchIconButton: {
        padding: 8,
        marginRight: 8,
    },
    followCardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        position: 'relative',
        minHeight: 70,
    },
    followCardGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    fifaCardWrapper: {
        width: 50,
        height: 75,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ scale: 0.35 }], // Smaller scale for better fit with text
    },
    followCardContent: {
        flex: 1,
        justifyContent: 'center',
        paddingLeft: 4,
    },
    followCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    followCardTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: COLORS.white,
        flex: 1,
    },
    followCardMessage: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.75)',
        marginBottom: 6,
        lineHeight: 20,
    },
    followCardTime: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
    },
    tabsContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    tabsBlur: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
        overflow: 'hidden',
    },
    tabGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
    },
    tabActive: {
        shadowColor: COLORS.neonGreen,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 5,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
    },
    tabTextActive: {
        color: COLORS.deepBlack,
        fontWeight: 'bold',
    },
    tabBadge: {
        backgroundColor: COLORS.error,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 6,
        minWidth: 20,
        alignItems: 'center',
    },
    tabBadgeText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    markAllReadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(50, 205, 50, 0.2)',
    },
    markAllReadText: {
        color: COLORS.neonGreen,
        fontSize: 14,
        fontWeight: '600',
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 71, 87, 0.2)',
    },
    clearButtonText: {
        color: '#FF4757',
        fontSize: 14,
        fontWeight: '600',
    },
    swipeActionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 8,
        height: '100%',
    },
    swipeAction: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '100%',
        borderRadius: 16,
        marginHorizontal: 4,
    },
    swipeActionDelete: {
        backgroundColor: COLORS.error,
    },
    swipeActionRead: {
        backgroundColor: COLORS.neonGreen,
    },
    swipeActionText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 4,
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
    luckyWheelBlur: {
        borderRadius: 16,
        overflow: 'hidden',
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
    spinTimerBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginTop: 12,
        padding: 12,
        backgroundColor: 'rgba(255,215,0,0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    spinTimerText: {
        color: '#ffd700',
        fontSize: 14,
    },
});
