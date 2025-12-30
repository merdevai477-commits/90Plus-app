import React from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, ImageBackground } from 'react-native';
import { COLORS } from '../reels/constants';
import { Video } from '../../src/store/home.store';
import { Play, Video as VideoIcon, Upload, TrendingUp } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n';
import { LinearGradient } from 'expo-linear-gradient';

interface VideoListProps {
    videos: Video[];
    onVideoPress: (videoId: string) => void;
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

export const VideoList: React.FC<VideoListProps & { onViewAllPress?: () => void }> = ({ videos, onVideoPress, onViewAllPress }) => {
    const { t } = useTranslation();
    
    // If no videos, show placeholder cards
    const hasVideos = videos && videos.length > 0;
    const placeholderData = [{ id: 'empty-1' }, { id: 'empty-2' }, { id: 'empty-3' }];
    
    const renderItem = React.useCallback(({ item, index }: { item: Video | { id: string }; index: number }) => {
        if ('title' in item) {
            return <VideoCard video={item as Video} onPress={() => onVideoPress(item.id)} />;
        }
        return <EmptyVideoCard index={index} onPress={() => onViewAllPress?.()} t={t} />;
    }, [onVideoPress, onViewAllPress, t]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TrendingUp size={20} color={COLORS.neonGreen} />
                    <Text style={styles.title}>{t.home.trendingReels || 'Trending Reels'}</Text>
                </View>
                <TouchableOpacity onPress={onViewAllPress}>
                    <Text style={styles.viewAll}>{t.home.viewAll}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={hasVideos ? videos : placeholderData}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                initialNumToRender={3}
                windowSize={3}
                maxToRenderPerBatch={3}
                removeClippedSubviews={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    viewAll: {
        fontSize: 14,
        color: COLORS.neonGreen,
    },
    listContent: {
        paddingHorizontal: 16,
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
        color: COLORS.neonGreen,
        fontWeight: '600',
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
        fontSize: 12,
        color: COLORS.white,
        fontWeight: '600',
        marginBottom: 4,
    },
});
