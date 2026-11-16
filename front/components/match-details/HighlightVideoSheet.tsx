import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

const PLAYER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';

/** Plays the clip itself: an MP4 in the native player, or a YouTube player with no watch page. */
export function HighlightVideoSheet({ visible, url, onClose, closeLabel = 'Close' }: Props) {
  const fileUrl = resolveHighlightPlaybackUrl(url);
  const embedUrl = youtubeEmbedUrl(url) ?? youtubeEmbedUrl(fileUrl);
  const direct = !embedUrl && isDirectHighlightFile(fileUrl);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);

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
        {visible && embedUrl && !failed ? (
          <View style={styles.player}>
            <WebView
              source={{
                uri: embedUrl,
                headers: { Referer: 'https://90plus.pro' },
              }}
              style={styles.video}
              userAgent={PLAYER_AGENT}
              originWhitelist={['*']}
              setSupportMultipleWindows={false}
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
              onError={() => setFailed(true)}
              onHttpError={() => setFailed(true)}
            />
            <CloseButton onClose={onClose} label={closeLabel} />
          </View>
        ) : null}
        {visible && direct && !failed ? (
          <DirectClipPlayer url={fileUrl} onClose={onClose} closeLabel={closeLabel} />
        ) : null}
        {visible && (failed || (!embedUrl && !direct)) ? (
          <View style={styles.player}>
            <Text style={styles.error}>تعذر تشغيل الفيديو</Text>
            <CloseButton onClose={onClose} label={closeLabel} />
          </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  error: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
