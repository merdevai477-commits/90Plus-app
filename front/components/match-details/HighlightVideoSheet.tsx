import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import {
  isDirectHighlightFile,
  resolveHighlightPlaybackUrl,
  youtubeEmbedUrl,
} from '../../utils/highlightPlaybackUrl';

type Props = {
  visible: boolean;
  url: string;
  onClose: () => void;
  closeLabel?: string;
};

/** Plays the clip itself: an MP4 in the native player, or a YouTube embed with no watch page. */
export function HighlightVideoSheet({ visible, url, onClose, closeLabel = 'Close' }: Props) {
  const fileUrl = resolveHighlightPlaybackUrl(url);
  const embedUrl = youtubeEmbedUrl(url) ?? youtubeEmbedUrl(fileUrl);
  const direct = !embedUrl && isDirectHighlightFile(fileUrl);

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
        {visible && embedUrl ? (
          <View style={styles.player}>
            <WebView
              source={{ html: youtubePlayerHtml(embedUrl), baseUrl: 'https://90plus.pro' }}
              style={styles.video}
              originWhitelist={['*']}
              setSupportMultipleWindows={false}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
            />
            <CloseButton onClose={onClose} label={closeLabel} />
          </View>
        ) : null}
        {visible && direct ? (
          <DirectClipPlayer url={fileUrl} onClose={onClose} closeLabel={closeLabel} />
        ) : null}
      </View>
    </Modal>
  );
}

function youtubePlayerHtml(embedUrl: string): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;background:#000;height:100%;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head><body><iframe src="${embedUrl}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`;
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
      <CloseButton onClose={onClose} label={closeLabel} />
    </View>
  );
}

function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <Pressable
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={styles.close}
    >
      <Ionicons name="close" size={22} color="#FFFFFF" />
    </Pressable>
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
