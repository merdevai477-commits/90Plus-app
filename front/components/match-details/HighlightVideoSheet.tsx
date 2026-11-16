import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { isDirectHighlightFile, resolveHighlightPlaybackUrl } from '../../utils/highlightPlaybackUrl';

type Props = {
  visible: boolean;
  url: string;
  onClose: () => void;
  closeLabel?: string;
};

/** Plays the clip file itself. The host page's share buttons and recommendations stay out. */
export function HighlightVideoSheet({ visible, url, onClose, closeLabel = 'Close' }: Props) {
  const playbackUrl = resolveHighlightPlaybackUrl(url);
  const canPlayFile = isDirectHighlightFile(playbackUrl);

  return (
    <Modal
      visible={visible && Boolean(url)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={closeLabel} />
        {visible && canPlayFile ? (
          <DirectClipPlayer url={playbackUrl} onClose={onClose} closeLabel={closeLabel} />
        ) : null}
      </View>
    </Modal>
  );
}

function DirectClipPlayer({
  url,
  onClose,
  closeLabel,
}: {
  url: string;
  onClose: () => void;
  closeLabel: string;
}) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
    instance.play();
  });

  return (
    <View style={styles.player}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
        allowsFullscreen
      />
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        hitSlop={12}
        style={styles.close}
      >
        <Ionicons name="close" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  player: {
    marginHorizontal: 12,
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});
