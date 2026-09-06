import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import {
    Bell,
    ChevronLeft,
    Trophy,
    Sparkles,
    Users,
    Heart,
    MessageCircle,
    AtSign,
    Shield,
    MessageSquare,
    CheckCheck,
    Gift,
    Flag,
    UserCircle,
    Bot,
    TrendingUp,
    Award,
    Video,
} from 'lucide-react-native';
import BottomNav from '@/components/navigation/BottomNav';
import {
    TEXT_PRIMARY,
    TEXT_MUTED,
    TEXT_SECONDARY,
    GOLD_PRIMARY,
    BLUE_PRIMARY,
    PURPLE_SOFT,
    PURPLE_PRIMARY,
    BORDER_ARENA,
    RADIUS_LG,
    SCREEN_PADDING_H,
    SECTION_GAP,
    GRADIENT_BG_COLORS,
    GRADIENT_BG_LOCATIONS,
    BG_BASE,
} from '../constants/tokens';
import { useNotifications } from '../components/notifications/hooks/useNotifications';
import { useAuth } from '@clerk/clerk-expo';
import { NotificationService, type SocialNotification } from '../src/services/authService';
import { syncExpoPushTokenIfGranted } from '../src/hooks/usePushNotifications';
import { logger } from '../utils/logger';
import { toastManager } from '../services/toastManager';
import { useTranslation } from '../src/i18n';

type Kind =
    | 'match'
    | 'quiz'
    | 'social'
    | 'system'
    | 'like'
    | 'comment'
    | 'mention'
    | 'moderation'
    | 'report'
    | 'avatar'
    | 'ai'
    | 'leaderboard'
    | 'levelup'
    | 'video'
    | 'gift'
    | 'lucky';

const KIND_META: Record<Kind, { Icon: LucideIcon; color: string; tint: string }> = {
    match: { Icon: Trophy, color: GOLD_PRIMARY, tint: 'rgba(245,197,24,0.16)' },
    quiz: { Icon: Sparkles, color: PURPLE_SOFT, tint: 'rgba(167,139,250,0.16)' },
    social: { Icon: Users, color: BLUE_PRIMARY, tint: 'rgba(59,130,246,0.16)' },
    system: { Icon: Bell, color: TEXT_MUTED, tint: 'rgba(255,255,255,0.08)' },
    like: { Icon: Heart, color: '#ef4444', tint: 'rgba(239,68,68,0.16)' },
    comment: { Icon: MessageCircle, color: BLUE_PRIMARY, tint: 'rgba(59,130,246,0.16)' },
    mention: { Icon: AtSign, color: PURPLE_SOFT, tint: 'rgba(167,139,250,0.16)' },
    moderation: { Icon: Shield, color: '#fcd34d', tint: 'rgba(252,211,77,0.14)' },
    report: { Icon: Flag, color: '#fb923c', tint: 'rgba(251,146,60,0.16)' },
    avatar: { Icon: UserCircle, color: BLUE_PRIMARY, tint: 'rgba(59,130,246,0.16)' },
    ai: { Icon: Bot, color: PURPLE_PRIMARY, tint: 'rgba(124,58,237,0.16)' },
    leaderboard: { Icon: TrendingUp, color: GOLD_PRIMARY, tint: 'rgba(245,197,24,0.16)' },
    levelup: { Icon: Award, color: '#22c55e', tint: 'rgba(34,197,94,0.16)' },
    video: { Icon: Video, color: PURPLE_SOFT, tint: 'rgba(167,139,250,0.16)' },
    gift: { Icon: Gift, color: '#ec4899', tint: 'rgba(236,72,153,0.16)' },
    lucky: { Icon: Sparkles, color: GOLD_PRIMARY, tint: 'rgba(245,197,24,0.16)' },
};

