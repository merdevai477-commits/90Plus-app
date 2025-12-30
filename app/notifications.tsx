import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Image, AppState, AppStateStatus } from 'react-native';
import { Stack, router } from 'expo-router';
import { COLORS } from '../components/reels/constants';
import { Bell, Heart, MessageCircle, UserPlus, AtSign, Info, Reply, Star, Gift, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInRight, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../src/i18n';
import { useAuth } from '@clerk/clerk-expo';
import { NotificationService, SocialNotification, DailySpinService } from '../src/services/authService';
import { useHomeStore } from '../src/store/home.store';
import LuckyWheelModal from '../components/common/LuckyWheelModal';
import { executeOptimisticUpdate } from '../utils/optimisticUpdate';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../services/cacheService';
import { useNotificationEvents } from '../hooks/useWebSocket';

const NotificationItem: React.FC<{ 
    notification: SocialNotification; 
    index: number;
    onPress: () => void;
    onMarkAsRead: () => void;
}> = ({ notification, index, onPress, onMarkAsRead }) => {
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

    return (
        <Animated.View entering={FadeInRight.delay(index * 50).duration(400)}>
            <TouchableOpacity
                style={[
                    styles.itemContainer,
                    { backgroundColor: getBackgroundColor() }
                ]}
                onPress={handlePress}
                activeOpacity={0.7}
            >
                {/* Avatar or Icon */}
                <View style={styles.avatarContainer}>
                    {avatarUrl ? (
                        <Image 
                            source={{ uri: avatarUrl }} 
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={styles.iconContainer}>
                            {getIcon()}
                        </View>
                    )}
                </View>

                <View style={styles.contentContainer}>
                    <Text style={styles.itemTitle}>{notification.title}</Text>
                    <Text style={styles.itemMessage} numberOfLines={2}>{notification.message}</Text>
                    <Text style={styles.itemTime}>{formatTime(notification.createdAt)}</Text>
                </View>

                {!notification.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function NotificationsScreen() {
    const [backendNotifications, setBackendNotifications] = useState<SocialNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showLuckyWheel, setShowLuckyWheel] = useState(false);
    const [canSpin, setCanSpin] = useState(false);
    const [spinTimeRemaining, setSpinTimeRemaining] = useState<{ hours: number; minutes: number } | null>(null);
    const { t, isRTL } = useTranslation();
    const { getToken } = useAuth();
    
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
    const notifications = useMemo(() => {
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

    // Ref to track matchNotifications without causing re-renders
    const matchNotificationsRef = useRef(matchNotifications);
    matchNotificationsRef.current = matchNotifications;

    // Cache-first loading for instant display - FULLY PARALLEL
    const loadNotifications = useCallback(async (forceRefresh = false) => {
        try {
            // Step 1: Load from cache first (instant)
            if (!forceRefresh) {
                const cached = await cacheService.get<SocialNotification[]>(CACHE_KEYS.NOTIFICATIONS);
                if (cached && cached.length > 0) {
                    setBackendNotifications(cached);
                    setIsLoading(false); // Show cached data immediately
                }
            }

            // Step 2: Fetch fresh data in background
            const token = await getToken();
            if (!token) return;

            // PARALLEL: Fetch notifications AND unread count at the same time
            const [data, backendCount] = await Promise.all([
                NotificationService.getNotifications(token),
                NotificationService.getUnreadCount(token),
            ]);
            
            setBackendNotifications(data);
            
            // Save to cache for next time (non-blocking)
            cacheService.set(CACHE_KEYS.NOTIFICATIONS, data, CACHE_TTL.NOTIFICATIONS);
            
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
                const success = await NotificationService.clearAll(token);
                if (!success) {
                    throw new Error('Failed to clear notifications on server');
                }
                return success;
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
        
        // Navigate based on notification type
        switch (notification.type) {
            case 'FOLLOW':
                // For follow notifications, use followerUsername from data
                const followerUsername = data?.followerUsername || data?.username;
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
                if (data?.reelId) {
                    // Navigate to reel - for now go to reels tab
                    router.push('/(tabs)/reels');
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
    }, []);

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
                headerRight: notifications.length > 0 ? () => (
                    <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
                        <Trash2 size={16} color={COLORS.neonGreen} />
                        <Text style={styles.clearButtonText}>
                            {t.notifications?.clearAll || 'Clear All'}
                        </Text>
                    </TouchableOpacity>
                ) : undefined,
            }} />

            <LinearGradient
                colors={[COLORS.deepBlack, '#1a1a1a']}
                style={styles.background}
            />

            {/* Lucky Wheel Banner - Always show, with timer when locked */}
            <Animated.View entering={FadeIn.duration(500)}>
                <TouchableOpacity 
                    onPress={() => setShowLuckyWheel(true)}
                    activeOpacity={0.9}
                >
                    <LinearGradient
                        colors={canSpin ? ['#32cd32', '#228b22'] : ['#444', '#333']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.luckyWheelBanner}
                    >
                        <View style={styles.luckyWheelContent}>
                            <Gift size={28} color={canSpin ? "#fff" : "#888"} />
                            <View style={styles.luckyWheelTextContainer}>
                                <Text style={[styles.luckyWheelTitle, !canSpin && { color: '#aaa' }]}>
                                    {canSpin 
                                        ? (t.notifications?.luckyWheelReady || '🎡 Lucky Wheel Ready!')
                                        : (t.notifications?.wheelAvailableIn || '🔒 Lucky Wheel')
                                    }
                                </Text>
                                <Text style={[styles.luckyWheelSubtitle, !canSpin && { color: '#888' }]}>
                                    {canSpin 
                                        ? (t.notifications?.tapToWin || 'Tap here to win free coins')
                                        : spinTimeRemaining 
                                            ? `${t.notifications?.wheelAvailableIn || 'Available in'} ${spinTimeRemaining.hours}:${String(spinTimeRemaining.minutes).padStart(2, '0')}`
                                            : (t.notifications?.wheelAvailableIn || 'Try again later')
                                    }
                                </Text>
                            </View>
                        </View>
                        <View style={[styles.luckyWheelArrow, !canSpin && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                            <Text style={[styles.luckyWheelArrowText, !canSpin && { color: '#888' }]}>←</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>

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
                    <NotificationItem 
                        notification={item} 
                        index={index}
                        onPress={() => handleNotificationPress(item)}
                        onMarkAsRead={() => handleMarkAsRead(item.id)}
                    />
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                getItemLayout={(data, index) => ({
                    length: 80, // ارتفاع كل إشعار تقريباً
                    offset: 80 * index,
                    index,
                })}
                removeClippedSubviews={true}
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={10}
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
                            {t.notifications?.noNotifications || 'No notifications yet'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            {t.notifications?.noNotificationsSubtitle || 'Follow, like, and comment notifications will appear here'}
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
    },
    avatarContainer: {
        marginRight: 16,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: COLORS.neonGreen,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 4,
    },
    itemMessage: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
        lineHeight: 20,
    },
    itemTime: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.neonGreen,
        marginLeft: 8,
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
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    luckyWheelSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
    },
    luckyWheelArrow: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    luckyWheelArrowText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
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
