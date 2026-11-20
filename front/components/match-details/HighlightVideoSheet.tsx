import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { holdHighlightReplay, releaseHighlightReplay } from '../../services/sentry.service';
import { useTranslation } from '../../src/i18n';
import {
  classifyYouTubeProbeSignal,
  pickFinalPlaybackReason,
  playbackErrorMessageKey,
  type PlaybackFailureReason,
} from '../../utils/highlightPlaybackErrors';
import { preflightDirectMp4 } from '../../utils/highlightMp4Preflight';
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

/** Reports typed reasons — geo only when country/region evidence is present. */
const PLAYBACK_PROBE = `
(function () {
  function send(reason, href) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage('reason:' + reason + ':' + (href || location.href));
    }
  }
  function pageText(doc) {
    try { return (doc && doc.body && doc.body.innerText) || ''; } catch (e) { return ''; }
  }
  function check() {
    var text = pageText(document);
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) text += ' ' + pageText(frames[i].contentDocument);
    if (/playback on other websites has been disabled/i.test(text)) {
      send('EMBED_UNAVAILABLE', location.href);
      return;
    }
    if (/not made this video available in your country|unavailable in your country|isn't available in your country|is not available in your country|غير متاح في بلدك|غير متاح في بلدكم/i.test(text)) {
      send('GEO_RESTRICTED', location.href);
      return;
    }
    if (/video unavailable/i.test(text) && /country|region|بلد/i.test(text)) {
      send('GEO_RESTRICTED', location.href);
      return;
    }
  }
  window.addEventListener('message', function (event) {
    var raw = typeof event.data === 'string' ? event.data : JSON.stringify(event.data || '');
    var info = raw.match(/"info"\\s*:\\s*(100|101|150)/);
    if (info) {
      var code = info[1];
      if (code === '100') send('SOURCE_NOT_FOUND', location.href);
      else send('EMBED_UNAVAILABLE', location.href);
      return;
    }
    if (/onError/.test(raw) && /150|101/.test(raw)) send('EMBED_UNAVAILABLE', location.href);
    else if (/onError/.test(raw) && /100/.test(raw)) send('SOURCE_NOT_FOUND', location.href);
  });
  setTimeout(check, 800);
  setTimeout(check, 2000);
  setTimeout(check, 4000);
})();
true;
`;

const FALLBACK_MESSAGES: Record<string, string> = {
  playbackGeoRestricted: 'This video is unavailable in your region.',
  playbackSourceUnavailable: 'This video is currently unavailable.',
  playbackSourceExpired: 'This video is currently unavailable.',
  playbackUnsupportedProvider: 'This video source is not supported.',
  playbackNetworkError: 'Unable to load the video. Please try again.',
  playbackPlayerFailed: 'Unable to play this video.',
  playbackEmbedUnavailable: 'This video cannot play inside the app.',
  playbackTimeout: 'Unable to load the video. Please try again.',
  playbackUnknownError: 'Something went wrong. Please try again.',
  openInYouTube: 'Open in YouTube',
};