function mapTypeToKind(type: SocialNotification['type']): Kind {
    switch (type) {
        case 'MATCH_UPDATE':
        case 'MATCH_FAVORITE':
        case 'MATCH_GOAL':
        case 'MATCH_START':
        case 'MATCH_END':
        case 'MATCH_HALFTIME':
        case 'MATCH_YELLOW_CARD':
        case 'MATCH_RED_CARD':
        case 'PREDICTION_RESULT':
            return 'match';
        case 'FOLLOW':
        case 'FOLLOW_ACTIVITY':
        case 'SHARE':
            return 'social';
        case 'LIKE':
        case 'COMMENT_LIKE':
            return 'like';
        case 'COMMENT':
        case 'REPLY':
            return 'comment';
        case 'MENTION':
            return 'mention';
        case 'MODERATION_ALERT':
            return 'moderation';
        case 'REPORT_SUBMITTED':
        case 'REPORT_RESOLVED':
            return 'report';
        case 'AVATAR_UPLOAD':
            return 'avatar';
        case 'AI_CHECKIN':
            return 'ai';
        case 'LEADERBOARD_TOP10':
        case 'LEADERBOARD_TOP3':
            return 'leaderboard';
        case 'LEVEL_UP':
            return 'levelup';
        case 'VIDEO_PROCESSED':
            return 'video';
        case 'GIFT':
        case 'COIN_MILESTONE':
        case 'MILESTONE':
        case 'ACHIEVEMENT':
        case 'QUIZ_REWARD':
            return 'gift';
        case 'LUCKY_WHEEL':
        case 'LUCKY_WHEEL_RENEWED':
            return 'lucky';
        case 'DAILY_QUIZ_RENEWED':
            return 'quiz';
        default:
            return 'system';
    }
}

function kindLabelFor(
    type: SocialNotification['type'],
    n: ReturnType<typeof useTranslation>['t']['notifications'],
): string {
    switch (type) {
        case 'LIKE':
        case 'COMMENT_LIKE':
            return n.kindLike;
        case 'COMMENT':
        case 'REPLY':
            return n.kindComment;
        case 'MENTION':
            return n.kindMention;
        case 'FOLLOW':
        case 'FOLLOW_ACTIVITY':
            return n.kindFollow;
        case 'SHARE':
            return n.kindShare;
        case 'MATCH_GOAL':
            return n.kindGoal;
        case 'MATCH_START':
            return n.kindKickoff;
        case 'MATCH_END':
            return n.kindFullTime;
        case 'MATCH_YELLOW_CARD':
        case 'MATCH_RED_CARD':
            return n.kindCard;
        case 'PREDICTION_RESULT':
            return n.kindPrediction;
        case 'MATCH_UPDATE':
        case 'MATCH_FAVORITE':
        case 'MATCH_HALFTIME':
            return n.kindMatch;
        case 'DAILY_QUIZ_RENEWED':
            return n.kindQuiz;
        case 'LEVEL_UP':
            return n.kindLevel;
        case 'GIFT':
        case 'COIN_MILESTONE':
        case 'MILESTONE':
        case 'ACHIEVEMENT':
        case 'QUIZ_REWARD':
            return n.kindGift;
        case 'LUCKY_WHEEL':
        case 'LUCKY_WHEEL_RENEWED':
            return n.kindLucky;
        case 'VIDEO_PROCESSED':
            return n.kindVideo;
        case 'LEADERBOARD_TOP10':
        case 'LEADERBOARD_TOP3':
            return n.kindLeaderboard;
        case 'REPORT_SUBMITTED':
        case 'REPORT_RESOLVED':
            return n.kindReport;
        case 'MODERATION_ALERT':
            return n.kindModeration;
        case 'AVATAR_UPLOAD':
            return n.kindAvatar;
        case 'AI_CHECKIN':
            return n.kindAi;
        default:
            return n.kindSystem;
    }
}

function formatRelativeTime(iso: string, t: ReturnType<typeof useTranslation>['t']): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '—';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return t.notifications.now;
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return t.profile.yesterday;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
}

// ─── Pinned header — solid surface (blur is too expensive on this screen) ──
type HeaderProps = {
    unreadCount: number;
    total: number;
    topInset: number;
    onBack: () => void;
    onMarkAll: () => void;
    hasUnread: boolean;
    title: string;
    markAllLabel: string;
    eyebrowLabel: string;
    summaryLabel: string;
    backLabel: string;
};

