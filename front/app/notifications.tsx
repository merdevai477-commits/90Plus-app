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
import { StatusBar } from 'expo-status-bar';
import {
    RADIUS_LG,
    SCREEN_PADDING_H,
    SECTION_GAP,
} from '../constants/tokens';
import { useNotifications } from '../components/notifications/hooks/useNotifications';
import {
    getNotificationsTheme,
    kindVisual,
    type NotificationsTheme,
} from '../components/notifications/notificationsTheme';
import { useResolvedAppScheme } from '@/hooks/useResolvedAppScheme';
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

const KIND_ICONS: Record<Kind, LucideIcon> = {
    match: Trophy,
    quiz: Sparkles,
    social: Users,
    system: Bell,
    like: Heart,
    comment: MessageCircle,
    mention: AtSign,
    moderation: Shield,
    report: Flag,
    avatar: UserCircle,
    ai: Bot,
    leaderboard: TrendingUp,
    levelup: Award,
    video: Video,
    gift: Gift,
    lucky: Sparkles,
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
    theme: NotificationsTheme;
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
    theme,
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
        <View style={[headerStyles.container, { paddingTop: topInset + 8, backgroundColor: theme.headerBg }]}>
            <LinearGradient
                colors={[...theme.headerGradient]}
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
                    style={[
                        headerStyles.backBtn,
                        {
                            backgroundColor: theme.backBtnBg,
                            borderColor: theme.backBtnBorder,
                            borderWidth: theme.isDark ? StyleSheet.hairlineWidth : 1,
                        },
                        theme.elevationSoft,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={backLabel}
                >
                    <ChevronLeft color={theme.text} size={22} strokeWidth={2.2} />
                </TouchableOpacity>

                <View style={headerStyles.titleBlock}>
                    <Text style={[headerStyles.eyebrow, { color: theme.accentSoft }]}>{eyebrowLabel}</Text>
                    <Text style={[headerStyles.title, { color: theme.text }]} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text style={[headerStyles.sub, { color: theme.muted }]} numberOfLines={1}>
                        {summaryLabel}
                    </Text>
                </View>

                {hasUnread ? (
                    <TouchableOpacity
                        onPress={onMarkAll}
                        activeOpacity={0.82}
                        style={[
                            headerStyles.markAllBtn,
                            {
                                backgroundColor: theme.markAllBg,
                                borderColor: theme.markAllBorder,
                            },
                            theme.elevationSoft,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={markAllLabel}
                    >
                        <CheckCheck size={14} color={theme.accentSoft} strokeWidth={2.4} />
                        <Text style={[headerStyles.markAllTxt, { color: theme.accentSoft }]} numberOfLines={1}>
                            {markAllLabel}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View
                        style={[
                            headerStyles.bellWrap,
                            {
                                backgroundColor: theme.markAllBg,
                                borderColor: theme.markAllBorder,
                            },
                            theme.elevationSoft,
                        ]}
                    >
                        <Bell size={18} color={theme.accentSoft} strokeWidth={2.4} />
                    </View>
                )}
            </View>
            <View style={[headerStyles.hairline, { backgroundColor: theme.hairline }]} />
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
    },
    titleBlock: { flex: 1, minWidth: 0 },
    eyebrow: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.3,
        marginTop: 1,
    },
    sub: {
        fontSize: 11,
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
        borderWidth: 1,
        maxWidth: 120,
    },
    markAllTxt: {
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
        borderWidth: 1,
    },
    hairline: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: SCREEN_PADDING_H,
    },
});

