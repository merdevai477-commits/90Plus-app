/**
 * VideoFeed (generic) — vertical video list with auto-play / auto-pause.
 *
 * Not currently used by the reels page (that's handled by reels.tsx +
 * ReelItem + UnifiedVideoPlayer), but exported so any new feature that wants
 * a simple TikTok-style list can reuse it.
 *
 * SDK 55 migration:
 *  - Swapped FlashList v1 API (`estimatedItemSize`) for the v2 API.
 *  - Swapped `expo-av`'s imperative `<Video ref>` for `expo-video`'s
 *    `useVideoPlayer` / `<VideoView>` combo driven through a ref map of
 *    `VideoPlayer` instances.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { FlashList, type ViewToken } from '@shopify/flash-list';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

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
  onVideoView?: (videoId: string) => void;
}

/** Convert a bare URL into a VideoSource with HLS hinting for Mux. */
function toSource(url: string): VideoSource {
  const isHls = url.includes('stream.mux.com') || url.includes('.m3u8');
  return { uri: url, ...(isHls ? { contentType: 'hls' as const } : {}) };
}

/**
 * Optimized vertical video feed.
 *
 * Auto-plays the visible item, pauses others.
 */
export const VideoFeed: React.FC<VideoFeedProps> = React.memo(
  ({ videos, renderOverlay, onEndReached, onRefresh, refreshing = false, onVideoView }) => {
    const [visibleVideoIds, setVisibleVideoIds] = useState<Set<string>>(new Set());
    const videoPlayersRef = useRef<Map<string, any>>(new Map());

    const viewabilityConfig = useRef({
      itemVisiblePercentThreshold: 80,
      minimumViewTime: 500,
    }).current;

    const onViewableItemsChanged = useCallback(
      ({ viewableItems }: { viewableItems: ViewToken<VideoItem>[] }) => {
        const nextVisible = new Set<string>();

        viewableItems.forEach((v) => {
          const item = v.item as VideoItem;
          if (v.isViewable && item?.id) nextVisible.add(item.id);
        });

        // Pause players that are no longer visible.
        visibleVideoIds.forEach((id) => {
          if (!nextVisible.has(id)) {
            const p = videoPlayersRef.current.get(id);
            try {
              p?.pause?.();
            } catch {
              /* ignore */
            }
          }
        });

        // Play newly-visible players.
        nextVisible.forEach((id) => {
          if (!visibleVideoIds.has(id)) {
            const p = videoPlayersRef.current.get(id);
            try {
              p?.play?.();
            } catch {
              /* ignore */
            }
            onVideoView?.(id);
          }
        });

        setVisibleVideoIds(nextVisible);
      },
      [visibleVideoIds, onVideoView],
    );

    // Clean up refs on unmount. expo-video's `useVideoPlayer` does its own
    // lifecycle management so we don't have to release manually.
    useEffect(() => {
      return () => {
        videoPlayersRef.current.clear();
      };
    }, []);

    const renderItem = useCallback(
      ({ item, index }: { item: VideoItem; index: number }) => {
        return (
          <VideoFeedItem
            item={item}
            index={index}
            isVisible={visibleVideoIds.has(item.id)}
            registerPlayer={(player) => {
              if (player) videoPlayersRef.current.set(item.id, player);
              else videoPlayersRef.current.delete(item.id);
            }}
            renderOverlay={renderOverlay}
          />
        );
      },
      [visibleVideoIds, renderOverlay],
    );

    const keyExtractor = useCallback((item: VideoItem) => item.id, []);

    return (
      <FlashList
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  },
);
VideoFeed.displayName = 'VideoFeed';

/**
 * Individual video item. Keeps its own `VideoPlayer` via `useVideoPlayer`
 * so the parent list can drive play/pause through the registered ref.
 */
interface VideoFeedItemProps {
  item: VideoItem;
  index: number;
  isVisible: boolean;
  registerPlayer: (player: any | null) => void;
  renderOverlay?: (item: VideoItem, index: number) => React.ReactElement;
}

const VideoFeedItem: React.FC<VideoFeedItemProps> = React.memo(
  ({ item, isVisible, registerPlayer, renderOverlay, index }) => {
    const player = useVideoPlayer(toSource(item.videoUrl), (p) => {
      p.loop = true;
      p.muted = false;
      if (isVisible) p.play();
    });

    // Publish the player up to the parent.
    useEffect(() => {
      registerPlayer(player);
      return () => registerPlayer(null);
    }, [player, registerPlayer]);

    return (
      <View style={styles.videoContainer}>
        <VideoView style={styles.video} player={player} contentFit="cover" nativeControls={false} />
        {renderOverlay?.(item, index)}
      </View>
    );
  },
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.isVisible === next.isVisible &&
    prev.index === next.index,
);
VideoFeedItem.displayName = 'VideoFeedItem';

const styles = StyleSheet.create({
  videoContainer: {
    height: SCREEN_HEIGHT,
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
});

export default VideoFeed;
