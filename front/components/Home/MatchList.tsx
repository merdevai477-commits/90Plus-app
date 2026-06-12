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
import { Star, CalendarClock, ChevronRight, RotateCw } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n';
import { getTeamDisplayName, getLeagueDisplayName, getLocalizedMatchStatus } from '../../utils/i18nHelpers';
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
    homeTeam?: { name?: string; shortName?: string; score?: number; logo?: string };
    awayTeam?: { name?: string; shortName?: string; score?: number; logo?: string };
    status: MatchStatus;
    minute?: string;
    stoppageTime?: number;
    league: string;
    leagueId?: number;
    leagueCountry?: string;
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
            withTiming(SCREEN_WIDTH, { duration: 1400, easing: Easing.linear }),
            -1,
            false,
        );
    }, []);
    return shimmerX;
}

function SkeletonMatchCard({ shimmerX }: { shimmerX: SharedValue<number> }): React.ReactElement {
    const style = useAnimatedStyle(() => ({
        transform: [{ translateX: shimmerX.value }],
    }));
    return (
        <View style={[styles.skeletonCard, { overflow: 'hidden' }]}>
            <Animated.View style={[styles.shimmerStrip, { width: 80 }, style]} />
            <View style={styles.skeletonTopRow}>
                <View style={[styles.skeletonLine, { width: 72, height: 10 }]} />
                <View style={[styles.skeletonLine, { width: 40, height: 10 }]} />
            </View>
            <View style={styles.skeletonMiddle}>
                <View style={styles.skeletonCircle} />
                <View style={styles.skeletonScoreBlock}>
                    <View style={[styles.skeletonLine, { width: 28, height: 22 }]} />
                    <View style={[styles.skeletonLine, { width: 8, height: 22 }]} />
                </View>
                <View style={styles.skeletonCircle} />
            </View>
        </View>
    );
}

const DEFAULT_TEAM = { name: '', shortName: '?', score: 0, logo: undefined as string | undefined };

function normalizeTeam(team?: MatchListItem['homeTeam']) {
    if (!team) return DEFAULT_TEAM;
    const name = team.name ?? team.shortName ?? '';
    const shortName = team.shortName ?? team.name ?? '?';
    return {
        name,
        shortName,
        score: team.score ?? 0,
        logo: team.logo,
    };
}