const NotificationsHeader = React.memo(function NotificationsHeader({
    unreadCount,
    total,
    topInset,
    onBack,
    onMarkAll,
    hasUnread,
    title,
    markAllLabel,
    eyebrowLabel,
    summaryLabel,
    backLabel,
}: HeaderProps) {
    return (
        <View style={[headerStyles.container, { paddingTop: topInset + 8 }]}>
            <LinearGradient
                colors={['rgba(124,58,237,0.22)', 'rgba(10,6,18,0.96)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />
            <View style={headerStyles.inner}>
                <TouchableOpacity
                    onPress={onBack}
                    activeOpacity={0.75}
                    hitSlop={12}
                    style={headerStyles.backBtn}
                    accessibilityRole="button"
                    accessibilityLabel={backLabel}
                >
                    <ChevronLeft color={TEXT_PRIMARY} size={22} strokeWidth={2.2} />
                </TouchableOpacity>

                <View style={headerStyles.titleBlock}>
                    <Text style={headerStyles.eyebrow}>{eyebrowLabel}</Text>
                    <Text style={headerStyles.title} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text style={headerStyles.sub} numberOfLines={1}>
                        {summaryLabel}
                    </Text>
                </View>

                {hasUnread ? (
                    <TouchableOpacity
                        onPress={onMarkAll}
                        activeOpacity={0.82}
                        style={headerStyles.markAllBtn}
                        accessibilityRole="button"
                        accessibilityLabel={markAllLabel}
                    >
                        <CheckCheck size={14} color={PURPLE_SOFT} strokeWidth={2.4} />
                        <Text style={headerStyles.markAllTxt} numberOfLines={1}>
                            {markAllLabel}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={headerStyles.bellWrap}>
                        <Bell size={18} color={PURPLE_SOFT} strokeWidth={2.4} />
                    </View>
                )}
            </View>
            <View style={headerStyles.hairline} />
        </View>
    );
});

const HEADER_BODY_HEIGHT = 64;

const headerStyles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: 'rgba(8,5,16,0.97)',
    },
    inner: {
        minHeight: HEADER_BODY_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SCREEN_PADDING_H,
        gap: 10,
        paddingVertical: 8,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    titleBlock: { flex: 1, minWidth: 0 },
    eyebrow: {
        fontSize: 9,
        fontWeight: '800',
        color: PURPLE_SOFT,
        letterSpacing: 1.2,
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        color: TEXT_PRIMARY,
        letterSpacing: -0.3,
        marginTop: 1,
    },
    sub: {
        fontSize: 11,
        color: TEXT_MUTED,
        marginTop: 1,
        fontWeight: '600',
    },
    markAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(124,58,237,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.35)',
        maxWidth: 120,
    },
    markAllTxt: {
        color: PURPLE_SOFT,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    bellWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(124,58,237,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.28)',
    },
    hairline: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: SCREEN_PADDING_H,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
});

// ─── Row (memoized for FlashList) ─────────────────────────────────────────
type NotificationRowProps = {
    item: SocialNotification;
    onPress: (item: SocialNotification) => void;
    relativeTime: string;
    kindLabel: string;
};

function actorAvatarOf(item: SocialNotification): string | undefined {
    const data = item.data as Record<string, unknown> | undefined;
    const url = data?.actorAvatar || data?.followerAvatar || data?.avatar;
    return typeof url === 'string' && url.startsWith('http') ? url : undefined;
}

const NotificationRow = React.memo(function NotificationRow({
    item,
    onPress,
    relativeTime,
    kindLabel,
}: NotificationRowProps) {
    const kind = mapTypeToKind(item.type);
    const { Icon, color, tint } = KIND_META[kind];
    const avatar = actorAvatarOf(item);
    const unread = !item.isRead;

    return (
        <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => onPress(item)}
            style={[styles.card, unread && styles.cardUnread]}
            accessibilityRole="button"
            accessibilityLabel={`${kindLabel}. ${item.title}`}
        >
            <View style={[styles.accent, { backgroundColor: color }]} />
            <View style={[styles.iconWrap, { backgroundColor: tint, borderColor: `${color}55` }]}>
                {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
                ) : (
                    <Icon size={18} color={color} strokeWidth={2.2} />
                )}
            </View>
            <View style={styles.cardMid}>
                <View style={styles.chipRow}>
                    <View style={[styles.chip, { backgroundColor: tint, borderColor: `${color}44` }]}>
                        <Text style={[styles.chipTxt, { color }]} numberOfLines={1}>
                            {kindLabel}
                        </Text>
                    </View>
                    <Text style={styles.time} numberOfLines={1}>
                        {relativeTime}
                    </Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                </Text>
                <Text style={styles.cardBody} numberOfLines={2}>
                    {item.message}
                </Text>
            </View>
            {unread ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
        </TouchableOpacity>
    );
});

