import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { holdHighlightReplay, releaseHighlightReplay } from '../../services/sentry.service';
import { useTranslation } from '../../src/i18n';
import {
  classifyYouTubeProbeSignal,
  isYouTubePlayerReadySignal,
  isYouTubePlayingSignal,
  pickFinalPlaybackReason,
  playbackErrorMessageKey,
  type PlaybackFailureReason,
} from '../../utils/highlightPlaybackErrors';
import {
  buildHighlightVideoSource,
  classifyHighlightSourceType,
  createHighlightPlaybackSessionId,
  emitHighlightPlaybackDiagnostic,
  highlightUiPhaseForFailure,
  HIGHLIGHT_PLAYBACK_TIMEOUTS,
  inferHighlightProvider,
  isRecoverablePlaybackFailure,
  resolveTimeoutReason,
  sanitizePlaybackUrlForDiagnostics,
  youtubeAllowsFullscreenVideo,
  youtubeWebViewUserAgent,
  type HighlightUiPhase,
} from '../../utils/highlightPlaybackLifecycle';
import { preflightDirectMp4 } from '../../utils/highlightMp4Preflight';
import {
  isDirectHighlightFile,
  resolveHighlightPlaybackUrl,
  streaminPlaybackCandidates,
  youtubeEmbedDocument,
  youtubeEmbedUrl,
  youtubeHostedPlayerUrl,
  youtubeMobileWatchUrl,
  youtubeVideoId,
} from '../../utils/highlightPlaybackUrl';

/** In-app YouTube surfaces, tried in order on iPhone before external Linking. */
type YoutubeSurfaceTier = 'hosted' | 'html' | 'watch';

type Props = {
  visible: boolean;
  urls: string[];
  onClose: () => void;
  closeLabel?: string;
};

/**
 * Secondary DOM probe for YouTube error banners inside the iframe wrapper.
 * Must include video id so RN does not drop the message (location is 90plus.pro).
 */
const PLAYBACK_PROBE = `
(function () {
  function send(reason) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage('reason:' + reason + ':' + (window.__HL_VID || '') + ':' + location.href);
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
      send('EMBED_UNAVAILABLE');
      return;
    }
    if (/not made this video available in your country|unavailable in your country|isn't available in your country|is not available in your country|غير متاح في بلدك|غير متاح في بلدكم/i.test(text)) {
      send('EMBED_UNAVAILABLE');
      return;
    }
    if (/video unavailable/i.test(text) && /country|region|بلد/i.test(text)) {
      send('EMBED_UNAVAILABLE');
    }
  }
  window.addEventListener('message', function (event) {
    var raw = typeof event.data === 'string' ? event.data : JSON.stringify(event.data || '');
    var info = raw.match(/"info"\\s*:\\s*(100|101|150)/);
    if (info) {
      var code = info[1];
      if (code === '100') send('SOURCE_NOT_FOUND');
      else send('EMBED_UNAVAILABLE');
      return;
    }
    if (/onError/.test(raw) && /150|101/.test(raw)) send('EMBED_UNAVAILABLE');
    else if (/onError/.test(raw) && /100/.test(raw)) send('SOURCE_NOT_FOUND');
  });
  setTimeout(check, 800);
  setTimeout(check, 2000);
  setTimeout(check, 4500);
})();
true;
`;

const FALLBACK_MESSAGES: Record<string, string> = {
  playbackGeoRestricted: 'This video cannot play inside the app — open it in YouTube.',
  playbackSourceUnavailable: 'This video is currently unavailable.',
  playbackSourceExpired: 'This video is currently unavailable.',
  playbackUnsupportedProvider: 'This video source is not supported.',
  playbackNetworkError: 'Unable to load the video. Please try again.',
  playbackPlayerFailed: 'Unable to play this video.',
  playbackEmbedUnavailable: 'This video cannot play inside the app — open it in YouTube.',
  playbackTimeout: 'Unable to load the video. Please try again.',
  playbackUnknownError: 'Something went wrong. Please try again.',
  openInYouTube: 'Open in YouTube',
  playbackLoading: 'Loading video…',
  playbackInitializing: 'Preparing player…',
  playbackRetry: 'Retry',
};

