import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    StyleSheet,
    Dimensions,
    type ImageSourcePropType,
    type ImageStyle,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Heart, Film, WifiOff, Flame, Sparkles, Upload } from 'lucide-react-native';
import Animated, {
    useSharedValue,
    withRepeat,
    withTiming,
    useAnimatedStyle,
    Easing,
    withSpring,
    type SharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SectionHeader } from './SectionHeader';
import { FeatureInfoModal as ReelsInfoModal } from '../common/FeatureInfoModal';
import {
    BLUE_ELECTRIC,
    GOLD_PRIMARY,
    PURPLE_SOFT,
    SCREEN_PADDING_H,
} from '../../constants/tokens';
import { useTranslation } from '../../src/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const IMG_NO_VIDEOS = require('../../assets/images/no videos yet.png') as ImageSourcePropType;
const IMG_TRENDING = require('../../assets/images/Treading highlights.png') as ImageSourcePropType;
const IMG_CREATE = require('../../assets/images/create contant.png') as ImageSourcePropType;

type VideoListStyles = {
    section: ViewStyle;
    scrollContent: ViewStyle;
    skeletonCard: ViewStyle;
    skeletonThumb: ViewStyle;
    shimmerClip: ViewStyle;
    shimmerStrip: ViewStyle;
    shimmerGradient: ViewStyle;
    skeletonLine: ViewStyle;
    card: ViewStyle;
    thumbnail: ViewStyle;
    playBtnOuter: ViewStyle;
    playBtnGradientBorder: ViewStyle;
    playBtnInner: ViewStyle;
    offlineChip: ViewStyle;
    offlineChipText: TextStyle;
    statsRow: ViewStyle;
    statsLeft: ViewStyle;
    likeBtn: ViewStyle;
    statText: TextStyle;
    title: TextStyle;
    emptyCard: ViewStyle;
    emptyCardImage: ViewStyle;
    emptyCardImageInner: ImageStyle;
    emptyCardIconWrap: ViewStyle;
    emptyCardTitle: TextStyle;
    emptyCardSub: TextStyle;
    emptyCardCta: ViewStyle;
    emptyCardCtaText: TextStyle;
};

const styles = StyleSheet.create<VideoListStyles>({
    section: { marginBottom: 0 },
    scrollContent: { paddingHorizontal: SCREEN_PADDING_H, paddingBottom: 4, gap: 12 },
    skeletonCard: { width: 155, flexShrink: 0 },
    skeletonThumb: {
        width: 155,
        height: 104,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    shimmerClip: { overflow: 'hidden', borderRadius: 12 },
    shimmerStrip: { ...StyleSheet.absoluteFillObject },
    shimmerGradient: { width: 80, height: '100%' },
    skeletonLine: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4 },
    card: { width: 155, flexShrink: 0 },
    thumbnail: {
        width: 155,
        height: 104,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 0,
    },
    playBtnOuter: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -18,
        marginLeft: -18,
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    playBtnGradientBorder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        padding: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playBtnInner: {
        flex: 1,
        width: '100%',
        borderRadius: 16,
        backgroundColor: 'rgba(59,130,246,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    offlineChip: {
        position: 'absolute',
        top: 6,
        left: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.62)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    offlineChipText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 9,
        fontWeight: '700',
    },
    statsRow: {
        position: 'absolute',
        bottom: 6,
        left: 7,
        right: 7,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statsLeft: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statText: { color: 'rgba(255,255,255,0.82)', fontSize: 9, fontWeight: '700' },
    title: {
        color: 'rgba(255,255,255,0.78)',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 7,
        lineHeight: 15,
        letterSpacing: -0.1,
    },
    emptyCard: {
        width: 155,
        flexShrink: 0,
        borderRadius: 18,
        borderWidth: 1,
        borderStyle: 'dashed',
        paddingVertical: 18,
        paddingHorizontal: 14,
        alignItems: 'center',
        overflow: 'hidden',
        gap: 6,
        minHeight: 196,
        justifyContent: 'space-between',
    },
    emptyCardImage: {
        width: 155,
        height: 220,
        minHeight: 0,
        paddingVertical: 0,
        paddingHorizontal: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        borderRadius: 32,
        overflow: 'hidden',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
    },
    emptyCardImageInner: {
        width: '100%',
        height: '100%',
        borderRadius: 32,
    },
    emptyCardIconWrap: {
        width: 54,
        height: 54,
        borderRadius: 27,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    emptyCardTitle: {
        color: 'rgba(255,255,255,0.92)',
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: -0.2,
        lineHeight: 18,
    },
    emptyCardSub: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: -2,
    },
    emptyCardCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        marginTop: 4,
        alignSelf: 'stretch',
    },
    emptyCardCtaText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});

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

function useReelsInfoModal() {
    const [visible, setVisible] = useState(false);
    const open = useCallback(() => setVisible(true), []);
    const close = useCallback(() => setVisible(false), []);
    return { visible, open, close };
}