/** Plays highlight / goal clips with typed failures and URL fallback. */
export function HighlightVideoSheet({ visible, urls, onClose, closeLabel = 'Close' }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<PlaybackFailureReason | null>(null);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const [directReady, setDirectReady] = useState(false);
  const skippedId = useRef('');
  const attempted = useRef<string[]>([]);
  const failureReasons = useRef<PlaybackFailureReason[]>([]);
  const listKey = urls.join('|');
  const openKey = visible ? listKey : '';
  const [seenKey, setSeenKey] = useState(openKey);
  if (seenKey !== openKey) {
    skippedId.current = '';
    attempted.current = [];
    failureReasons.current = [];
    setSeenKey(openKey);
    setIndex(0);
    setFailed(false);
    setFailureReason(null);
    setDirectReady(false);
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
  const unsupported = Boolean(url) && !embedUrl && !direct;

  const matchDetailsText = t.matchDetails as unknown as Record<string, string | undefined>;

  const messageFor = useCallback(
    (reason: PlaybackFailureReason) => {
      const key = playbackErrorMessageKey(reason);
      const fromLocale = matchDetailsText[key];
      return fromLocale || FALLBACK_MESSAGES[key] || FALLBACK_MESSAGES.playbackUnknownError;
    },
    [matchDetailsText],
  );

  const finishWithReasons = useCallback(() => {
    const finalReason = pickFinalPlaybackReason(failureReasons.current);
    setFailureReason(finalReason);
    setFailed(true);
    setDirectReady(false);
  }, []);

  const skipWithReason = useCallback(
    (reason: PlaybackFailureReason) => {
      if (!url) {
        failureReasons.current.push(reason);
        finishWithReasons();
        return;
      }
      // Never retry the same candidate in one sheet session.
      if (attempted.current.includes(url)) return;
      if (videoId && skippedId.current === videoId) return;
      if (videoId) skippedId.current = videoId;
      attempted.current.push(url);
      failureReasons.current.push(reason);
      if (index + 1 < urls.length) {
        setDirectReady(false);
        setIndex((current) => current + 1);
      } else {
        finishWithReasons();
      }
    },
    [finishWithReasons, index, url, urls.length, videoId],
  );

  // Unsupported hosts: advance with typed reason (never show geo).
  useEffect(() => {
    if (!visible || failed || !unsupported) return;
    skipWithReason('UNSUPPORTED_PROVIDER');
  }, [visible, failed, unsupported, index, skipWithReason]);

  // MP4 Range preflight before mounting native player.
  useEffect(() => {
    if (!visible || failed || !direct || !fileUrl) {
      setDirectReady(false);
      return;
    }
    let cancelled = false;
    setDirectReady(false);
    void preflightDirectMp4(fileUrl).then((result) => {
      if (cancelled) return;
      if (result.ok === true) {
        setDirectReady(true);
        return;
      }
      skipWithReason(result.reason);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, failed, direct, fileUrl, index, skipWithReason]);

  const openInYouTubeLabel = matchDetailsText.openInYouTube || FALLBACK_MESSAGES.openInYouTube;

  const lastYouTubeUrl = [...attempted.current].reverse().find((candidate) => youtubeVideoId(candidate))
    || (videoId ? url : '');

  const showOpenInYouTube =
    failed &&
    failureReason === 'EMBED_UNAVAILABLE' &&
    Boolean(lastYouTubeUrl && youtubeVideoId(lastYouTubeUrl));

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
              injectedJavaScript={PLAYBACK_PROBE}
              onMessage={(event) => {
                const data = event.nativeEvent.data || '';
                const reason = classifyYouTubeProbeSignal(data);
                if (!reason) return;
                if (videoId && !data.includes(videoId) && !data.includes(embedUrl)) return;
                skipWithReason(reason);
              }}
              onHttpError={(event) => {
                const status = event.nativeEvent.statusCode;
                if (status < 400) return;
                if (status === 404) skipWithReason('SOURCE_NOT_FOUND');
                else if (status === 410) skipWithReason('SOURCE_EXPIRED');
                else if (status >= 500) skipWithReason('NETWORK_ERROR');
                else skipWithReason('UNKNOWN_ERROR');
              }}
            />
            <CloseButton onClose={onClose} label={closeLabel} />
          </View>
        ) : null}
        {showSurface && direct && directReady && !failed ? (
          <DirectClipPlayer
            key={fileUrl}
            url={fileUrl}
            onClose={onClose}
            closeLabel={closeLabel}
            onFailed={() => skipWithReason('PLAYER_INITIALIZATION_FAILED')}
          />
        ) : null}
        {visible && failed ? (
          <View style={styles.player}>
            <View pointerEvents="none" style={styles.playerPlate} />
            <Text style={styles.error}>
              {messageFor(failureReason ?? 'UNKNOWN_ERROR')}
            </Text>
            {showOpenInYouTube ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={openInYouTubeLabel}
                onPress={() => {
                  const watch = lastYouTubeUrl.includes('youtube') || lastYouTubeUrl.includes('youtu.be')
                    ? lastYouTubeUrl
                    : `https://www.youtube.com/watch?v=${youtubeVideoId(lastYouTubeUrl)}`;
                  void Linking.openURL(watch);
                }}
                style={styles.openYoutube}
              >
                <Text style={styles.openYoutubeText}>{openInYouTubeLabel}</Text>
              </Pressable>
            ) : null}
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
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  openYoutube: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  openYoutubeText: {
    color: '#FFFFFF',
    fontSize: 14,
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
