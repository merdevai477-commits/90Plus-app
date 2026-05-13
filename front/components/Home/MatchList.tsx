import React, { useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Dimensions,
    Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import Animated, {
    FadeInDown,
    useSharedValue,
    withRepeat,
    withTiming,
    useAnimatedStyle,
    Easing,
    type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Star, CalendarClock, Sparkles, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SectionHeader } from './SectionHeader';
import {
    PURPLE_PRIMARY,
    PURPLE_SOFT,
    BLUE_PRIMARY,
    LIVE_RED,
    GOLD_PRIMARY,
    TEXT_PRIMARY,
    TEXT_MUTED,
    SCREEN_PADDING_H,
} from '../../constants/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type MatchStatus = 'LIVE' | '1ST' | '2ND' | 'HT' | 'FT' | 'UPCOMING';

export interface MatchListItem {
    id: string;
    homeTeam: { name: string; shortName: string; score: number; logo?: string };
    awayTeam: { name: string; shortName: string; score: number; logo?: string };
    status: MatchStatus;
    minute?: string;
    stoppageTime?: number;
    league: string;
    kickoff?: string;
    /** True when the user has subscribed (bell) to this match. */
    isPinned?: boolean;
    isFavorited?: boolean;
}

// ─── Shared shimmer ───────────────────────────────────────────────────────────
function useShimmer(): SharedValue<number> {
    const shimmerX = useSharedValue(-SCREEN_WIDTH);
    useEffect(() => {
        shimmerX.value = withRepeat(
            withTiming(SCREEN_WIDTH, { duration: 1200, easing: Easing.linear }),
            -1,
            false,
        );
    }, [shimmerX]);
    return shimmerX;
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonMatchCard({ shimmerX }: { shimmerX: SharedValue<number> }): React.ReactElement {
    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shimmerX.value }],
    }));
    return (
        <View style={styles.skeletonCard}>
            <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 16 }]}>
                <Animated.View style={[styles.shimmerStrip, shimmerStyle]}>
                    <LinearGradient
                        colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ width: 120, height: '100%' }}
                    />
                </Animated.View>
            </Animated.View>
            <View style={styles.skeletonTopRow}>
                <View style={[styles.skeletonLine, { width: 60, height: 8 }]} />
                <View style={[styles.skeletonLine, { width: 40, height: 8 }]} />
            </View>
            <View style={styles.skeletonMiddle}>
                <View style={styles.skeletonCircle} />
                <View style={styles.skeletonScoreBlock}>
                    <View style={[styles.skeletonLine, { width: 30, height: 40, borderRadius: 6 }]} />
                    <View style={[styles.skeletonLine, { width: 20, height: 8 }]} />
                    <View style={[styles.skeletonLine, { width: 30, height: 40, borderRadius: 6 }]} />
                </View>
                <View style={styles.skeletonCircle} />
            </View>
            <View style={[styles.skeletonLine, { width: '60%', height: 8, alignSelf: 'center' }]} />
        </View>
    );
}

// ─── Pulsing live dot ─────────────────────────────────────────────────────────
function PulsingDot({ color = LIVE_RED }: { color?: string }): React.ReactElement {
    const pulse = useSharedValue(1);
    useEffect(() => {
        pulse.value = withRepeat(withTiming(0.3, { duration: 800 }), -1, true);
    }, [pulse]);
    const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
    return (
        <Animated.View
            style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, style]}
        />
    );
}

// ─── Team Logo (with initials fallback) ──────────────────────────────────────
function TeamLogo({ name, uri }: { name: string; uri?: string }): React.ReactElement {
    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={styles.teamLogoImg}
                contentFit="contain"
                transition={150}
                cachePolicy="memory-disk"
                recyclingKey={uri}
            />
        );
    }
    return (
        <View style={styles.teamAvatar}>
            <Text style={styles.teamAvatarText}>{name.slice(0, 2).toUpperCase()}</Text>
        </View>
    );
}

// ─── Match Card ───────────────────────────────────────────────────────────────
interface MatchCardProps {
    match: MatchListItem;
    index: number;
    onOpenHub: () => void;
    onFavoritePress?: (id: string) => void;
}

