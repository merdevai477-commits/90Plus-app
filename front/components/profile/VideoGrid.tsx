import React, { memo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { GlassWrapper, glassProps } from '../../constants/ui';
import { isLiquidGlassSupported } from '../../utils/liquidGlassSafe';
import { shouldShowDuration } from '../../utils/videoDuration';
import { isValidThumbnail, VIDEO_THUMBNAIL_PLACEHOLDER } from '../../constants/VideoPlaceholder';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 6;
const GRID_PAD = 8;

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
    onAddPress?: () => void;
    addLabel?: string;
    /** Outer panel horizontal margin so tiles fit the content area. */
    horizontalInset?: number;
}

function computeItemSize(horizontalInset: number) {
    const usable = SCREEN_WIDTH - horizontalInset * 2 - GRID_PAD * 2 - SPACING * (COLUMN_COUNT - 1);
    return Math.floor(usable / COLUMN_COUNT);
}

function AddReelTile({
    onPress,
    label,
    size,
}: {
    onPress: () => void;
    label: string;
    size: number;
}) {
    const GlassChip = isLiquidGlassSupported ? GlassWrapper : BlurView;
    const chipProps = isLiquidGlassSupported
        ? { ...glassProps.chip, interactive: true }
        : glassProps.chip;

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.itemContainer, { width: size, height: Math.round(size * 1.28) }]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <LinearGradient
                colors={['rgba(23,13,43,0.55)', 'rgba(32,13,68,0.45)']}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.addInnerBorder} pointerEvents="none" />
            <View style={styles.addContent}>
                <View style={styles.addGlassBtn}>
                    <GlassChip {...(chipProps as any)} style={StyleSheet.absoluteFill} />
                    <View style={styles.addGlassRing} pointerEvents="none" />
                    <Ionicons name="add" size={20} color={ProfileTheme.colors.avatarRing} />
                </View>
                <Text style={styles.addLabel}>{label}</Text>
            </View>
        </TouchableOpacity>
    );
}

const VideoGrid = memo(function VideoGrid({
    videos,
    onVideoPress,
    onVideoLongPress,
    onDeleteVideo,
    isDeleteMode,
    onAddPress,
    addLabel = 'Add',
    horizontalInset = 0,
}: VideoGridProps) {
    const itemSize = computeItemSize(horizontalInset);
    const itemHeight = Math.round(itemSize * 1.28);

    return (
        <View style={styles.grid}>
            {onAddPress && !isDeleteMode ? (
                <AddReelTile onPress={onAddPress} label={addLabel} size={itemSize} />
            ) : null}
            {videos.map((item, index) => (
                <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    style={[styles.itemContainer, { width: itemSize, height: itemHeight }]}
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
        paddingBottom: 24,
        paddingHorizontal: GRID_PAD,
        paddingTop: 12,
        columnGap: SPACING,
        rowGap: SPACING,
    },
    itemContainer: {
        borderRadius: 8,
        overflow: 'hidden',
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
    addInnerBorder: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 0.5,
        borderColor: ProfileTheme.colors.profileCardBorder,
        borderRadius: 2,
    },
    addContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 6,
    },
    addGlassBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    addGlassRing: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.45)',
        backgroundColor: 'rgba(139,92,246,0.12)',
    },
    addLabel: {
        color: ProfileTheme.colors.avatarRing,
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
});

export default VideoGrid;
