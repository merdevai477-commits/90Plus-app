import React, { useCallback, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { FlashList, ViewToken } from '@shopify/flash-list';
import { Video, ResizeMode } from 'expo-av';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoItem {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  [key: string]: any;
}

interface VideoFeedProps {
  videos: VideoItem[];
  renderOverlay?: (item: VideoItem, index: number) => React.ReactElement;
  onEndReached?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  estimatedItemSize?: number;
  onVideoView?: (videoId: string) => void;
}

/**
 * Optimized video feed component with auto-play/pause
 * Uses FlashList for 10x better performance
 * Only plays visible videos, pauses others
 */
export const VideoFeed: React.FC<VideoFeedProps> = React.memo(({
  videos,
  renderOverlay,
  onEndReached,
  onRefresh,
  refreshing = false,
  estimatedItemSize = SCREEN_HEIGHT,
  onVideoView,
}) => {
  const [visibleVideoIds, setVisibleVideoIds] = useState<Set<string>>(new Set());
  const videoRefs = useRef<Map<string, Video>>(new Map());

  // Viewability config for video auto-play
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80, // Video must be 80% visible
    minimumViewTime: 500, // Must be visible for 500ms
  }).current;

  // Handle viewable items changed
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const newVisibleIds = new Set<string>();

      viewableItems.forEach((viewableItem) => {
        const item = viewableItem.item as VideoItem;
        if (viewableItem.isViewable && item?.id) {
          newVisibleIds.add(item.id);
        }
      });

      // Pause videos that are no longer visible
      visibleVideoIds.forEach((videoId) => {
        if (!newVisibleIds.has(videoId)) {
          const videoRef = videoRefs.current.get(videoId);
          videoRef?.pauseAsync().catch(() => {});
        }
      });

      // Play newly visible videos
      newVisibleIds.forEach((videoId) => {
        if (!visibleVideoIds.has(videoId)) {
          const videoRef = videoRefs.current.get(videoId);
          videoRef?.playAsync().catch(() => {});
          
          // Track video view
          if (onVideoView) {
            onVideoView(videoId);
          }
        }
      });

      setVisibleVideoIds(newVisibleIds);
    },
    [visibleVideoIds, onVideoView]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Pause and unload all videos
      videoRefs.current.forEach((videoRef) => {
        videoRef.pauseAsync().catch(() => {});
        videoRef.unloadAsync().catch(() => {});
      });
      videoRefs.current.clear();
    };
  }, []);

  // Render video item
  const renderItem = useCallback(
    ({ item, index }: { item: VideoItem; index: number }) => {
      const isVisible = visibleVideoIds.has(item.id);

      return (
        <VideoItem
          item={item}
          index={index}
          isVisible={isVisible}
          videoRef={(ref) => {
            if (ref) {
              videoRefs.current.set(item.id, ref);
            } else {
              videoRefs.current.delete(item.id);
            }
          }}
          renderOverlay={renderOverlay}
        />
      );
    },
    [visibleVideoIds, renderOverlay]
  );

  // Key extractor
  const keyExtractor = useCallback((item: VideoItem) => item.id, []);

  return (
    <FlashList
      data={videos}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={estimatedItemSize}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      pagingEnabled
      decelerationRate="fast"
      snapToInterval={estimatedItemSize}
      snapToAlignment="start"
      showsVerticalScrollIndicator={false}
      drawDistance={estimatedItemSize * 2} // Preload 2 videos ahead
      estimatedListSize={{ height: SCREEN_HEIGHT, width: Dimensions.get('window').width }}
    />
  );
});

VideoFeed.displayName = 'VideoFeed';

/**
 * Individual video item component
 * Memoized to prevent unnecessary re-renders
 */
interface VideoItemProps {
  item: VideoItem;
  index: number;
  isVisible: boolean;
  videoRef: (ref: Video | null) => void;
  renderOverlay?: (item: VideoItem, index: number) => React.ReactElement;
}

const VideoItem: React.FC<VideoItemProps> = React.memo(
  ({ item, index, isVisible, videoRef, renderOverlay }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    const handleLoad = useCallback(() => {
      setIsLoading(false);
      setError(false);
    }, []);

    const handleError = useCallback(() => {
      setIsLoading(false);
      setError(true);
      console.error(`[VideoFeed] Failed to load video: ${item.id}`);
    }, [item.id]);

    return (
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: item.videoUrl }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isVisible}
          isLooping
          isMuted={false}
          onLoad={handleLoad}
          onError={handleError}
          usePoster={!!item.thumbnailUrl}
          posterSource={item.thumbnailUrl ? { uri: item.thumbnailUrl } : undefined}
          posterStyle={styles.poster}
        />

        {/* Overlay content (likes, comments, etc.) */}
        {renderOverlay && renderOverlay(item, index)}

        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            {/* Add your loading component here */}
          </View>
        )}

        {/* Error state */}
        {error && (
          <View style={styles.errorContainer}>
            {/* Add your error component here */}
          </View>
        )}
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.isVisible === nextProps.isVisible &&
      prevProps.index === nextProps.index
    );
  }
);

VideoItem.displayName = 'VideoItem';

const styles = StyleSheet.create({
  videoContainer: {
    height: SCREEN_HEIGHT,
    width: '100%',
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  poster: {
    resizeMode: 'cover',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
});

export default VideoFeed;