const MatchCard = React.memo(function MatchCard({
    match,
    index,
    onOpenHub,
    onFavoritePress,
}: MatchCardProps): React.ReactElement {
    const { homeTeam, awayTeam, status, minute, stoppageTime, league, kickoff, isPinned, isFavorited } = match;
    const isLive = status === 'LIVE' || status === '1ST' || status === '2ND' || status === 'HT';
    const isUpcoming = status === 'UPCOMING';
    const isStoppage = isLive && !!stoppageTime;

    const handleFav = useCallback(() => {
        onFavoritePress?.(match.id);
    }, [match.id, onFavoritePress]);

    return (
        <Animated.View entering={FadeInDown.delay(index * 80).springify().damping(14)}>
            <TouchableOpacity
                activeOpacity={0.92}
                onPress={onOpenHub}
                accessibilityRole="button"
                accessibilityLabel={`${homeTeam.shortName} vs ${awayTeam.shortName}`}
                style={[
                    styles.card,
                    isLive && styles.cardLive,
                    isStoppage && styles.cardStoppage,
                    isPinned && styles.cardPinned,
                ]}
            >
                {/* Left accent bar */}
                {isLive ? (
                    <LinearGradient
                        colors={isStoppage ? [LIVE_RED, LIVE_RED] : [PURPLE_PRIMARY, BLUE_PRIMARY]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.accentBar}
                    />
                ) : (
                    <View
                        style={[
                            styles.accentBar,
                            {
                                backgroundColor: isPinned
                                    ? '#fbbf24'
                                    : isUpcoming
                                    ? 'rgba(124,58,237,0.4)'
                                    : 'rgba(255,255,255,0.1)',
                            },
                        ]}
                    />
                )}

                {/* Top row */}
                <View style={styles.cardTop}>
                    <View style={styles.cardTopLeft}>
                        {isPinned && (
                            <Bell
                                size={11}
                                color="#fbbf24"
                                fill="#fbbf24"
                                strokeWidth={2}
                                style={{ marginRight: 4 }}
                            />
                        )}
                        <Text style={styles.leagueText} numberOfLines={1}>
                            {league}
                        </Text>
                    </View>
                    {isLive ? (
                        <View style={[styles.liveMinuteContainer, styles.liveMinuteBorder]}>
                            <Text style={[styles.minuteText, isStoppage && { color: LIVE_RED }]}>
                                {minute}
                                {!stoppageTime && "'"}
                                {stoppageTime ? (
                                    <Text style={styles.stoppageInline}> +{stoppageTime}</Text>
                                ) : null}
                            </Text>
                            <PulsingDot color={LIVE_RED} />
                        </View>
                    ) : status === 'FT' ? (
                        <View style={styles.ftBadge}>
                            <Text style={styles.ftText}>FT</Text>
                        </View>
                    ) : (
                        <Text style={styles.kickoffText}>{kickoff}</Text>
                    )}
                </View>

                {/* Teams + score */}
                <View style={styles.teamsRow}>
                    <View style={styles.teamCol}>
                        <TeamLogo name={homeTeam.shortName} uri={homeTeam.logo} />
                        <Text style={styles.teamName} numberOfLines={1}>
                            {homeTeam.shortName}
                        </Text>
                    </View>

                    <View style={styles.scoreArea}>
                        {isUpcoming ? (
                            <View style={styles.vsContainer}>
                                <Text style={styles.vsText}>VS</Text>
                                <Text style={styles.kickoffLarge}>{kickoff}</Text>
                            </View>
                        ) : (
                            <View style={styles.scoreRow}>
                                <Text style={styles.scoreNum}>{homeTeam.score}</Text>
                                <View style={styles.scoreSep}>
                                    <Text
                                        style={[
                                            styles.sepMinute,
                                            {
                                                color: isLive
                                                    ? isStoppage
                                                        ? LIVE_RED
                                                        : PURPLE_SOFT
                                                    : 'rgba(255,255,255,0.2)',
                                            },
                                        ]}
                                    >
                                        {isLive ? (stoppageTime ? `+${stoppageTime}` : minute) : '–'}
                                    </Text>
                                    {isLive && (
                                        <LinearGradient
                                            colors={
                                                isStoppage
                                                    ? [LIVE_RED, LIVE_RED]
                                                    : [PURPLE_PRIMARY, BLUE_PRIMARY]
                                            }
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.liveBar}
                                        />
                                    )}
                                </View>
                                <Text style={styles.scoreNum}>{awayTeam.score}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.teamCol}>
                        <TeamLogo name={awayTeam.shortName} uri={awayTeam.logo} />
                        <Text style={styles.teamName} numberOfLines={1}>
                            {awayTeam.shortName}
                        </Text>
                    </View>
                </View>

                {/* Bottom row */}
                <View style={styles.cardBottom}>
                    <TouchableOpacity
                        onPress={handleFav}
                        activeOpacity={0.7}
                        hitSlop={12}
                        style={styles.watchlistBtn}
                        accessibilityLabel={isFavorited ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                        <Star
                            size={17}
                            color={isFavorited ? GOLD_PRIMARY : 'rgba(255,255,255,0.28)'}
                            fill={isFavorited ? GOLD_PRIMARY : 'transparent'}
                            strokeWidth={isFavorited ? 0 : 2}
                        />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
});

// ─── Empty Section (confirmed empty after fetch) ──────────────────────────────
// Premium liquid-glass card with animated orbiting rings and a real calendar
// icon. No emojis, no dashed placeholders. Same pattern as the app's other
// glass surfaces (HomeHeader, RankHeader, BottomNav, notifications).
function OrbitingRing({
    size,
    duration,
    borderColor,
    reverse = false,
}: {
    size: number;
    duration: number;
    borderColor: string;
    reverse?: boolean;
}): React.ReactElement {
    const rotation = useSharedValue(0);
    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(reverse ? -360 : 360, { duration, easing: Easing.linear }),
            -1,
            false,
        );
    }, [duration, reverse, rotation]);
    const style = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }] as any,
    }));
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: 1,
                    borderColor,
                    borderTopColor: 'transparent',
                },
                style,
            ]}
        />
    );
}

