import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS } from '../reels/constants';
import { Video } from '../../src/store/home.store';
import { Play, Upload, TrendingUp } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n';
import { LinearGradient } from 'expo-linear-gradient';
import { Skeleton } from '../ui/Skeleton';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/designSystem/designSystem';

interface VideoListProps {
    videos: Video[];
    onVideoPress: (videoId: string) => void;
    isLoading?: boolean; // Separate loading state
    onViewAllPress?: () => void;
}

// Empty State Placeholder Card
const EmptyVideoCard = React.memo(({ index, onPress, t }: { index: number; onPress: () => void; t: any }) => {
    const messages = [
        { icon: '🎬', text: t?.reels?.noVideosTitle || 'Be the first!', subtext: t?.profile?.uploadVideo || 'Upload a video now' },
        { icon: '🔥', text: t?.home?.trendingReels || 'Trending awaits', subtext: t?.profile?.shareContent || 'Share your talent' },
        { icon: '⭐', text: t?.profile?.createContent || 'Create amazing content', subtext: t?.profile?.getViews || 'Get more views' },
    ];
    const msg = messages[index % messages.length];
    
    return (
        <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.cardContainer}>
            <LinearGradient
                colors={['rgba(34, 197, 94, 0.15)', 'rgba(34, 197, 94, 0.05)']}
                style={styles.emptyThumbnail}
            >
                <View style={styles.emptyOverlay}>
                    <Text style={styles.emptyIcon}>{msg.icon}</Text>
                    <Text style={styles.emptyText}>{msg.text}</Text>
                    <Text style={styles.emptySubtext}>{msg.subtext}</Text>
                    <View style={styles.uploadHint}>
                        <Upload size={14} color={COLORS.neonGreen} />
                        <Text style={styles.uploadHintText}>{t?.profile?.uploadVideo || 'Upload video'}</Text>
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
});

const VideoCard = React.memo(({ video, onPress }: { video: Video; onPress: () => void }) => (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.cardContainer}>
        <ImageBackground
            source={{ uri: video.thumbnail }}
            style={styles.thumbnail}
            imageStyle={{ borderRadius: 12 }}
        >
            <View style={styles.overlay}>
                <View style={styles.playButton}>
                    <Play size={20} color={COLORS.white} fill={COLORS.white} />
                </View>
                <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>{video.views} views</Text>
                    <Text style={styles.statsText}>•</Text>
                    <Text style={styles.statsText}>{video.likes} likes</Text>
                </View>
            </View>
        </ImageBackground>
        <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
    </TouchableOpacity>
));

export const VideoList: React.FC<VideoListProps> = ({ videos, onVideoPress, onViewAllPress, isLoading = false }) => {
    const { t } = useTranslation();
    
    // Separate loading state from empty state
    const hasVideos = videos && videos.length > 0;
    const isEmpty = !isLoading && !hasVideos; // Only empty if not loading and no videos
    
    const placeholderData = [{ id: 'empty-1' }, { id: 'empty-2' }, { id: 'empty-3' }];
    const skeletonData = useMemo(() => Array.from({ length: 3 }, (_, i) => ({ id: `skeleton-${i}` })), []);
    
    const renderItem = React.useCallback(({ item, index }: { item: Video | { id: string }; index: number }) => {
        if ('title' in item) {
            return (
                <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(15)}>
                    <VideoCard video={item as Video} onPress={() => onVideoPress(item.id)} />
                </Animated.View>
            );
        }
        return (
            <Animated.View entering={FadeInDown.delay(index * 50)}>
                <EmptyVideoCard index={index} onPress={() => onViewAllPress?.()} t={t} />
            </Animated.View>
        );
    }, [onVideoPress, onViewAllPress, t]);

    const renderSkeleton = React.useCallback(({ index }: { index: number }) => (
        <Animated.View 
            entering={FadeInDown.delay(index * 50)}
            style={{ marginRight: Spacing.md }}
        >
            <Skeleton width={120} height={200} borderRadius={BorderRadius.md} />
        </Animated.View>
    ), []);

    return (
        <Animated.View entering={FadeInDown.delay(150)} style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TrendingUp size={20} color={Colors.primary[500]} />
                    <Text style={styles.title}>{t.home.trendingReels || 'Trending Reels'}</Text>
                </View>
                {!isLoading && hasVideos && (
                    <TouchableOpacity 
                        onPress={onViewAllPress}
                        accessibilityLabel="View all videos"
                        accessibilityRole="button"
                    >
                        <Text style={styles.viewAll}>{t.home.viewAll}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <FlatList
                    data={skeletonData}
                    renderItem={renderSkeleton}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={{ width: Spacing.md }} />}
                    initialNumToRender={3}
                    windowSize={3}
                    maxToRenderPerBatch={3}
                    removeClippedSubviews={true}
                    getItemLayout={(data, index) => ({
                        length: 120 + Spacing.md,
                        offset: (120 + Spacing.md) * index,
                        index,
                    })}
                />
            ) : hasVideos ? (
                <FlatList
                    data={videos}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={{ width: Spacing.md }} />}
                    initialNumToRender={3}
                    windowSize={3}
                    maxToRenderPerBatch={3}
                    removeClippedSubviews={true}
                    getItemLayout={(data, index) => ({
                        length: 120 + Spacing.md,
                        offset: (120 + Spacing.md) * index,
                        index,
                    })}
                />
            ) : (
                // Empty state - show placeholder cards with encouraging messages
                <FlatList
                    data={placeholderData}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={{ width: Spacing.md }} />}
                    initialNumToRender={3}
                    windowSize={3}
                    maxToRenderPerBatch={3}
                    removeClippedSubviews={true}
                />
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        paddingTop: Spacing.sm,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    title: {
        ...Typography.title.large,
        color: Colors.onSurface.primary,
        fontWeight: Typography.title.large.fontWeight,
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    viewAll: {
        ...Typography.label.medium,
        color: Colors.primary[500],
        fontWeight: Typography.label.medium.fontWeight,
    },
    listContent: {
        paddingHorizontal: Spacing.md,
    },
    cardContainer: {
        width: 120,
    },
    thumbnail: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 8,
        overflow: 'hidden',
        justifyContent: 'space-between',
    },
    emptyThumbnail: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.3)',
        borderStyle: 'dashed',
    },
    emptyOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
    },
    emptyIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.white,
        textAlign: 'center',
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginBottom: 12,
    },
    uploadHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    uploadHintText: {
        fontSize: 10,
        color: Colors.primary[500],
        fontWeight: Typography.label.small.fontWeight,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
        justifyContent: 'space-between',
        padding: 8,
    },
    playButton: {
        alignSelf: 'center',
        marginTop: 'auto',
        marginBottom: 'auto',
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.white,
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    statsText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: '600',
    },
    videoTitle: {
        ...Typography.body.small,
        color: Colors.onSurface.primary,
        fontWeight: Typography.body.small.fontWeight,
        marginBottom: Spacing.xs,
    },
});
