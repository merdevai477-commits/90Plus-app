import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { holdHighlightReplay, releaseHighlightReplay } from '../../services/sentry.service';
import {
  isDirectHighlightFile,
  resolveHighlightPlaybackUrl,
  youtubeEmbedUrl,
  youtubeVideoId,
} from '../../utils/highlightPlaybackUrl';

type Props = {
  visible: boolean;
  urls: string[];
  onClose: () => void;
  closeLabel?: string;
};

const PLAYER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';

const GEO_BLOCK_PROBE = `
(function () {
  var blocked = /video unavailable|not made this video available in your country|playback on other websites has been disabled|هذا الفيديو غير متاح|غير متاح في بلدك/i;
  function report() {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('unavailable:' + location.href);
  }
  function pageText(doc) {
    try { return (doc && doc.body && doc.body.innerText) || ''; } catch (e) { return ''; }
  }
  function check() {
    var text = pageText(document);
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) text += ' ' + pageText(frames[i].contentDocument);
    if (blocked.test(text)) report();
  }
  window.addEventListener('message', function (event) {
    var raw = typeof event.data === 'string' ? event.data : JSON.stringify(event.data || '');
    if (/onError|"info":\\s*(100|101|150)/.test(raw)) report();
  });
  setTimeout(check, 800);
  setTimeout(check, 2000);
  setTimeout(check, 4000);
})();
true;
`;

/** Plays the clip itself. A country-blocked YouTube upload is skipped for the next one. */
export function HighlightVideoSheet({ visible, urls, onClose, closeLabel = 'Close' }: Props) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const skippedId = useRef('');
  const listKey = urls.join('|');
  const openKey = visible ? listKey : '';
  const [seenKey, setSeenKey] = useState(openKey);
  if (seenKey !== openKey) {
    skippedId.current = '';
    setSeenKey(openKey);
    setIndex(0);
    setFailed(false);
  }

  useEffect(() => {
    if (!visible) {
      setSurfaceReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      await holdHighlightReplay();
      if (!cancelled) setSurfaceReady(true);
    })();
    return () => {
      cancelled = true;
      setSurfaceReady(false);
      releaseHighlightReplay();
    };
  }, [visible]);

  const url = urls[index] ?? '';
  const fileUrl = resolveHighlightPlaybackUrl(url);
  const embedUrl = url ? youtubeEmbedUrl(url) ?? youtubeEmbedUrl(fileUrl) : null;
  const direct = Boolean(url) && !embedUrl && isDirectHighlightFile(fileUrl);
  const videoId = url ? youtubeVideoId(url) : null;
  const showSurface = visible && surfaceReady;

  const skipBlocked = () => {
    if (videoId && skippedId.current === videoId) return;
    if (videoId) skippedId.current = videoId;
    if (index + 1 < urls.length) setIndex((current) => current + 1);
    else setFailed(true);
  };

  return (
    <Modal
      visible={visible && urls.length > 0}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={closeLabel} />
        {showSurface && embedUrl && !failed ? (
          <View style={styles.player}>
            <View pointerEvents="none" style={styles.playerPlate} />
            <WebView
              key={`${listKey}:${embedUrl}`}
              source={{
                uri: embedUrl,
                headers: { Referer: 'https://90plus.pro' },
              }}
              style={[styles.video, Platform.OS === 'ios' && styles.videoIos]}
              userAgent={PLAYER_AGENT}
              originWhitelist={['*']}
              setSupportMultipleWindows={false}
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo={Platform.OS !== 'ios'}
              javaScriptEnabled
              domStorageEnabled
              injectedJavaScript={GEO_BLOCK_PROBE}
              onMessage={(event) => {
                const data = event.nativeEvent.data || '';
                if (!data.startsWith('unavailable:')) return;
                if (videoId && !data.includes(videoId)) return;
                skipBlocked();
              }}
              onHttpError={(event) => {
                if (event.nativeEvent.statusCode >= 400) skipBlocked();
              }}
            />
            <CloseButton onClose={onClose} label={closeLabel} />
          </View>
        ) : null}
        {showSurface && direct && !failed ? (
          <DirectClipPlayer
            key={fileUrl}
            url={fileUrl}
            onClose={onClose}
            closeLabel={closeLabel}
            onFailed={skipBlocked}
          />
        ) : null}
        {visible && (failed || (Boolean(url) && !embedUrl && !direct)) ? (
          <View style={styles.player}>
            <View pointerEvents="none" style={styles.playerPlate} />
            <Text style={styles.error}>الفيديو مش متاح في البلد دي</Text>
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
  onFailed,
}: {
  url: string;
  onClose: () => void;
  closeLabel: string;
  onFailed: () => void;
}) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });
  const reported = useRef(false);

  useEffect(() => {
    if (status !== 'error' || reported.current) return;
    reported.current = true;
    onFailed();
  }, [status, onFailed]);

  useEffect(() => {
    const attempt = () => {
      try {
        if (player.status === 'error') return;
        if (player.status !== 'readyToPlay') {
          if (player.playing) player.pause();
          return;
        }
        if (!player.playing) player.play();
      } catch {
        /* player may already be released */
      }
    };
    attempt();
    const delays = Platform.OS === 'ios' ? [150, 400, 900] : [200];
    const timers = delays.map((ms) => setTimeout(attempt, ms));
    return () => {
      timers.forEach(clearTimeout);
      try {
        if (player.playing) player.pause();
      } catch {
        /* player may already be released */
      }
    };
  }, [player, status]);

  return (
    <View style={styles.player}>
      <View pointerEvents="none" style={styles.playerPlate} />
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
        fullscreenOptions={Platform.OS === 'ios' ? { enable: false } : undefined}
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  playerPlate: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  videoIos: {
    opacity: 0.99,
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
    zIndex: 2,
  },
});