function resetSessionRefs(refs: {
  skippedId: { current: string };
  attempted: { current: string[] };
  failureReasons: { current: PlaybackFailureReason[] };
}) {
  refs.skippedId.current = '';
  refs.attempted.current = [];
  refs.failureReasons.current = [];
}

/** Plays highlight / goal clips with typed failures, timeouts, and URL fallback. */
export function HighlightVideoSheet({ visible, urls, onClose, closeLabel = 'Close' }: Props) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const playerWidth = Math.max(280, screenWidth - 48);
  const playerHeight = Math.round(playerWidth * 9 / 16);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<PlaybackFailureReason | null>(null);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const [directReady, setDirectReady] = useState(false);
  const [playableDirectUrl, setPlayableDirectUrl] = useState('');
  const [uiPhase, setUiPhase] = useState<HighlightUiPhase>('idle');
  const [sessionNonce, setSessionNonce] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [youtubeLoaded, setYoutubeLoaded] = useState(false);
  const [youtubeTier, setYoutubeTier] = useState<YoutubeSurfaceTier>('hosted');

  const skippedId = useRef('');
  const attempted = useRef<string[]>([]);
  const failureReasons = useRef<PlaybackFailureReason[]>([]);
  const sessionId = useRef(createHighlightPlaybackSessionId());
  const sessionStartedAt = useRef(Date.now());
  const listKey = urls.join('|');
  const openKey = visible ? `${listKey}#${sessionNonce}` : '';
  const [seenKey, setSeenKey] = useState(openKey);

  if (seenKey !== openKey) {
    resetSessionRefs({ skippedId, attempted, failureReasons });
    if (visible) {
      sessionId.current = createHighlightPlaybackSessionId();
      sessionStartedAt.current = Date.now();
    }
    setSeenKey(openKey);
    setIndex(0);
    setFailed(false);
    setFailureReason(null);
    setDirectReady(false);
    setPlayableDirectUrl('');
    setYoutubeLoaded(false);
    setYoutubeTier('hosted');
    setUiPhase(visible ? 'initializing' : 'idle');
  }

  const firstCandidateUrl = urls[0] ?? '';

  useEffect(() => {
    if (!visible) {
      setSurfaceReady(false);
      setUiPhase('idle');
      emitHighlightPlaybackDiagnostic({
        sessionId: sessionId.current,
        stage: 'PLAYER_DISPOSED',
        retryCount,
      });
      return;
    }
    // Mount the surface on the same turn as the tap. Waiting on async work
    // (even a no-op) drops iOS user-activation and blocks YouTube autoplay.
    setUiPhase('loading');
    setSurfaceReady(true);
    emitHighlightPlaybackDiagnostic({
      sessionId: sessionId.current,
      stage: 'VIDEO_REQUESTED',
      sourceType: classifyHighlightSourceType(firstCandidateUrl),
      provider: inferHighlightProvider(firstCandidateUrl),
      sourceHost: sanitizePlaybackUrlForDiagnostics(firstCandidateUrl),
      retryCount,
    });
    void holdHighlightReplay();
    return () => {
      setSurfaceReady(false);
      releaseHighlightReplay();
    };
  }, [visible, sessionNonce, listKey, firstCandidateUrl, retryCount]);

  const url = urls[index] ?? '';
  const fileUrl = resolveHighlightPlaybackUrl(url);
  const embedUrl = url ? youtubeEmbedUrl(url) ?? youtubeEmbedUrl(fileUrl) : null;
  const direct = Boolean(url) && !embedUrl && isDirectHighlightFile(fileUrl);
  const videoId = url ? youtubeVideoId(url) : null;
  const hostedPlayerUrl = videoId ? youtubeHostedPlayerUrl(videoId) : null;
  const mobileWatchUrl = videoId ? youtubeMobileWatchUrl(videoId) : null;
  const showSurface = visible && surfaceReady;
  const unsupported = Boolean(url) && !embedUrl && !direct;
  const sourceType = classifyHighlightSourceType(fileUrl || url);
  const youtubeWebSource =
    embedUrl && videoId
      ? youtubeTier === 'hosted' && hostedPlayerUrl
        ? { uri: hostedPlayerUrl }
        : youtubeTier === 'watch' && mobileWatchUrl
          ? { uri: mobileWatchUrl }
          : {
              html: youtubeEmbedDocument(videoId, { requireTap: Platform.OS === 'ios' }),
              baseUrl: 'https://90plus.pro',
            }
      : null;

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
    setUiPhase(highlightUiPhaseForFailure(finalReason));
    emitHighlightPlaybackDiagnostic({
      sessionId: sessionId.current,
      stage: 'PLAYBACK_ERROR',
      errorCategory: finalReason,
      sourceType,
      provider: inferHighlightProvider(url || fileUrl),
      sourceHost: sanitizePlaybackUrlForDiagnostics(url || fileUrl),
      retryCount,
      initMs: Date.now() - sessionStartedAt.current,
    });
  }, [fileUrl, retryCount, sourceType, url]);

  const skipWithReason = useCallback(
    (reason: PlaybackFailureReason) => {
      if (!url) {
        failureReasons.current.push(reason);
        finishWithReasons();
        return;
      }

      // Exhaust YouTube in-app surfaces before leaving this candidate URL.
      const youtubeRecoverable =
        Boolean(videoId) &&
        (reason === 'PLAYBACK_TIMEOUT' ||
          reason === 'EMBED_UNAVAILABLE' ||
          reason === 'GEO_RESTRICTED' ||
          reason === 'NETWORK_ERROR' ||
          reason === 'UNKNOWN_ERROR');
      if (youtubeRecoverable) {
        if (youtubeTier === 'hosted') {
          setYoutubeLoaded(false);
          setYoutubeTier('html');
          setUiPhase('loading');
          return;
        }
        if (youtubeTier === 'html') {
          setYoutubeLoaded(false);
          setYoutubeTier('watch');
          setUiPhase('loading');
          return;
        }
      }

      if (attempted.current.includes(url)) return;
      if (videoId && skippedId.current === videoId) return;
      if (videoId) skippedId.current = videoId;
      attempted.current.push(url);
      failureReasons.current.push(reason);
      emitHighlightPlaybackDiagnostic({
        sessionId: sessionId.current,
        stage: reason === 'PLAYBACK_TIMEOUT' ? 'PLAYER_TIMEOUT' : 'PLAYBACK_ERROR',
        errorCategory: reason,
        sourceType,
        provider: inferHighlightProvider(url),
        sourceHost: sanitizePlaybackUrlForDiagnostics(url),
        retryCount,
      });
      if (index + 1 < urls.length) {
        setDirectReady(false);
        setYoutubeLoaded(false);
        setYoutubeTier('hosted');
        setUiPhase('loading');
        setIndex((current) => current + 1);
      } else {
        finishWithReasons();
      }
    },
    [finishWithReasons, index, retryCount, sourceType, url, urls.length, videoId, youtubeTier],
  );

  // Unsupported hosts: advance with typed reason (never show geo).
  useEffect(() => {
    if (!visible || failed || !unsupported) return;
    skipWithReason('UNSUPPORTED_PROVIDER');
  }, [visible, failed, unsupported, index, skipWithReason]);

  // MP4/HLS Range preflight before mounting native player.
  useEffect(() => {
    if (!visible || failed || !direct || !fileUrl) {
      setDirectReady(false);
      return;
    }
    let cancelled = false;
    setDirectReady(false);
    setPlayableDirectUrl('');
    setUiPhase('loading');
    const targets = streaminPlaybackCandidates(url);
    const urlsToTry = targets.length ? targets : [fileUrl];
    emitHighlightPlaybackDiagnostic({
      sessionId: sessionId.current,
      stage: 'PLAYER_INITIALIZING',
      sourceType,
      provider: inferHighlightProvider(urlsToTry[0]),
      sourceHost: sanitizePlaybackUrlForDiagnostics(urlsToTry[0]),
      retryCount,
    });
    void (async () => {
      let lastReason: PlaybackFailureReason = 'SOURCE_NOT_FOUND';
      for (const target of urlsToTry) {
        const result = await preflightDirectMp4(target);
        if (cancelled) return;
        if (result.ok === true) {
          setPlayableDirectUrl(target);
          setDirectReady(true);
          return;
        }
        lastReason = result.reason;
        if (lastReason !== 'SOURCE_NOT_FOUND' && lastReason !== 'SOURCE_EXPIRED') break;
      }
      if (!cancelled) skipWithReason(lastReason);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, failed, direct, fileUrl, index, skipWithReason, sourceType, retryCount]);

  // YouTube WebView load watchdog (ref avoids stale closures / duplicate timers).
  const youtubeLoadedRef = useRef(false);
  useEffect(() => {
    youtubeLoadedRef.current = youtubeLoaded;
  }, [youtubeLoaded]);

  useEffect(() => {
    setYoutubeLoaded(false);
    youtubeLoadedRef.current = false;
  }, [embedUrl, index, sessionNonce, youtubeTier]);

  useEffect(() => {
    if (!visible || failed || !embedUrl || !showSurface) return;
    // Hosted/html need PLAYER_READY soon; watch page may take longer to paint.
    const waitMs =
      youtubeTier === 'watch'
        ? HIGHLIGHT_PLAYBACK_TIMEOUTS.YOUTUBE_LOAD_MS + 10_000
        : HIGHLIGHT_PLAYBACK_TIMEOUTS.YOUTUBE_LOAD_MS;
    const timer = setTimeout(() => {
      if (!youtubeLoadedRef.current) {
        skipWithReason(resolveTimeoutReason('youtube_load'));
      }
    }, waitMs);
    return () => clearTimeout(timer);
  }, [visible, failed, embedUrl, showSurface, index, sessionNonce, skipWithReason, youtubeTier]);

  const handleRetry = useCallback(() => {
    emitHighlightPlaybackDiagnostic({
      sessionId: sessionId.current,
      stage: 'PLAYER_RETRY',
      errorCategory: failureReason ?? undefined,
      retryCount: retryCount + 1,
    });
    resetSessionRefs({ skippedId, attempted, failureReasons });
    setRetryCount((count) => count + 1);
    setFailed(false);
    setFailureReason(null);
    setDirectReady(false);
    setYoutubeLoaded(false);
    setYoutubeTier('hosted');
    setIndex(0);
    setUiPhase('initializing');
    setSessionNonce((nonce) => nonce + 1);
  }, [failureReason, retryCount]);

  const openInYouTubeLabel = matchDetailsText.openInYouTube || FALLBACK_MESSAGES.openInYouTube;
  const loadingLabel =
    uiPhase === 'initializing'
      ? matchDetailsText.playbackInitializing || FALLBACK_MESSAGES.playbackInitializing
      : matchDetailsText.playbackLoading || FALLBACK_MESSAGES.playbackLoading;
  const retryLabel = matchDetailsText.playbackRetry || FALLBACK_MESSAGES.playbackRetry;

  const lastYouTubeUrl =
    [...attempted.current].reverse().find((candidate) => youtubeVideoId(candidate)) ||
    (videoId ? url : '');

  // YouTube watch often works when the in-app embed reports geo/embed/timeout.
  const showOpenInYouTube =
    failed &&
    (failureReason === 'EMBED_UNAVAILABLE' ||
      failureReason === 'GEO_RESTRICTED' ||
      failureReason === 'PLAYBACK_TIMEOUT') &&
    Boolean(lastYouTubeUrl && youtubeVideoId(lastYouTubeUrl));

  const showRetry = failed && failureReason != null && isRecoverablePlaybackFailure(failureReason);

  const showLoadingChrome =
    visible &&
    !failed &&
    ((Boolean(embedUrl) && !youtubeLoaded) || (direct && !directReady) || uiPhase === 'initializing');

  return (
    <Modal
      visible={visible && urls.length > 0}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={closeLabel} />
        {showSurface && embedUrl && youtubeWebSource && !failed ? (
          <View style={[styles.player, { width: playerWidth, height: playerHeight }]}>
            <WebView
              key={`${listKey}:${embedUrl}:${youtubeTier}:${sessionNonce}`}
              source={youtubeWebSource}
              style={{ width: playerWidth, height: playerHeight, opacity: 0.99, backgroundColor: '#000000' }}
              androidLayerType="hardware"
              userAgent={youtubeWebViewUserAgent()}
              onLoadStart={() => {
                setUiPhase('loading');
              }}
              originWhitelist={['*']}
              setSupportMultipleWindows={false}
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo={youtubeAllowsFullscreenVideo()}
              javaScriptEnabled
              domStorageEnabled
              injectedJavaScript={youtubeTier === 'watch' ? undefined : PLAYBACK_PROBE}
              onLoadEnd={() => {
                // Hosted/html: wait for PLAYER_READY. Watch page: treat paint as interactive.
                if (youtubeTier === 'watch') {
                  setYoutubeLoaded(true);
                  setUiPhase('ready');
                  return;
                }
                setUiPhase('loading');
              }}
              onMessage={(event) => {
                const data = event.nativeEvent.data || '';
                // PLAYER_READY = iframe ready. Clear spinner so the user can tap Play on iOS.
                if (isYouTubePlayerReadySignal(data) || /reason:USER_PLAY:/i.test(data)) {
                  setYoutubeLoaded(true);
                  youtubeLoadedRef.current = true;
                  setUiPhase('ready');
                  emitHighlightPlaybackDiagnostic({
                    sessionId: sessionId.current,
                    stage: 'PLAYER_INITIALIZING',
                    sourceType: 'youtube',
                    provider: 'youtube',
                    sourceHost: sanitizePlaybackUrlForDiagnostics(
                      hostedPlayerUrl || embedUrl || url,
                    ),
                    retryCount,
                  });
                  return;
                }
                // PLAYING = real playback confirmed.
                if (isYouTubePlayingSignal(data)) {
                  setYoutubeLoaded(true);
                  youtubeLoadedRef.current = true;
                  setUiPhase('playing');
                  emitHighlightPlaybackDiagnostic({
                    sessionId: sessionId.current,
                    stage: 'PLAYER_READY',
                    sourceType: 'youtube',
                    provider: 'youtube',
                    sourceHost: sanitizePlaybackUrlForDiagnostics(
                      hostedPlayerUrl || embedUrl || url,
                    ),
                    readyMs: Date.now() - sessionStartedAt.current,
                    retryCount,
                  });
                  return;
                }
                const reason = classifyYouTubeProbeSignal(data);
                if (!reason) return;
                // Accept bridge messages even when href is 90plus.pro (no videoId in URL).
                // Drop only clearly unrelated noise that is not a reason: payload.
                if (!/^reason:/i.test(data.trim()) && videoId && !data.includes(videoId)) return;
                skipWithReason(reason);
              }}
              onHttpError={(event) => {
                const status = event.nativeEvent.statusCode;
                const failedUrl = event.nativeEvent.url || '';
                if (status < 400) return;
                const mainDocument =
                  !failedUrl ||
                  (Boolean(hostedPlayerUrl) && failedUrl.startsWith(hostedPlayerUrl)) ||
                  failedUrl.startsWith(embedUrl) ||
                  (Boolean(mobileWatchUrl) && failedUrl.startsWith(mobileWatchUrl)) ||
                  (Boolean(videoId) && failedUrl.includes(`/embed/${videoId}`));
                // YouTube loads ads and thumbnails that 403/404. Those are not a failed video.
                if (!mainDocument) return;
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
            key={`${playableDirectUrl || fileUrl}:${sessionNonce}`}
            url={playableDirectUrl || fileUrl}
            width={playerWidth}
            height={playerHeight}
            sessionId={sessionId.current}
            retryCount={retryCount}
            startedAt={sessionStartedAt.current}
            onClose={onClose}
            closeLabel={closeLabel}
            onPhase={setUiPhase}
            onFailed={(reason) => skipWithReason(reason)}
          />
        ) : null}
        {showLoadingChrome ? (
          <View pointerEvents="none" style={styles.loadingOverlay}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={styles.loadingText}>{loadingLabel}</Text>
          </View>
        ) : null}
        {visible && failed ? (
          <View style={[styles.player, { width: playerWidth, height: playerHeight }]}>
            <View pointerEvents="none" style={styles.playerPlate} />
            <Text style={styles.error}>{messageFor(failureReason ?? 'UNKNOWN_ERROR')}</Text>
            {showRetry ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={retryLabel}
                onPress={handleRetry}
                style={styles.openYoutube}
              >
                <Text style={styles.openYoutubeText}>{retryLabel}</Text>
              </Pressable>
            ) : null}
            {showOpenInYouTube ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={openInYouTubeLabel}
                onPress={() => {
                  const watch =
                    lastYouTubeUrl.includes('youtube') || lastYouTubeUrl.includes('youtu.be')
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
  width,
  height,
  sessionId,
  retryCount,
  startedAt,
  onClose,
  closeLabel,
  onFailed,
  onPhase,
}: {
  url: string;
  width: number;
  height: number;
  sessionId: string;
  retryCount: number;
  startedAt: number;
  onClose: () => void;
  closeLabel: string;
  onFailed: (reason: PlaybackFailureReason) => void;
  onPhase: (phase: HighlightUiPhase) => void;
}) {
  const source = buildHighlightVideoSource(url);
  const sourceType = classifyHighlightSourceType(url);
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    try {
      Object.assign(instance, {
        // iOS: start sooner like reels. Android: keep a slightly deeper buffer.
        bufferOptions:
          Platform.OS === 'ios'
            ? {
                preferredForwardBufferDuration: 2,
                waitsToMinimizeStalling: false,
              }
            : {
                preferredForwardBufferDuration: 6,
                waitsToMinimizeStalling: true,
                minBufferForPlayback: 0.5,
              },
      });
    } catch {
      /* buffer options optional */
    }
  });
  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });
  const playingEvent = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const reported = useRef(false);
  const readyAt = useRef<number | null>(null);
  const playbackObserved = useRef(false);
  const wasPlayingBeforeBackground = useRef(false);

  const failOnce = useCallback(
    (reason: PlaybackFailureReason) => {
      if (reported.current) return;
      reported.current = true;
      onFailed(reason);
    },
    [onFailed],
  );

  useEffect(() => {
    onPhase('loading');
    emitHighlightPlaybackDiagnostic({
      sessionId,
      stage: 'PLAYER_INITIALIZING',
      sourceType,
      provider: inferHighlightProvider(url),
      sourceHost: sanitizePlaybackUrlForDiagnostics(url),
      playerStatus: status,
      retryCount,
    });
    // Mount-only init signal; status updates are emitted by ready/error watchdogs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPhase, sessionId, sourceType, url, retryCount]);

  // Initialization watchdog (readyToPlay).
  useEffect(() => {
    if (reported.current) return;
    const timer = setTimeout(() => {
      if (reported.current) return;
      if (player.status !== 'readyToPlay' && player.status !== 'error') {
        emitHighlightPlaybackDiagnostic({
          sessionId,
          stage: 'PLAYER_TIMEOUT',
          timeoutStage: 'initialization',
          playerStatus: player.status,
          sourceType,
          sourceHost: sanitizePlaybackUrlForDiagnostics(url),
          initMs: Date.now() - startedAt,
          retryCount,
        });
        onPhase('timed_out');
        failOnce(resolveTimeoutReason('initialization'));
      }
    }, HIGHLIGHT_PLAYBACK_TIMEOUTS.INITIALIZATION_MS);
    return () => clearTimeout(timer);
  }, [failOnce, onPhase, player, sessionId, sourceType, startedAt, url, retryCount]);

  // Playback-start watchdog after ready.
  useEffect(() => {
    if (status !== 'readyToPlay' || reported.current) return;
    if (readyAt.current == null) {
      readyAt.current = Date.now();
      onPhase('ready');
      emitHighlightPlaybackDiagnostic({
        sessionId,
        stage: 'PLAYER_READY',
        sourceType,
        provider: inferHighlightProvider(url),
        sourceHost: sanitizePlaybackUrlForDiagnostics(url),
        readyMs: Date.now() - startedAt,
        retryCount,
      });
    }
    const timer = setTimeout(() => {
      if (reported.current || playbackObserved.current) return;
      emitHighlightPlaybackDiagnostic({
        sessionId,
        stage: 'PLAYER_TIMEOUT',
        timeoutStage: 'playback_start',
        playerStatus: player.status,
        sourceType,
        sourceHost: sanitizePlaybackUrlForDiagnostics(url),
        playbackStartMs: Date.now() - startedAt,
        retryCount,
      });
      onPhase('timed_out');
      failOnce(resolveTimeoutReason('playback_start'));
    }, HIGHLIGHT_PLAYBACK_TIMEOUTS.PLAYBACK_START_MS);
    return () => clearTimeout(timer);
  }, [status, failOnce, onPhase, player, sessionId, sourceType, startedAt, url, retryCount]);

  useEffect(() => {
    if (status !== 'error' || reported.current) return;
    emitHighlightPlaybackDiagnostic({
      sessionId,
      stage: 'PLAYBACK_ERROR',
      errorCategory: 'PLAYER_INITIALIZATION_FAILED',
      playerStatus: status,
      sourceType,
      sourceHost: sanitizePlaybackUrlForDiagnostics(url),
      retryCount,
    });
    onPhase('error_recoverable');
    failOnce('PLAYER_INITIALIZATION_FAILED');
  }, [status, failOnce, onPhase, sessionId, sourceType, url, retryCount]);

  useEffect(() => {
    const isPlaying = Boolean(playingEvent?.isPlaying ?? player.playing);
    if (!isPlaying || playbackObserved.current) return;
    playbackObserved.current = true;
    onPhase('playing');
    // expo-video exposes playingChange, not a dedicated first-frame event.
    emitHighlightPlaybackDiagnostic({
      sessionId,
      stage: 'PLAYBACK_STARTED_OBSERVED',
      sourceType,
      provider: inferHighlightProvider(url),
      sourceHost: sanitizePlaybackUrlForDiagnostics(url),
      playbackStartMs: Date.now() - startedAt,
      retryCount,
    });
    emitHighlightPlaybackDiagnostic({
      sessionId,
      stage: 'PLAYBACK_CONFIRMED',
      sourceType,
      playbackStartMs: Date.now() - startedAt,
      retryCount,
    });
  }, [playingEvent, player.playing, onPhase, sessionId, sourceType, url, startedAt, retryCount]);

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

  // Background: pause only (no background audio). Do not auto-resume.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      try {
        if (next !== 'active') {
          if (player.playing) {
            wasPlayingBeforeBackground.current = true;
            player.pause();
          }
          return;
        }
        wasPlayingBeforeBackground.current = false;
      } catch {
        /* player may already be released */
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    return () => {
      emitHighlightPlaybackDiagnostic({
        sessionId,
        stage: 'PLAYER_DISPOSED',
        sourceType,
        sourceHost: sanitizePlaybackUrlForDiagnostics(url),
        retryCount,
      });
    };
  }, [sessionId, sourceType, url, retryCount]);

  return (
    <View style={[styles.player, { width, height }]}>
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
    backgroundColor: '#000000',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  player: {
    marginHorizontal: 12,
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  webView: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    opacity: 0.99,
    zIndex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
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
