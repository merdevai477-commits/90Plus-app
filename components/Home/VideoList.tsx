import React from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, ImageBackground } from 'react-native';
import { COLORS } from '../reels/constants';
import { Video } from '../../src/store/home.store';
import { Play } from 'lucide-react-native';

interface VideoListProps {
    videos: Video[];
    onVideoPress: (videoId: string) => void;
}

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
    const renderItem = React.useCallback(({ item }: { item: Video }) => (
        <VideoCard video={item} onPress={() => onVideoPress(item.id)} />
    ), [onVideoPress]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Trending Reels</Text>
                <TouchableOpacity onPress={onViewAllPress}>
                    <Text style={styles.viewAll}>View All</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={videos}
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
        width: 120, // Reduced width for vertical look
    },
    thumbnail: {
        width: '100%',
        height: 200, // Increased height for vertical look (9:16 aspect ratio approx)
        borderRadius: 12,
        marginBottom: 8,
        overflow: 'hidden',
        justifyContent: 'space-between',
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