function MatchCard({
    match,
    index,
    onOpenHub,
    onFavoritePress,
}: {
    match: MatchListItem;
    index: number;
    onOpenHub: () => void;
    onFavoritePress?: (matchId: string) => void;
}): React.ReactElement {
    const { language, t } = useTranslation();
    const isLive = match.status === 'LIVE' || match.status === '1ST' || match.status === '2ND';
    const isStoppage = match.status === 'HT' && (match.stoppageTime ?? 0) > 0;
    const isFinished = match.status === 'FT';
    const isUpcoming = match.status === 'UPCOMING';

    const { homeTeam: rawHome, awayTeam: rawAway } = match;
    const homeTeam = normalizeTeam(rawHome);
    const awayTeam = normalizeTeam(rawAway);
    const homeLabel = getTeamDisplayName(homeTeam.shortName || homeTeam.name, language);
    const awayLabel = getTeamDisplayName(awayTeam.shortName || awayTeam.name, language);
    const leagueLabel = getLeagueDisplayName(
      match.league,
      language,
      match.leagueId,
      match.leagueCountry,
    );
    const homeLogo = homeTeam.logo;
    const awayLogo = awayTeam.logo;
    const homeInitial = (homeLabel || homeTeam.shortName || '?').charAt(0).toUpperCase();
    const awayInitial = (awayLabel || awayTeam.shortName || '?').charAt(0).toUpperCase();

    const accentColor = isLive
        ? LIVE_RED
        : isStoppage
          ? '#f59e0b'
          : isFinished
            ? 'rgba(255,255,255,0.35)'
            : BLUE_PRIMARY;

    const [starred, setStarred] = React.useState(match.isFavorited ?? false);
    const pinned = match.isPinned ?? false;

    const ftLabel = getLocalizedMatchStatus('FT', language);

    const liveMinute = isLive || isStoppage ? match.minute ?? '' : '';
    const stoppageSuffix =
        isStoppage && match.stoppageTime ? `+${match.stoppageTime}` : '';

    const handleStar = () => {
        if (!onFavoritePress) return;
        const next = !starred;
        setStarred(next);
        onFavoritePress(match.id);
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 45).duration(280)}
            style={[styles.card, isLive && styles.cardLive, isStoppage && styles.cardStoppage, pinned && styles.cardPinned]}
        >
            <TouchableOpacity
                activeOpacity={0.92}
                onPress={onOpenHub}
                accessibilityRole="button"
                accessibilityLabel={`${homeLabel} vs ${awayLabel}`}
                style={styles.cardPressable}
            >
                <LinearGradient
                    colors={[`${accentColor}33`, 'transparent', `${accentColor}22`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />

                <View style={styles.cardTop}>
                    <View style={styles.cardTopLeft}>
                        <Text style={styles.leagueText} numberOfLines={1}>
                            {leagueLabel}
                        </Text>
                    </View>
                    <View style={styles.cardTopRight}>
                        {isLive && (
                            <View style={styles.liveMinuteContainer}>
                                <Text style={styles.minuteText}>
                                    {liveMinute}
                                    {stoppageSuffix}
                                </Text>
                            </View>
                        )}
                        {isUpcoming && match.kickoff ? (
                            <Text style={styles.kickoffText}>{match.kickoff}</Text>
                        ) : isFinished ? (
                            <View style={styles.ftBadge}>
                                <Text style={styles.ftText}>{ftLabel}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <View style={styles.teamsRow}>
                    <View style={styles.teamCol}>
                        <View style={styles.teamLogoWrap}>
                            {homeLogo ? (
                                <Image source={{ uri: homeLogo }} style={styles.teamLogoImg} contentFit="contain" />
                            ) : (
                                <View style={styles.teamAvatar}>
                                    <Text style={styles.teamAvatarText}>{homeInitial}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.teamName} numberOfLines={1}>
                            {homeLabel}
                        </Text>
                    </View>

                    <View style={styles.scoreArea}>
                        {isUpcoming ? (
                            <View style={styles.vsContainer}>
                                <Text style={styles.vsText}>{t.home.vs}</Text>
                            </View>
                        ) : (
                            <View style={styles.scoreRow}>
                                <Text style={styles.scoreNum}>{homeTeam.score}</Text>
                                <View style={styles.scoreSep}>
                                    <Text
                                        style={[
                                            styles.sepMinute,
                                            isLive && styles.sepMinuteLive,
                                            isStoppage && styles.sepMinuteStoppage,
                                        ]}
                                    >
                                        {isLive || isStoppage
                                            ? `${liveMinute}${stoppageSuffix}`
                                            : '–'}
                                    </Text>
                                    {isLive && <View style={[styles.liveBar, styles.liveBarActive]} />}
                                </View>
                                <Text style={styles.scoreNum}>{awayTeam.score}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.teamCol}>
                        <View style={styles.teamLogoWrap}>
                            {awayLogo ? (
                                <Image source={{ uri: awayLogo }} style={styles.teamLogoImg} contentFit="contain" />
                            ) : (
                                <View style={styles.teamAvatar}>
                                    <Text style={styles.teamAvatarText}>{awayInitial}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.teamName} numberOfLines={1}>
                            {awayLabel}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardBottom}>
                    <TouchableOpacity
                        onPress={handleStar}
                        style={styles.watchlistBtn}
                        accessibilityRole="button"
                        accessibilityLabel={starred ? t.home.watchlistRemove : t.home.watchlistAdd}
                    >
                        <Star
                            size={17}
                            color={starred ? GOLD_PRIMARY : 'rgba(255,255,255,0.28)'}
                            fill={starred ? GOLD_PRIMARY : 'transparent'}
                            strokeWidth={starred ? 0 : 2}
                        />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

function OrbitingRing({
    size,
    duration,
    borderColor,
    reverse,
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

function EmptySection({
    onAction,
    onRefresh,
}: {
    onAction?: () => void;
    onRefresh?: () => void;
}): React.ReactElement {
    const { t } = useTranslation();

    const glassProps: any = isLiquidGlassSupported
        ? { effect: 'clear', interactive: false, tint: 'rgba(18,12,28,0.72)' }
        : { intensity: 28, tint: 'dark' };

    const primaryGlass: any = isLiquidGlassSupported
        ? { effect: 'clear', interactive: true, tint: 'rgba(124,58,237,0.28)' }
        : { intensity: 32, tint: 'dark' };

    const secondaryGlass: any = isLiquidGlassSupported
        ? { effect: 'clear', interactive: true, tint: 'rgba(255,255,255,0.06)' }
        : { intensity: 24, tint: 'dark' };

    return (
        <View style={styles.emptyWrap}>
            <View style={styles.emptyCard}>
                {isLiquidGlassSupported ? (
                    <LiquidGlassView {...glassProps} style={StyleSheet.absoluteFill} />
                ) : (
                    <BlurView {...glassProps} style={StyleSheet.absoluteFill} />
                )}

                <LinearGradient
                    colors={['rgba(124,58,237,0.14)', 'rgba(59,130,246,0.06)', 'rgba(8,6,14,0.55)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />
                <View style={styles.emptyInnerBorder} pointerEvents="none" />

                {/* Top strip — mirrors match card header rhythm */}
                <View style={styles.emptyTop}>
                    <View style={styles.emptyStatusPill}>
                        <Text style={styles.emptyStatusText}>{t.homeExtra.emptyMatchesBadge}</Text>
                    </View>
                </View>

                {/* Main body */}
                <View style={styles.emptyBody}>
                    <View style={styles.emptyIconCol}>
                        <View style={styles.emptyIconHalo}>
                            <OrbitingRing size={64} duration={7000} borderColor="rgba(167,139,250,0.35)" />
                            <View style={styles.emptyIconCore}>
                                <LinearGradient
                                    colors={['rgba(124,58,237,0.5)', 'rgba(59,130,246,0.35)']}
                                    style={StyleSheet.absoluteFill}
                                />
                                <CalendarClock size={20} color="#FFFFFF" strokeWidth={2.2} />
                            </View>
                        </View>
                    </View>

                    <View style={styles.emptyTextCol}>
                        <Text style={styles.emptyTitle}>{t.homeExtra.emptyMatchesTitle}</Text>
                        <Text style={styles.emptySubtitle}>{t.homeExtra.emptyMatchesSub}</Text>
                        <Text style={styles.emptyHint}>{t.homeExtra.emptyMatchesHint}</Text>
                    </View>
                </View>

                {/* Footer actions — same row as match card bottom */}
                <View style={styles.emptyFooter}>
                    {onAction ? (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={onAction}
                            style={styles.emptyPrimaryBtn}
                            accessibilityRole="button"
                            accessibilityLabel={t.homeExtra.accessibilityOpenMatches}
                        >
                            {isLiquidGlassSupported ? (
                                <LiquidGlassView {...primaryGlass} style={StyleSheet.absoluteFill} />
                            ) : (
                                <BlurView {...primaryGlass} style={StyleSheet.absoluteFill} />
                            )}
                            <LinearGradient
                                colors={['rgba(124,58,237,0.45)', 'rgba(59,130,246,0.25)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.emptyPrimaryBtnContent}>
                                <Text style={styles.emptyPrimaryBtnText} numberOfLines={1}>
                                    {t.homeExtra.browseAllMatches}
                                </Text>
                                <ChevronRight size={14} color="#FFFFFF" strokeWidth={2.5} />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.emptyPrimaryBtnPlaceholder} />
                    )}

                    {onRefresh ? (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={onRefresh}
                            style={styles.emptySecondaryBtn}
                            accessibilityRole="button"
                            accessibilityLabel={t.homeExtra.accessibilityRefreshMatches}
                        >
                            {isLiquidGlassSupported ? (
                                <LiquidGlassView {...secondaryGlass} style={StyleSheet.absoluteFill} />
                            ) : (
                                <BlurView {...secondaryGlass} style={StyleSheet.absoluteFill} />
                            )}
                            <RotateCw size={16} color="rgba(255,255,255,0.85)" strokeWidth={2.5} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

// ─── Public component ─────────────────────────────────────────────────────────
interface MatchListProps {
    isLoading?: boolean;
    matches?: MatchListItem[];
    worldCupMode?: boolean;
    onMatchPress?: (matchId: string) => void;
    onViewAllPress?: () => void;
    onFavoritePress?: (matchId: string) => void;
    onRefreshPress?: () => void;
}

export function MatchList({
    isLoading = false,
    matches: matchesProp,
    worldCupMode = false,
    onMatchPress,
    onViewAllPress,
    onFavoritePress,
    onRefreshPress,
}: MatchListProps): React.ReactElement {
    const router = useRouter();
    const { t } = useTranslation();
    const data = matchesProp ?? [];
    const shimmerX = useShimmer();

    const openMatchesHub = useCallback((): void => {
        if (onViewAllPress) onViewAllPress();
        else if (worldCupMode) {
            router.push({ pathname: '/(tabs)/matches', params: { filter: 'WorldCup' } });
        } else {
            router.push('/matches');
        }
    }, [onViewAllPress, router, worldCupMode]);

    const showSkeleton = isLoading && data.length === 0;
    const showData = data.length > 0;
    const showEmpty = !isLoading && !showSkeleton && !showData;

    return (
        <View style={styles.section}>
            <SectionHeader
                subtitle={worldCupMode ? t.home.sectionWorldCupSub : t.home.sectionMatchesSub}
                title={worldCupMode ? t.home.worldCupMatches : t.home.importantMatches}
                action={t.home.viewAll}
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
                <EmptySection onAction={openMatchesHub} onRefresh={onRefreshPress} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginBottom: 0 },
    scrollContent: { paddingHorizontal: SCREEN_PADDING_H, paddingBottom: 4, gap: 12 },

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

    card: {
        width: 300,
        height: 160,
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
    cardPressable: { flex: 1, justifyContent: 'space-between' },

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
    cardTopRight: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
    leagueText: {
        color: TEXT_MUTED,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.3,
        flexShrink: 1,
    },
    liveMinuteContainer: {
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
    teamsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        flex: 1,
    },
    teamCol: { flex: 1, alignItems: 'center', gap: 6, minWidth: 0 },
    teamLogoWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    teamLogoImg: { width: 28, height: 28 },
    teamAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(124,58,237,0.15)',
    },
    teamAvatarText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '800' },
    teamName: {
        color: TEXT_PRIMARY,
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        maxWidth: 88,
    },
    scoreArea: { alignItems: 'center', justifyContent: 'center', minWidth: 96 },
    vsContainer: { alignItems: 'center', gap: 4 },
    vsText: {
        color: 'rgba(255,255,255,0.25)',
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: 2,
    },
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
    sepMinute: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.25)' },
    sepMinuteLive: { color: PURPLE_SOFT },
    sepMinuteStoppage: { color: LIVE_RED },
    liveBar: { width: 28, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
    liveBarActive: { backgroundColor: LIVE_RED },
    cardBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 12,
        paddingBottom: 10,
    },
    watchlistBtn: { padding: 4 },
    shimmerStrip: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },

    emptyWrap: {
        marginHorizontal: SCREEN_PADDING_H,
        alignItems: 'center',
    },
    emptyCard: {
        width: 300,
        height: 160,
        borderRadius: 16,
        overflow: 'hidden',
        justifyContent: 'space-between',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(167,139,250,0.22)',
        backgroundColor: 'rgba(12,10,20,0.55)',
        shadowColor: PURPLE_PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: Platform.OS === 'ios' ? 0.22 : 0.32,
        shadowRadius: 12,
        elevation: 8,
    },
    emptyInnerBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    emptyTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 5,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    emptyStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    emptyStatusText: {
        color: TEXT_MUTED,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    emptyBody: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    emptyIconCol: {
        width: 72,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyIconHalo: {
        width: 64,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyIconCore: {
        width: 44,
        height: 44,
        borderRadius: 14,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    emptyTextCol: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingRight: 4,
    },
    emptyTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.2,
        textAlign: 'center',
        lineHeight: 20,
    },
    emptySubtitle: {
        color: 'rgba(255,255,255,0.58)',
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 16,
    },
    emptyHint: {
        marginTop: 4,
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
    },
    emptyFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    emptyPrimaryBtn: {
        flex: 1,
        height: 36,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.35)',
    },
    emptyPrimaryBtnContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 10,
        zIndex: 1,
    },
    emptyPrimaryBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    emptySecondaryBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    emptyPrimaryBtnPlaceholder: {
        flex: 1,
        height: 36,
    },
});