function PulsingGlow(): React.ReactElement {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.45);
    useEffect(() => {
        scale.value = withRepeat(
            withTiming(1.18, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        );
        opacity.value = withRepeat(
            withTiming(0.2, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        );
    }, [opacity, scale]);
    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }] as any,
    }));
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    position: 'absolute',
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    backgroundColor: 'rgba(124,58,237,0.22)',
                },
                style,
            ]}
        />
    );
}

function EmptySection({ onAction }: { onAction?: () => void }): React.ReactElement {
    const glassProps: any = isLiquidGlassSupported
        ? { effect: 'clear', interactive: false, tint: 'rgba(20,15,30,0.58)' }
        : { intensity: 30, tint: 'dark' };

    const ctaGlassProps: any = isLiquidGlassSupported
        ? { effect: 'clear', interactive: true, tint: 'rgba(124,58,237,0.32)' }
        : { intensity: 35, tint: 'dark' };

    return (
        <View style={styles.emptyWrap}>
            {/* Outer glass surface */}
            <View style={styles.emptyCard}>
                {/* Liquid glass layer */}
                {isLiquidGlassSupported ? (
                    <LiquidGlassView
                        {...glassProps}
                        style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                    />
                ) : (
                    <BlurView
                        {...glassProps}
                        style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                    />
                )}

                {/* Subtle gradient tint on top of the glass */}
                <LinearGradient
                    colors={[
                        'rgba(124,58,237,0.10)',
                        'rgba(59,130,246,0.05)',
                        'rgba(10,7,18,0.00)',
                    ] as const}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                />

                {/* Inner hairline */}
                <View style={styles.emptyInnerBorder} pointerEvents="none" />

                {/* Icon cluster */}
                <View style={styles.emptyIconStage}>
                    <PulsingGlow />
                    <OrbitingRing
                        size={96}
                        duration={8000}
                        borderColor="rgba(167,139,250,0.45)"
                    />
                    <OrbitingRing
                        size={74}
                        duration={6000}
                        borderColor="rgba(96,165,250,0.35)"
                        reverse
                    />
                    <View style={styles.emptyIconBox}>
                        <LinearGradient
                            colors={[
                                'rgba(124,58,237,0.55)',
                                'rgba(59,130,246,0.45)',
                            ] as const}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <CalendarClock
                            size={26}
                            color="#FFFFFF"
                            strokeWidth={2.2}
                        />
                        {/* Accent sparkle */}
                        <View style={styles.emptySparkle}>
                            <Sparkles
                                size={10}
                                color={GOLD_PRIMARY}
                                fill={GOLD_PRIMARY}
                                strokeWidth={2}
                            />
                        </View>
                    </View>
                </View>

                {/* Copy */}
                <Text style={styles.emptyTitle}>مفيش ماتشات دلوقتي</Text>
                <Text style={styles.emptySubtitle}>
                    لسه مفيش مباريات مجدولة{'\n'}نزّل لتحديث الصفحة
                </Text>

                {/* Glass CTA pill */}
                {onAction ? (
                    <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={onAction}
                        style={styles.emptyCtaOuter}
                        accessibilityRole="button"
                        accessibilityLabel="فتح قائمة المباريات"
                    >
                        <View style={styles.emptyCta}>
                            {isLiquidGlassSupported ? (
                                <LiquidGlassView
                                    {...ctaGlassProps}
                                    style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                                />
                            ) : (
                                <BlurView
                                    {...ctaGlassProps}
                                    style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                                />
                            )}
                            <LinearGradient
                                colors={[
                                    'rgba(124,58,237,0.35)',
                                    'rgba(59,130,246,0.22)',
                                ] as const}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                            />
                            <Text style={styles.emptyCtaText}>استعرض كل المباريات</Text>
                            <ChevronRight
                                size={14}
                                color={PURPLE_SOFT}
                                strokeWidth={2.5}
                            />
                        </View>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

// ─── Public component ─────────────────────────────────────────────────────────
interface MatchListProps {
    isLoading?: boolean;
    matches?: MatchListItem[];
    onMatchPress?: (matchId: string) => void;
    onViewAllPress?: () => void;
    onFavoritePress?: (matchId: string) => void;
}

export function MatchList({
    isLoading = false,
    matches: matchesProp,
    onMatchPress,
    onViewAllPress,
    onFavoritePress,
}: MatchListProps): React.ReactElement {
    const router = useRouter();
    const data = matchesProp ?? [];
    const shimmerX = useShimmer();

    const openMatchesHub = useCallback((): void => {
        if (onViewAllPress) onViewAllPress();
        else router.push('/matches');
    }, [onViewAllPress, router]);

    // Race-condition guard:
    //   showSkeleton  → loading AND no data yet
    //   showData      → has data (show even while background-refreshing)
    //   showEmpty     → confirmed empty after fetch completed
    const showSkeleton = isLoading && data.length === 0;
    const showData = data.length > 0;
    const showEmpty = !isLoading && !showSkeleton && !showData;

    return (
        <View style={styles.section}>
            <SectionHeader
                subtitle="Live & fixtures"
                title="Important matches"
                action="View all"
                onAction={openMatchesHub}
            />
            {showSkeleton ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    scrollEnabled={false}
                >
                    <SkeletonMatchCard shimmerX={shimmerX} />
                    <SkeletonMatchCard shimmerX={shimmerX} />
                </ScrollView>
            ) : showData ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    decelerationRate="fast"
                    snapToInterval={300 + 12}
                    snapToAlignment="start"
                    removeClippedSubviews
                >
                    {data.map((m, i) => (
                        <MatchCard
                            key={m.id}
                            match={m}
                            index={i}
                            onOpenHub={() => (onMatchPress ? onMatchPress(m.id) : openMatchesHub())}
                            onFavoritePress={onFavoritePress}
                        />
                    ))}
                </ScrollView>
            ) : showEmpty ? (
                <EmptySection onAction={openMatchesHub} />
            ) : null}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    section: { marginBottom: 0 },
    scrollContent: { paddingHorizontal: SCREEN_PADDING_H, paddingBottom: 4, gap: 12 },

    // Skeleton
    skeletonCard: {
        width: 300,
        height: 160,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.06)',
        flexShrink: 0,
        overflow: 'hidden',
        padding: 14,
        gap: 12,
        justifyContent: 'space-between',
    },
    shimmerStrip: { position: 'absolute', top: 0, bottom: 0, left: 0 },
    skeletonLine: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4 },
    skeletonTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    skeletonMiddle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    skeletonCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    skeletonScoreBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },

    // Card
    card: {
        width: 300,
        borderRadius: 16,
        backgroundColor: 'rgba(18,12,28,0.98)',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
        flexShrink: 0,
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 0,
    },
    cardLive: {
        shadowColor: PURPLE_PRIMARY,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
        borderColor: 'rgba(124,58,237,0.2)',
    },
    cardStoppage: {
        shadowColor: LIVE_RED,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
        borderColor: 'rgba(239,68,68,0.25)',
    },
    cardPinned: {
        borderColor: 'rgba(251,191,36,0.35)',
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },

    // Top row
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    cardTopLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
    leagueText: {
        color: TEXT_MUTED,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.3,
        flexShrink: 1,
    },
    liveMinuteContainer: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    liveMinuteBorder: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: 'rgba(59,130,246,0.3)',
        backgroundColor: 'rgba(59,130,246,0.06)',
    },
    minuteText: { color: PURPLE_SOFT, fontSize: 11, fontWeight: '700' },
    stoppageInline: { color: LIVE_RED, fontSize: 11, fontWeight: '900' },
    ftBadge: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    ftText: { color: TEXT_MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    kickoffText: { color: PURPLE_SOFT, fontSize: 11, fontWeight: '600' },

    // Teams row
    teamsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 8,
    },
    teamCol: { flex: 1, alignItems: 'center', gap: 8 },
    teamLogoImg: { width: 44, height: 44 },
    teamAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(124,58,237,0.2)',
        borderWidth: 1.5,
        borderColor: 'rgba(167,139,250,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    teamAvatarText: { color: PURPLE_SOFT, fontSize: 12, fontWeight: '800' },
    teamName: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 11.5,
        fontWeight: '600',
        textAlign: 'center',
        maxWidth: 90,
    },

    // Score area
    scoreArea: { alignItems: 'center', justifyContent: 'center', minWidth: 110 },
    vsContainer: { alignItems: 'center', gap: 4 },
    vsText: {
        color: 'rgba(255,255,255,0.25)',
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: 2,
    },
    kickoffLarge: { color: PURPLE_SOFT, fontSize: 13, fontWeight: '600' },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    scoreNum: {
        color: TEXT_PRIMARY,
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: -1,
        lineHeight: 42,
        textShadowColor: 'rgba(255,255,255,0.15)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    scoreSep: { alignItems: 'center', gap: 4 },
    sepMinute: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
    liveBar: { width: 28, height: 2, borderRadius: 1 },

    // Bottom row
    cardBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 10,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    watchlistBtn: { padding: 4 },

    // Empty section — premium liquid glass
    emptyWrap: {
        marginHorizontal: SCREEN_PADDING_H,
    },
    emptyCard: {
        borderRadius: 24,
        overflow: 'hidden',
        paddingVertical: 36,
        paddingHorizontal: 24,
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(167,139,250,0.22)',
        // Ambient shadow — makes the glass card float off the background
        shadowColor: PURPLE_PRIMARY,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: Platform.OS === 'ios' ? 0.25 : 0.4,
        shadowRadius: 20,
        elevation: 10,
        backgroundColor: 'rgba(10,7,18,0.55)',
        gap: 10,
    },
    emptyInnerBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    emptyIconStage: {
        width: 110,
        height: 110,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    emptyIconBox: {
        width: 52,
        height: 52,
        borderRadius: 18,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        shadowColor: PURPLE_PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 6,
    },
    emptySparkle: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(10,7,18,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(245,197,24,0.55)',
    },
    emptyTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.3,
        textAlign: 'center',
        marginTop: 4,
    },
    emptySubtitle: {
        color: 'rgba(255,255,255,0.52)',
        fontSize: 12.5,
        fontWeight: '500',
        lineHeight: 19,
        textAlign: 'center',
        letterSpacing: 0.1,
    },
    emptyCtaOuter: {
        marginTop: 6,
    },
    emptyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(167,139,250,0.45)',
        overflow: 'hidden',
    },
    emptyCtaText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});