function SkeletonVideoCard({ shimmerX }: { shimmerX: SharedValue<number> }): React.ReactElement {
    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shimmerX.value }],
    }));
    return (
        <View style={styles.skeletonCard}>
            <View style={styles.skeletonThumb}>
                <View style={[StyleSheet.absoluteFill, styles.shimmerClip]}>
                    <View style={styles.shimmerStrip}>
                        <Animated.View style={shimmerStyle}>
                            <LinearGradient
                                colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.shimmerGradient}
                            />
                        </Animated.View>
                    </View>
                </View>
            </View>
            <View style={{ gap: 4, marginTop: 6 }}>
                <View style={[styles.skeletonLine, { width: '100%', height: 8 }]} />
                <View style={[styles.skeletonLine, { width: '70%', height: 8 }]} />
            </View>
        </View>
    );
}

interface VideoCardProps {
    video: VideoListItem;
    liked: boolean;
    isOffline: boolean;
    onOpen?: () => void;
    onToggleLike?: (videoId: string) => void;
}

function VideoCard({
    video,
    liked,
    isOffline,
    onOpen,
    onToggleLike,
}: VideoCardProps): React.ReactElement {
    const { t } = useTranslation();
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePress = (): void => {
        if (isOffline) return;
        scale.value = withSpring(0.95, { damping: 15 }, () => {
            scale.value = withSpring(1, { damping: 15 });
        });
        onOpen?.();
    };

    const handleLike = (): void => {
        onToggleLike?.(String(video.id));
    };

    return (
        <Animated.View style={[styles.card, animStyle]}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={handlePress}
                disabled={isOffline}
                accessibilityRole="button"
                accessibilityLabel={video.title}
            >
                <View style={styles.thumbnail}>
                    <Image
                        source={{ uri: video.thumbnail }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.82)']}
                        style={[StyleSheet.absoluteFill, { top: '40%' }]}
                    />
                    <LinearGradient
                        colors={['rgba(0,0,0,0.35)', 'transparent']}
                        style={[StyleSheet.absoluteFill, { bottom: '70%' }]}
                    />

                    {!isOffline && (
                        <View style={styles.playBtnOuter}>
                            <LinearGradient
                                colors={['rgba(59,130,246,0.5)', 'rgba(124,58,237,0.5)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.playBtnGradientBorder}
                            >
                                <View style={styles.playBtnInner}>
                                    <Play size={12} color="#fff" fill="#fff" />
                                </View>
                            </LinearGradient>
                        </View>
                    )}

                    {isOffline && (
                        <View style={styles.offlineChip}>
                            <WifiOff size={10} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
                            <Text style={styles.offlineChipText}>{t.homeExtra.offline}</Text>
                        </View>
                    )}

                    <View style={styles.statsRow}>
                        <View style={styles.statsLeft}>
                            <Play
                                size={8}
                                color="rgba(255,255,255,0.75)"
                                fill="rgba(255,255,255,0.75)"
                            />
                            <Text style={styles.statText}>{video.views}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={handleLike}
                            activeOpacity={0.7}
                            style={styles.likeBtn}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={liked ? 'Unlike' : 'Like'}
                        >
                            <Heart
                                size={9}
                                color={liked ? PURPLE_SOFT : 'rgba(255,255,255,0.72)'}
                                fill={liked ? PURPLE_SOFT : 'none'}
                            />
                            <Text style={[styles.statText, liked && { color: PURPLE_SOFT }]}>
                                {video.likes}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={2}>
                {video.title}
            </Text>
        </Animated.View>
    );
}

interface EmptyReelsCardSpec {
    key: string;
    Icon: typeof Film;
    iconColor: string;
    tintRgba: string;
    borderRgba: string;
    title: string;
    sub: string;
    heroImage?: ImageSourcePropType;
}

function EmptyReelsCard({
    spec,
    onUpload,
    ctaLabel,
}: {
    spec: EmptyReelsCardSpec;
    onUpload: () => void;
    ctaLabel: string;
}): React.ReactElement {
    const { Icon, iconColor, tintRgba, borderRgba, title, sub, heroImage } = spec;

    if (heroImage) {
        return (
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onUpload}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
                style={[styles.emptyCard, styles.emptyCardImage]}
            >
                <Image
                    source={heroImage}
                    resizeMode="contain"
                    style={styles.emptyCardImageInner}
                />
            </TouchableOpacity>
        );
    }

    return (
        <View style={[styles.emptyCard, { borderColor: borderRgba }]}>
            <LinearGradient
                colors={[tintRgba, 'rgba(10,7,18,0.95)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={[styles.emptyCardIconWrap, { backgroundColor: tintRgba, borderColor: borderRgba }]}>
                <Icon size={22} color={iconColor} strokeWidth={2.2} />
            </View>
            <Text style={styles.emptyCardTitle} numberOfLines={2}>
                {title}
            </Text>
            <Text style={styles.emptyCardSub} numberOfLines={1}>
                {sub}
            </Text>
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onUpload}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
                style={[styles.emptyCardCta, { borderColor: borderRgba, backgroundColor: tintRgba }]}
            >
                <Upload size={12} color={iconColor} strokeWidth={2.4} />
                <Text style={[styles.emptyCardCtaText, { color: iconColor }]} numberOfLines={1}>
                    {ctaLabel}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

function EmptySection({ onUpload }: { onUpload: () => void }): React.ReactElement {
    const { t } = useTranslation();

    const cards: EmptyReelsCardSpec[] = [
        {
            key: 'no-videos',
            Icon: Film,
            iconColor: PURPLE_SOFT,
            tintRgba: 'rgba(124,58,237,0.14)',
            borderRgba: 'rgba(124,58,237,0.35)',
            title: t.home.emptyReelsNoVideosTitle,
            sub: t.home.emptyReelsNoVideosSub,
            heroImage: IMG_NO_VIDEOS,
        },
        {
            key: 'trending',
            Icon: Flame,
            iconColor: GOLD_PRIMARY,
            tintRgba: 'rgba(245,197,24,0.12)',
            borderRgba: 'rgba(245,197,24,0.35)',
            title: t.home.emptyReelsTrendingTitle,
            sub: t.home.emptyReelsTrendingSub,
            heroImage: IMG_TRENDING,
        },
        {
            key: 'create',
            Icon: Sparkles,
            iconColor: BLUE_ELECTRIC,
            tintRgba: 'rgba(59,130,246,0.14)',
            borderRgba: 'rgba(59,130,246,0.35)',
            title: t.home.emptyReelsCreateContentTitle,
            sub: t.home.emptyReelsCreateContentSub,
            heroImage: IMG_CREATE,
        },
    ];

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
        >
            {cards.map((spec) => (
                <EmptyReelsCard
                    key={spec.key}
                    spec={spec}
                    onUpload={onUpload}
                    ctaLabel={t.home.emptyReelsCtaUpload}
                />
            ))}
        </ScrollView>
    );
}

export interface VideoListItem {
    id: number | string;
    title: string;
    views: string;
    likes: string;
    thumbnail: string;
}

interface VideoListProps {
    isLoading?: boolean;
    videos?: VideoListItem[];
    isOffline?: boolean;
    likedIds?: Set<string>;
    onVideoPress?: (videoId: string) => void;
    onToggleLike?: (videoId: string) => void;
    onViewAllPress?: () => void;
}

export function VideoList({
    isLoading = false,
    videos,
    isOffline = false,
    likedIds,
    onVideoPress,
    onToggleLike,
    onViewAllPress,
}: VideoListProps): React.ReactElement {
    const router = useRouter();
    const { t } = useTranslation();
    const data = videos ?? [];
    const hasVideos = data.length > 0;
    const shimmerX = useShimmer();
    const reelsInfo = useReelsInfoModal();

    const openReelsHub = (): void => {
        if (isOffline) return;
        if (onViewAllPress) onViewAllPress();
        else router.push('/reels');
    };

    const showSkeleton = isLoading && !hasVideos;
    const showData = hasVideos;
    const showEmpty = !showSkeleton && !showData;

    return (
        <View style={styles.section}>
            <SectionHeader
                subtitle={t.home.sectionReelsSub}
                title={t.home.trendingReels}
                action={t.home.viewAll}
                onTitlePress={reelsInfo.open}
                onAction={reelsInfo.open}
            />

            <ReelsInfoModal
                visible={reelsInfo.visible}
                onClose={reelsInfo.close}
                icon={<Film size={30} color="#d8b4fe" />}
                title={t.trendingReelsInfo.title}
                bullets={[
                    t.trendingReelsInfo.rule1,
                    t.trendingReelsInfo.rule2,
                    t.trendingReelsInfo.rule3,
                    t.trendingReelsInfo.rule4,
                ]}
                hype={t.trendingReelsInfo.hype}
                gotItLabel={t.trendingReelsInfo.gotIt}
            />

            {showSkeleton ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    scrollEnabled={false}
                >
                    <SkeletonVideoCard shimmerX={shimmerX} />
                    <SkeletonVideoCard shimmerX={shimmerX} />
                    <SkeletonVideoCard shimmerX={shimmerX} />
                </ScrollView>
            ) : showData ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    removeClippedSubviews
                >
                    {data.map((v) => (
                        <VideoCard
                            key={String(v.id)}
                            video={v}
                            liked={likedIds?.has(String(v.id)) ?? false}
                            isOffline={isOffline}
                            onOpen={() => onVideoPress?.(String(v.id))}
                            onToggleLike={onToggleLike}
                        />
                    ))}
                </ScrollView>
            ) : showEmpty ? (
                <EmptySection onUpload={openReelsHub} />
            ) : null}
        </View>
    );
}
