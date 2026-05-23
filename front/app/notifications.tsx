import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { useRouter } from 'expo-router';
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
    Clock,
    ChevronRight,
} from 'lucide-react-native';
import BottomNav from './(tabs)/BottomNav';
import {
    TEXT_PRIMARY,
    TEXT_MUTED,
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
import { useHomeStore } from '../src/store/home.store';
import { logger } from '../utils/logger';
import { toastManager } from '../services/toastManager';
import { useTranslation } from '../src/i18n';
import LuckyWheelModal from '../components/common/LuckyWheelModal';

type Kind = 'match' | 'quiz' | 'social' | 'system' | 'like' | 'comment' | 'mention' | 'moderation';

const KIND_META: Record<Kind, { Icon: LucideIcon; color: string }> = {
    match: { Icon: Trophy, color: GOLD_PRIMARY },
    quiz: { Icon: Sparkles, color: PURPLE_SOFT },
    social: { Icon: Users, color: BLUE_PRIMARY },
    system: { Icon: Bell, color: TEXT_MUTED },
    like: { Icon: Heart, color: '#ef4444' },
    comment: { Icon: MessageCircle, color: BLUE_PRIMARY },
    mention: { Icon: AtSign, color: PURPLE_SOFT },
    moderation: { Icon: Shield, color: '#fcd34d' },
};

function mapTypeToKind(type: SocialNotification['type']): Kind {
    switch (type) {
        case 'MATCH_UPDATE':
        case 'MATCH_FAVORITE':
        case 'PREDICTION_RESULT':
            return 'match';
        case 'FOLLOW':
            return 'social';
        case 'LIKE':
            return 'like';
        case 'COMMENT':
        case 'REPLY':
            return 'comment';
        case 'MENTION':
            return 'mention';
        case 'MODERATION_ALERT':
            return 'moderation';
        default:
            return 'system';
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

// ─── Liquid Glass Header (pinned) ──────────────────────────────────────────
const HeaderGlass: any = isLiquidGlassSupported ? LiquidGlassView : BlurView;
const headerGlassProps: any = isLiquidGlassSupported
    ? { effect: 'clear', interactive: true }
    : { intensity: 22, tint: 'dark' };

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
        <HeaderGlass
            {...headerGlassProps}
            style={[headerStyles.container, { paddingTop: topInset + 8 }]}
        >
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
        </HeaderGlass>
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
        backgroundColor: Platform.OS === 'android' ? 'rgba(6,4,10,0.5)' : 'transparent',
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

// ─── Lucky Wheel pinned card ───────────────────────────────────────────────
type LuckyWheelPinnedProps = {
    canSpin: boolean;
    timeRemaining: { hours: number; minutes: number } | null;
    onPress: () => void;
    readyTitle: string;
    readySub: string;
    lockedTitle: string;
    lockedSub: string;
};

const LuckyWheelPinned = React.memo(function LuckyWheelPinned({
    canSpin,
    timeRemaining,
    onPress,
    readyTitle,
    readySub,
    lockedTitle,
    lockedSub,
}: LuckyWheelPinnedProps) {
    const gradientColors: readonly [string, string, string] = canSpin
        ? ['rgba(245,197,24,0.32)', 'rgba(124,58,237,0.26)', 'rgba(59,130,246,0.18)']
        : ['rgba(124,58,237,0.18)', 'rgba(76,29,149,0.12)', 'rgba(30,20,50,0.18)'];

    const timerText = timeRemaining
        ? `${String(timeRemaining.hours).padStart(2, '0')}:${String(timeRemaining.minutes).padStart(2, '0')}`
        : '--:--';

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={[
                luckyStyles.wrap,
                {
                    borderColor: canSpin ? 'rgba(245,197,24,0.45)' : 'rgba(167,139,250,0.28)',
                    shadowColor: canSpin ? GOLD_PRIMARY : PURPLE_PRIMARY,
                },
            ]}
        >
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {/* Glass overlay */}
            {isLiquidGlassSupported ? (
                <LiquidGlassView
                    {...({ style: StyleSheet.absoluteFill, effect: 'clear' } as any)}
                />
            ) : (
                <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
            )}

            <View style={luckyStyles.row}>
                <View
                    style={[
                        luckyStyles.iconWrap,
                        {
                            backgroundColor: canSpin
                                ? 'rgba(245,197,24,0.22)'
                                : 'rgba(124,58,237,0.22)',
                            borderColor: canSpin
                                ? 'rgba(245,197,24,0.5)'
                                : 'rgba(167,139,250,0.4)',
                        },
                    ]}
                >
                    <Gift
                        size={22}
                        color={canSpin ? GOLD_PRIMARY : PURPLE_SOFT}
                        strokeWidth={2.2}
                    />
                </View>

                <View style={luckyStyles.body}>
                    <View style={luckyStyles.titleRow}>
                        <Text style={luckyStyles.title} numberOfLines={1}>
                            {canSpin ? readyTitle : lockedTitle}
                        </Text>
                        {canSpin ? (
                            <View style={luckyStyles.pulseDot} />
                        ) : null}
                    </View>
                    <Text style={luckyStyles.sub} numberOfLines={1}>
                        {canSpin ? readySub : lockedSub}
                    </Text>
                </View>

                {canSpin ? (
                    <View style={luckyStyles.cta}>
                        <Text style={luckyStyles.ctaTxt}>SPIN</Text>
                        <ChevronRight size={14} color="#1a0f00" strokeWidth={2.6} />
                    </View>
                ) : (
                    <View style={luckyStyles.timerWrap}>
                        <Clock size={10} color={TEXT_MUTED} strokeWidth={2.2} />
                        <Text style={luckyStyles.timerTxt}>{timerText}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
});

const luckyStyles = StyleSheet.create({
    wrap: {
        borderRadius: RADIUS_LG,
        overflow: 'hidden',
        borderWidth: 1,
        marginBottom: 14,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
    },
    iconWrap: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    body: { flex: 1, minWidth: 0 },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: '800',
        color: TEXT_PRIMARY,
        letterSpacing: -0.2,
        flexShrink: 1,
    },
    sub: {
        marginTop: 3,
        fontSize: 12,
        color: 'rgba(255,255,255,0.72)',
        fontWeight: '500',
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: GOLD_PRIMARY,
        shadowColor: GOLD_PRIMARY,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
        elevation: 4,
    },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: GOLD_PRIMARY,
        shadowColor: GOLD_PRIMARY,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
        elevation: 6,
    },
    ctaTxt: {
        fontSize: 11,
        fontWeight: '900',
        color: '#1a0f00',
        letterSpacing: 0.8,
    },
    timerWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    timerTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.75)',
        fontVariant: ['tabular-nums'],
        letterSpacing: 0.3,
    },
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
        canSpin,
        spinTimeRemaining,
        checkSpinStatus,
    } = useNotifications();
    const { clearNotifications: clearMatchNotifications } = useHomeStore();

    const [showLuckyWheel, setShowLuckyWheel] = useState(false);
    const loadingToastShownRef = useRef(false);

    // Toast feedback for loading state — only if first-load is taking a moment
    useEffect(() => {
        if (isLoading && notifications.length === 0 && !loadingToastShownRef.current) {
            loadingToastShownRef.current = true;
            const timer = setTimeout(() => {
                if (isLoading) {
                    toastManager.showLoading(
                        t.notifications.loading,
                        '',
                        { position: 'top' },
                    );
                }
            }, 400);
            return () => clearTimeout(timer);
        }
        if (!isLoading && loadingToastShownRef.current) {
            toastManager.hideLoading();
            loadingToastShownRef.current = false;
        }
    }, [isLoading, notifications.length, t.notifications]);

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

    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.isRead).length,
        [notifications],
    );

    const handleBack = useCallback(() => {
        Haptics.selectionAsync();
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/Home');
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
                clearMatchNotifications();
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
    }, [getToken, setBackendNotifications, setUnreadCount, clearMatchNotifications, t]);

    const handleLuckyWheelPress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowLuckyWheel(true);
    }, []);

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
                            router.push({
                                pathname: '/(tabs)/reels',
                                params: {
                                    reelId: data.reelId,
                                    commentId: data.commentId,
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
                                    homeTeam: data.homeTeam || '',
                                    awayTeam: data.awayTeam || '',
                                    homeLogo: data.homeTeamLogo || '',
                                    awayLogo: data.awayTeamLogo || '',
                                    homeScore: data.homeScore != null ? String(data.homeScore) : '',
                                    awayScore: data.awayScore != null ? String(data.awayScore) : '',
                                    league: data.leagueName || '',
                                    leagueLogo: '',
                                    date: data.matchDate || new Date().toISOString().split('T')[0],
                                    time: '',
                                    status: isFinished ? 'finished' : 'live',
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
                                    homeTeam: data.homeTeam || '',
                                    awayTeam: data.awayTeam || '',
                                    homeLogo: data.homeTeamLogo || '',
                                    awayLogo: data.awayTeamLogo || '',
                                    homeScore: data.homeScore != null ? String(data.homeScore) : '',
                                    awayScore: data.awayScore != null ? String(data.awayScore) : '',
                                    league: data.leagueName || '',
                                    leagueLogo: '',
                                    date: data.matchDate || new Date().toISOString().split('T')[0],
                                    time: '',
                                    status: 'finished',
                                },
                            });
                        } else {
                            router.push({ pathname: '/(tabs)/matches', params: { filter: 'Predictions' } });
                        }
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

    return (
        <View style={styles.root}>
            {/* Same gradient background as all other screens (matches notifications screen body) */}
            <LinearGradient
                colors={[...GRADIENT_BG_COLORS]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[...GRADIENT_BG_LOCATIONS]}
            />

            {/* Pinned liquid-glass header */}
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

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{
                    paddingTop: insets.top + HEADER_BODY_HEIGHT + 16,
                    paddingHorizontal: SCREEN_PADDING_H,
                    paddingBottom: bottomPad + SECTION_GAP,
                }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={refreshNotifications}
                        tintColor={PURPLE_SOFT}
                        colors={[PURPLE_SOFT]}
                        progressBackgroundColor={BG_BASE}
                    />
                }
            >
                {/* Always-pinned Lucky Wheel access */}
                <LuckyWheelPinned
                    canSpin={canSpin}
                    timeRemaining={spinTimeRemaining}
                    onPress={handleLuckyWheelPress}
                    readyTitle={t.notifications.luckyWheelReady}
                    readySub={t.notifications.tapToWin}
                    lockedTitle={t.home?.wheelLocked || t.luckyWheel?.locked || t.common.unavailable}
                    lockedSub={t.notifications.wheelAvailableIn}
                />

                {/* Notifications list */}
                {isLoading && notifications.length === 0 ? (
                    <NotificationSkeleton />
                ) : error && notifications.length === 0 ? (
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
                ) : notifications.length === 0 ? (
                    <View style={styles.emptyWrap}>
                        <View style={styles.emptyIconWrap}>
                            <MessageSquare size={22} color="rgba(167,139,250,0.55)" strokeWidth={2} />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {t.notifications.noNotifications}
                        </Text>
                        <Text style={styles.emptySub}>
                            {t.notifications.emptyDefaultSubtitle}
                        </Text>
                    </View>
                ) : (
                    <>
                        {notifications.map((row) => {
                            const kind = mapTypeToKind(row.type);
                            const { Icon, color } = KIND_META[kind];
                            return (
                                <TouchableOpacity
                                    key={row.id}
                                    activeOpacity={0.85}
                                    onPress={() => handleNotificationTap(row)}
                                    style={[styles.card, !row.isRead && styles.cardUnread]}
                                >
                                    <View style={[styles.iconWrap, { borderColor: `${color}44` }]}>
                                        <Icon size={18} color={color} strokeWidth={2.2} />
                                    </View>
                                    <View style={styles.cardMid}>
                                        <Text style={styles.cardTitle} numberOfLines={1}>
                                            {row.title}
                                        </Text>
                                        <Text style={styles.cardBody} numberOfLines={2}>
                                            {row.message}
                                        </Text>
                                    </View>
                                    <View style={styles.cardRight}>
                                        <Text style={styles.time}>{formatRelativeTime(row.createdAt, t)}</Text>
                                        {!row.isRead ? <View style={styles.dot} /> : null}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {hasMore && (
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={handleLoadMore}
                                disabled={isLoadingMore}
                                style={styles.loadMoreBtn}
                            >
                                {isLoadingMore ? (
                                    <ActivityIndicator color={PURPLE_SOFT} />
                                ) : (
                                    <Text style={styles.loadMoreTxt}>{t.notifications.loadMore}</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </ScrollView>

            <BottomNav />

            <LuckyWheelModal
                visible={showLuckyWheel}
                onClose={() => {
                    setShowLuckyWheel(false);
                    checkSpinStatus();
                }}
                onCoinsWon={() => { }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: BG_BASE },
    scroll: { flex: 1 },
    card: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        marginBottom: 10,
        borderRadius: RADIUS_LG,
        borderWidth: 1,
        borderColor: BORDER_ARENA,
        backgroundColor: 'rgba(16,12,26,0.9)',
    },
    cardUnread: {
        borderColor: 'rgba(124,58,237,0.35)',
        backgroundColor: 'rgba(34,22,52,0.85)',
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(8,6,14,0.82)',
    },
    cardMid: { flex: 1, marginHorizontal: 10 },
    cardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: TEXT_PRIMARY,
        letterSpacing: -0.2,
    },
    cardBody: {
        marginTop: 4,
        fontSize: 13,
        lineHeight: 18,
        color: TEXT_MUTED,
    },
    cardRight: { alignItems: 'flex-end', minWidth: 52 },
    time: { fontSize: 11, fontWeight: '600', color: TEXT_MUTED },
    dot: {
        marginTop: 8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: PURPLE_SOFT,
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
    loadMoreBtn: {
        marginTop: 8,
        marginBottom: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: RADIUS_LG,
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.25)',
        backgroundColor: 'rgba(124,58,237,0.08)',
    },
    loadMoreTxt: {
        color: PURPLE_SOFT,
        fontSize: 13,
        fontWeight: '700',
    },
});
