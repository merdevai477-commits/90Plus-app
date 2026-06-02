/**
 * iOS-only: single native AVPlayer for the entire reels feed.
 * Prevents crashes from multiple simultaneous Mux HLS instances in FlatList cells.
 */
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { UnifiedVideoPlayer } from '../common/UnifiedVideoPlayer';
import { captureException } from '../../services/sentry.service';
import type { ReelData } from './types';

type Props = {
  reel: ReelData;
  playerKey: string;
  isActive: boolean;
  onVideoRef: (player: unknown | null, id: string) => void;
};

export function IosReelsVideoOverlay({ reel, playerKey, isActive, onVideoRef }: Props) {
  if (Platform.OS !== 'ios') return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <UnifiedVideoPlayer
        key={playerKey}
        reel={{
          id: reel.id,
          videoUrl: reel.videoUrl,
          thumbnail: reel.thumbnail,
          duration: reel.duration,
          muted: reel.muted,
        }}
        isActive={isActive}
        onVideoRef={onVideoRef}
        onNativeError={(error) => {
          captureException(error, {
            tags: { area: 'reels', platform: 'ios', component: 'IosReelsVideoOverlay' },
            extra: { reelId: reel.id, playerKey },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: '#000',
  },
});