// ─── Row (memoized for FlashList) ─────────────────────────────────────────
type NotificationRowProps = {
    item: SocialNotification;
    theme: NotificationsTheme;
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
    theme,
    onPress,
    relativeTime,
    kindLabel,
}: NotificationRowProps) {
    const kind = mapTypeToKind(item.type);
    const Icon = KIND_ICONS[kind];
    const { color, tint } = kindVisual(kind, theme.isDark);
    const avatar = actorAvatarOf(item);
    const unread = !item.isRead;

    return (
        <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => onPress(item)}
            style={[
                styles.cardOuter,
                theme.elevationCard,
                {
                    backgroundColor: unread ? theme.cardUnread : theme.card,
                    borderColor: unread ? theme.cardUnreadBorder : theme.cardBorder,
                },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${kindLabel}. ${item.title}`}
        >
            <View style={styles.card}>
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
                        <Text style={[styles.time, { color: theme.muted }]} numberOfLines={1}>
                            {relativeTime}
                        </Text>
                    </View>
                    <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={[styles.cardBody, { color: theme.textSecondary }]} numberOfLines={2}>
                        {item.message}
                    </Text>
                </View>
                {unread ? (
                    <View style={[styles.dot, { backgroundColor: theme.accentSoft }]} />
                ) : (
                    <View style={styles.dotSpacer} />
                )}
            </View>
        </TouchableOpacity>
    );
});

// ─── Skeleton (shown briefly while cache is warming) ──────────────────────
function NotificationSkeleton({ theme }: { theme: NotificationsTheme }) {
    return (
        <View style={{ gap: 10 }}>
            {[0, 1, 2, 3].map(i => (
                <View
                    key={i}
                    style={[
                        skelStyles.row,
                        {
                            backgroundColor: theme.skelBg,
                            borderColor: theme.cardBorder,
                        },
                        theme.elevationCard,
                    ]}
                >
                    <View style={[skelStyles.iconBox, { backgroundColor: theme.skelFill }]} />
                    <View style={{ flex: 1, gap: 8 }}>
                        <View style={[skelStyles.line, { width: '70%', backgroundColor: theme.skelFill }]} />
                        <View style={[skelStyles.line, { width: '45%', height: 9, backgroundColor: theme.skelFill }]} />
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
        gap: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
    },
    line: {
        height: 11,
        borderRadius: 4,
    },
});

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function NotificationsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { getToken } = useAuth();
    const { isDark } = useResolvedAppScheme();
    const theme = useMemo(() => getNotificationsTheme(isDark), [isDark]);
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
                if (data.kind === 'community' && data.postId && notif.type !== 'MODERATION_ALERT') {
                    router.push({
                        pathname: '/community/post/[id]',
                        params: { id: String(data.postId), ...(data.commentId ? { comments: '1' } : {}) },
                    } as any);
                    return;
                }
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
        if (isLoading) return <NotificationSkeleton theme={theme} />;
        if (error) {
            return (
                <View style={styles.errorWrap}>
                    <Text style={[styles.errorTitle, { color: theme.text }]}>{t.notifications.loadFailed}</Text>
                    <Text style={[styles.errorSub, { color: theme.muted }]}>{error}</Text>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                            styles.retryBtn,
                            { backgroundColor: theme.retryBg, borderColor: theme.retryBorder },
                            theme.elevationSoft,
                        ]}
                        onPress={refreshNotifications}
                    >
                        <Text style={[styles.retryTxt, { color: theme.accentSoft }]}>{t.notifications.tryAgain}</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View style={styles.emptyWrap}>
                <View
                    style={[
                        styles.emptyIconWrap,
                        {
                            backgroundColor: theme.emptyIconBg,
                            borderColor: theme.emptyIconBorder,
                        },
                        theme.elevationSoft,
                    ]}
                >
                    <MessageSquare size={22} color={theme.accentSoft} strokeWidth={2} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.emptyTitle }]}>{t.notifications.noNotifications}</Text>
                <Text style={[styles.emptySub, { color: theme.muted }]}>{t.notifications.emptyDefaultSubtitle}</Text>
            </View>
        );
    }, [isLoading, error, refreshNotifications, t, theme]);

    const listFooter = useMemo(() => {
        if (notifications.length === 0) return null;
        if (!hasMore) {
            return (
                <Text style={[styles.caughtUp, { color: theme.muted }]}>{t.notifications.inboxCaughtUp}</Text>
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
                style={[styles.loadMoreWrap, theme.elevationCard]}
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
    }, [hasMore, notifications.length, isLoadingMore, handleLoadMore, t.notifications, theme]);

    const keyExtractor = useCallback((item: SocialNotification) => item.id, []);

    const renderItem = useCallback(
        ({ item }: { item: SocialNotification }) => (
            <NotificationRow
                item={item}
                theme={theme}
                onPress={handleNotificationTap}
                relativeTime={formatRelativeTime(item.createdAt, t)}
                kindLabel={kindLabelFor(item.type, t.notifications)}
            />
        ),
        [handleNotificationTap, t, theme],
    );

    return (
        <View style={[styles.root, { backgroundColor: theme.screen }]}>
            <StatusBar style={theme.statusBar} />
            <LinearGradient
                colors={[...theme.bgGradient]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[...theme.bgLocations]}
            />

            <NotificationsHeader
                theme={theme}
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
                    extraData={`${isLoadingMore}-${hasMore}-${theme.isDark}`}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={refreshNotifications}
                            tintColor={theme.accentSoft}
                            colors={[theme.accentSoft]}
                            progressBackgroundColor={theme.refreshBg}
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
    root: { flex: 1 },
    scroll: { flex: 1 },
    cardOuter: {
        marginBottom: 10,
        borderRadius: RADIUS_LG,
        borderWidth: 1,
        backgroundColor: '#FFFFFF',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        paddingStart: 0,
        borderRadius: RADIUS_LG,
        overflow: 'hidden',
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
        letterSpacing: -0.2,
    },
    cardBody: {
        marginTop: 3,
        fontSize: 13,
        lineHeight: 18,
    },
    time: {
        fontSize: 11,
        fontWeight: '600',
        flexShrink: 0,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
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
        fontSize: 15,
        fontWeight: '700',
    },
    errorSub: {
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
    },
    retryTxt: {
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
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    emptySub: {
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
        fontSize: 12,
        fontWeight: '600',
    },
});
