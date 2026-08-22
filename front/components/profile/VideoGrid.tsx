import React, { memo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { shouldShowDuration } from '../../utils/videoDuration';
import { isValidThumbnail, VIDEO_THUMBNAIL_PLACEHOLDER } from '../../constants/VideoPlaceholder';
const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 2;
const ITEM_SIZE = (width - (SPACING * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

interface VideoItem {
    id: string;
    thumbnail: any;
    views: string;
    duration: string;
    isUploading?: boolean;
    isProcessing?: boolean;
    isFailed?: boolean;
    uploadProgress?: number;
    status?: string;
}

interface VideoGridProps {
    videos: VideoItem[];
    onVideoPress: (video: VideoItem, index: number) => void;
    onVideoLongPress: (video: VideoItem) => void;
    onDeleteVideo: (videoId: string) => void;
    isDeleteMode: boolean;
}

const VideoGrid = memo(function VideoGrid({ videos, onVideoPress, onVideoLongPress, onDeleteVideo, isDeleteMode }: VideoGridProps) {
    return (
        <View style={styles.grid}>
            {videos.map((item, index) => (
                <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    style={styles.itemContainer}
                    onPress={() => {
                        if (isDeleteMode) {
                            onDeleteVideo(item.id);
                        } else {
                            onVideoPress(item, index);
                        }
                    }}
                    onLongPress={() => onVideoLongPress(item)}
                >
                    {isValidThumbnail(typeof item.thumbnail === 'string' ? item.thumbnail : null) ? (
                        <Image
                            source={typeof item.thumbnail === 'string' ? { uri: item.thumbnail } : item.thumbnail}
                            style={styles.thumbnail}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            recyclingKey={item.id}
                        />
                    ) : (
                        <View style={[styles.thumbnail, styles.placeholderContainer]}>
                            <Ionicons name="videocam-outline" size={32} color="#666" />
                            <Text style={styles.placeholderText}>No Preview</Text>
                        </View>
                    )}

                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.overlay}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 0, y: 1 }}
                    >
                        <View style={styles.statsRow}>
                            <Ionicons name="play" size={10} color="#FFF" />
                            <Text style={styles.statsText}>{item.views}</Text>
                        </View>
                        {shouldShowDuration(item.duration) && (
                            <Text style={styles.duration}>{item.duration}</Text>
                        )}
                    </LinearGradient>

                    {item.isUploading && (
                        <View style={styles.uploadingOverlay}>
                            <View style={styles.uploadingContent}>
                                <ActivityIndicator size="small" color={ProfileTheme.colors.neonGreen} />
                                <Text style={styles.uploadingText}>
                                    {item.uploadProgress !== undefined
                                        ? `جاري الرفع ${Math.round(item.uploadProgress)}%`
                                        : 'جاري الرفع...'}
                                </Text>
                            </View>
                            {item.uploadProgress !== undefined && (
                                <View style={styles.progressBarContainer}>
                                    <View style={[styles.progressBar, { width: `${item.uploadProgress}%` }]} />
                                </View>
                            )}
                        </View>
                    )}

                    {!item.isUploading && item.isProcessing && (
                        <View style={styles.uploadingOverlay}>
                            <View style={styles.uploadingContent}>
                                <ActivityIndicator size="small" color="#FFA500" />
                                <Text style={styles.uploadingText}>جاري المعالجة...</Text>
                            </View>
                        </View>
                    )}

                    {!item.isUploading && item.isFailed && (
                        <View style={styles.failedOverlay}>
                            <View style={styles.uploadingContent}>
                                <Ionicons name="alert-circle" size={24} color="#FF4444" />
                                <Text style={styles.failedText}>فشل المعالجة</Text>
                                <Text style={styles.retryText}>اضغط لإعادة المحاولة</Text>
                            </View>
                        </View>
                    )}

                    {isDeleteMode && (
                        <View style={styles.deleteOverlay}>
                            <View style={styles.trashCircle}>
                                <Ionicons name="trash" size={20} color="#FFF" />
                            </View>
                        </View>
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );
});

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingBottom: 100,
        columnGap: SPACING,
    },
    itemContainer: {
        width: ITEM_SIZE,
        height: ITEM_SIZE * 1.5,
        marginBottom: SPACING,
        backgroundColor: ProfileTheme.colors.glassBlack,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statsText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '600',
    },
    duration: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    deleteOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    trashCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    uploadingContent: {
        alignItems: 'center',
        gap: 8,
    },
    uploadingText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
    progressBarContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    progressBar: {
        height: '100%',
        backgroundColor: ProfileTheme.colors.neonGreen,
    },
    failedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    failedText: {
        color: '#FF4444',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
    },
    retryText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        marginTop: 2,
    },
    placeholderContainer: {
        backgroundColor: VIDEO_THUMBNAIL_PLACEHOLDER.backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: '#999',
        fontSize: 10,
        marginTop: 4,
        fontWeight: '500',
    },
});

export default VideoGrid;