// ─── Skeleton (shown briefly while cache is warming) ──────────────────────
function NotificationSkeleton() {
    return (
        <View style={{ gap: 10 }}>
            {[0, 1, 2, 3].map(i => (
                <View key={i} style={skelStyles.row}>
                    <View style={skelStyles.iconBox} />
                    <View style={{ flex: 1, gap: 8 }}>
                        <View style={[skelStyles.line, { width: '70%' }]} />
                        <View style={[skelStyles.line, { width: '45%', height: 9 }]} />
                    </View>
                </View>
            ))}
        </View>
    );
}

const skelStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: RADIUS_LG,
        borderWidth: 1,
        borderColor: BORDER_ARENA,
        backgroundColor: 'rgba(16,12,26,0.6)',
        gap: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    line: {
        height: 11,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
});

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function NotificationsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { getToken } = useAuth();
    const {
        notifications,
        isLoading,
        isRefreshing,
        error,
        refreshNotifications,
        setBackendNotifications,
        setUnreadCount,
        handleLoadMore,
        isLoadingMore,
        hasMore,
        unreadCount,
    } = useNotifications();

    const params = useLocalSearchParams<{ openLuckyWheel?: string }>();
    const [showLuckyWheel, setShowLuckyWheel] = useState(false);

    useEffect(() => {
        if (params.openLuckyWheel === 'true') {
            setShowLuckyWheel(false);
            router.replace('/(tabs)/profile');
        }
    }, [params.openLuckyWheel, router]);

    useFocusEffect(
        useCallback(() => {
            void syncExpoPushTokenIfGranted(getToken);
        }, [getToken]),
    );

    // Error toast feedback
    useEffect(() => {
        if (error && notifications.length === 0) {
            toastManager.showError(
                t.notifications.failedToLoad,
                error,
                { duration: 3500, position: 'top' },
            );
        }
    }, [error, notifications.length, t.notifications]);

    const handleBack = useCallback(() => {
        Haptics.selectionAsync();
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/matches');
    }, [router]);

    const markAllRead = useCallback(async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const token = await getToken();
            if (!token) return;
            const success = await NotificationService.markAllAsRead(token);
            if (success) {
                setBackendNotifications((prev) =>
                    prev.map((n) => ({ ...n, isRead: true })),
                );
                setUnreadCount(0);
                toastManager.showSuccess(
                    t.notifications.markAllRead,
                    '',
                    { duration: 1500, position: 'top' },
                );
            }
        } catch (err) {
            logger.error('Failed to mark all read:', err);
            toastManager.showError(t.common.error, t.notifications.couldNotMarkRead, {
                duration: 2500,
            });
        }
    }, [getToken, setBackendNotifications, setUnreadCount, t]);

    const handleNotificationTap = useCallback(
        async (notif: SocialNotification) => {
            try {
                Haptics.selectionAsync();
                if (!notif.isRead) {
                    const token = await getToken();
                    if (token) {
                        NotificationService.markAsRead(token, notif.id).catch(() => { });
                        setBackendNotifications((prev) =>
                            prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
                        );
                        setUnreadCount((c) => Math.max(0, c - 1));
                    }
                }

                const data = (notif.data ?? {}) as Record<string, any>;
                switch (notif.type) {
                    case 'FOLLOW': {
                        const username =
                            data.actorUsername || data.followerUsername || data.username;
                        if (username) router.push({ pathname: '/user/[username]', params: { username } });
                        break;
                    }
                    case 'LIKE':
                    case 'SHARE':
                        if (data.reelId) {
                            router.push({ pathname: '/(tabs)/reels', params: { reelId: data.reelId } });
                        }
                        break;
                    case 'COMMENT':
                    case 'REPLY':
                    case 'MENTION':
                    case 'COMMENT_LIKE':
                        if (data.reelId && data.commentId) {
                            const parentId =
                                typeof data.parentCommentId === 'string' ? data.parentCommentId : undefined;
                            router.push({
                                pathname: '/(tabs)/reels',
                                params: {
                                    reelId: data.reelId,
                                    commentId: parentId || data.commentId,
                                    highlightReplyId: parentId ? data.commentId : undefined,
                                    autoOpenComments: 'true',
                                },
                            });
                        } else if (data.reelId) {
                            router.push({ pathname: '/(tabs)/reels', params: { reelId: data.reelId } });
                        }
                        break;
                    case 'MATCH_UPDATE':
                    case 'MATCH_FAVORITE': {
                        const subType = data.type as string | undefined;
                        const isFinished = subType === 'MATCH_END' || subType === 'PREDICTION_RESULT';
                        if (data.matchId || data.fixtureId) {
                            router.push({
                                pathname: '/(tabs)/match-details',
                                params: {
                                    fixtureId: String(data.matchId || data.fixtureId),
                                },
                            });
                        } else {
                            router.push('/(tabs)/matches');
                        }
                        break;
                    }
                    case 'PREDICTION_RESULT':
                        if (data.matchId || data.fixtureId) {
                            router.push({
                                pathname: '/(tabs)/match-details',
                                params: {
                                    fixtureId: String(data.matchId || data.fixtureId),
                                },
                            });
                        } else {
                            router.push('/(tabs)/matches');
                        }
                        break;
                    case 'LUCKY_WHEEL':
                    case 'LUCKY_WHEEL_RENEWED':
                        router.push('/(tabs)/profile');
                        break;
                    default:
                        break;
                }
            } catch (err) {
                logger.error('Failed to handle notification tap:', err);
            }
        },
        [getToken, router, setBackendNotifications, setUnreadCount],
    );

    const bottomPad = Math.max(insets.bottom, 16) + 56 + 32;

    const listEmpty = useMemo(() => {
        if (isLoading) return <NotificationSkeleton />;
        if (error) {
            return (
                <View style={styles.errorWrap}>
                    <Text style={styles.errorTitle}>{t.notifications.loadFailed}</Text>
                    <Text style={styles.errorSub}>{error}</Text>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.retryBtn}
                        onPress={refreshNotifications}
                    >
                        <Text style={styles.retryTxt}>{t.notifications.tryAgain}</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}>
                    <MessageSquare size={22} color="rgba(167,139,250,0.55)" strokeWidth={2} />
                </View>
                <Text style={styles.emptyTitle}>{t.notifications.noNotifications}</Text>
                <Text style={styles.emptySub}>{t.notifications.emptyDefaultSubtitle}</Text>
            </View>
        );
    }, [isLoading, error, refreshNotifications, t]);

    const listFooter = useMemo(() => {
        if (notifications.length === 0) return null;
        if (!hasMore) {
            return (
                <Text style={styles.caughtUp}>{t.notifications.inboxCaughtUp}</Text>
            );
        }
        return (
            <TouchableOpacity
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleLoadMore();
                }}
                disabled={isLoadingMore}
                activeOpacity={0.88}
                style={styles.loadMoreWrap}
                accessibilityRole="button"
                accessibilityLabel={t.notifications.loadMore}
            >
                <LinearGradient
                    colors={['#8B5CF6', '#513690']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.loadMoreBtn}
                >
                    {isLoadingMore ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.loadMoreTxt}>{t.notifications.loadMore}</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    }, [hasMore, notifications.length, isLoadingMore, handleLoadMore, t.notifications]);

    const keyExtractor = useCallback((item: SocialNotification) => item.id, []);

    const renderItem = useCallback(
        ({ item }: { item: SocialNotification }) => (
            <NotificationRow
                item={item}
                onPress={handleNotificationTap}
                relativeTime={formatRelativeTime(item.createdAt, t)}
                kindLabel={kindLabelFor(item.type, t.notifications)}
            />
        ),
        [handleNotificationTap, t],
    );

    return (
        <View style={styles.root}>
            <LinearGradient
                colors={[...GRADIENT_BG_COLORS]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[...GRADIENT_BG_LOCATIONS]}
            />

            <NotificationsHeader
                unreadCount={unreadCount}
                total={notifications.length}
                topInset={insets.top}
                onBack={handleBack}
                onMarkAll={markAllRead}
                hasUnread={unreadCount > 0}
                title={t.settings?.notifications || t.notifications.title}
                markAllLabel={t.notifications.markAllRead}
                eyebrowLabel={t.notifications.inboxEyebrow}
                summaryLabel={t.notifications.inboxSummary
                    .replace('{unread}', String(unreadCount))
                    .replace('{total}', String(notifications.length))}
                backLabel={t.notifications.a11yBack}
            />

            <View style={styles.scroll}>
                <FlashList
                    data={notifications}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={{
                        paddingTop: insets.top + HEADER_BODY_HEIGHT + 16,
                        paddingHorizontal: SCREEN_PADDING_H,
                        paddingBottom: bottomPad + SECTION_GAP,
                    }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={listEmpty}
                    ListFooterComponent={listFooter}
                    extraData={`${isLoadingMore}-${hasMore}`}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={refreshNotifications}
                            tintColor={PURPLE_SOFT}
                            colors={[PURPLE_SOFT]}
                            progressBackgroundColor={BG_BASE}
                        />
                    }
                    drawDistance={80}
                />
            </View>
            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: BG_BASE },
    scroll: { flex: 1 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        paddingStart: 0,
        marginBottom: 10,
        borderRadius: RADIUS_LG,
        borderWidth: 1,
        borderColor: BORDER_ARENA,
        backgroundColor: 'rgba(16,12,28,0.94)',
        overflow: 'hidden',
    },
    cardUnread: {
        borderColor: 'rgba(139,92,246,0.45)',
        backgroundColor: 'rgba(42,24,72,0.92)',
    },
    accent: {
        width: 3,
        alignSelf: 'stretch',
        marginEnd: 10,
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatar: {
        width: 44,
        height: 44,
    },
    cardMid: { flex: 1, marginHorizontal: 10, minWidth: 0 },
    chipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 4,
    },
    chip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        maxWidth: '70%',
    },
    chipTxt: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: TEXT_PRIMARY,
        letterSpacing: -0.2,
    },
    cardBody: {
        marginTop: 3,
        fontSize: 13,
        lineHeight: 18,
        color: TEXT_SECONDARY,
    },
    time: {
        fontSize: 11,
        fontWeight: '600',
        color: TEXT_MUTED,
        flexShrink: 0,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: PURPLE_SOFT,
        marginStart: 4,
    },
    dotSpacer: {
        width: 8,
        marginStart: 4,
    },
    errorWrap: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 8,
    },
    errorTitle: {
        color: TEXT_PRIMARY,
        fontSize: 15,
        fontWeight: '700',
    },
    errorSub: {
        color: TEXT_MUTED,
        fontSize: 12,
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    retryBtn: {
        marginTop: 12,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.3)',
        backgroundColor: 'rgba(124,58,237,0.12)',
    },
    retryTxt: {
        color: PURPLE_SOFT,
        fontSize: 13,
        fontWeight: '700',
    },
    emptyWrap: {
        alignItems: 'center',
        paddingVertical: 60,
        gap: 8,
    },
    emptyIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(124,58,237,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    emptyTitle: {
        color: 'rgba(167,139,250,0.8)',
        fontSize: 16,
        fontWeight: '700',
    },
    emptySub: {
        color: TEXT_MUTED,
        fontSize: 12,
        textAlign: 'center',
        paddingHorizontal: 24,
        lineHeight: 18,
    },
    loadMoreWrap: {
        marginTop: 6,
        marginBottom: 18,
        borderRadius: 16,
        shadowColor: '#6B2EF7',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.55,
        shadowRadius: 10,
        ...Platform.select({
            android: { elevation: 8 },
            default: {},
        }),
    },
    loadMoreBtn: {
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#4703E3',
        overflow: 'hidden',
    },
    loadMoreTxt: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    caughtUp: {
        marginTop: 8,
        marginBottom: 20,
        textAlign: 'center',
        color: TEXT_MUTED,
        fontSize: 12,
        fontWeight: '600',
    },
});
