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
  youtubeEmbedUrl,
  youtubeMobileWatchUrl,
  youtubeVideoId,
  youtubeWebViewEmbedSource,
} from '../../utils/highlightPlaybackUrl';

/**
 * In-app YouTube surfaces before external Linking.
 * 1) embed + app Referer — fixes Error 153 in RN WebView
 * 2) watch page — rights-claimed clips that block iframe but play on youtube.com
 * 3) open YouTube app/site — hard fail only
 */
type YoutubeSurfaceTier = 'embed' | 'watch';

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
  var reportedPlaying = false;
  var reportedFail = false;
  function send(reason) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage('reason:' + reason + ':' + (window.__HL_VID || '') + ':' + location.href);
    }
  }
  function pageText(doc) {
    try { return (doc && doc.body && doc.body.innerText) || ''; } catch (e) { return ''; }
  }
  function hasPlayableVideo() {
    try {
      var video = document.querySelector('video.html5-main-video, #movie_player video, video');
      if (video && video.readyState >= 2 && !video.error) return true;
      var mp = document.querySelector('#movie_player');
      if (mp && mp.classList && (mp.classList.contains('playing-mode') || mp.classList.contains('paused-mode'))) return true;
      if (mp && !document.querySelector('.ytp-error')) return true;
    } catch (e) {}
    return false;
  }
  function check() {
    if (!reportedPlaying && hasPlayableVideo()) {
      reportedPlaying = true;
      send('PLAYER_READY');
      send('PLAYING');
      return;
    }
    if (reportedFail || reportedPlaying) return;
    var text = pageText(document);
    var err = '';
    try {
      var node = document.querySelector('.ytp-error, .ytp-error-content, .ytp-error-content-wrap-subreason');
      err = node ? (node.innerText || '') : '';
    } catch (e) {}
    var blob = text + ' ' + err;
    if (/playback on other websites has been disabled|video player configuration error|error\\s*153/i.test(blob)) {
      reportedFail = true;
      send('EMBED_UNAVAILABLE');
      return;
    }
    if (/not made this video available in your country|unavailable in your country|isn't available in your country|is not available in your country|غير متاح في بلدك|غير متاح في بلدكم/i.test(blob)) {
      reportedFail = true;
      send('EMBED_UNAVAILABLE');
      return;
    }
    if (/video unavailable/i.test(blob) && /country|region|بلد|uploader/i.test(blob)) {
      reportedFail = true;
      send('EMBED_UNAVAILABLE');
    }
  }
  window.addEventListener('message', function (event) {
    if (reportedFail || reportedPlaying) return;
    var raw = typeof event.data === 'string' ? event.data : JSON.stringify(event.data || '');
    var info = raw.match(/"info"\\s*:\\s*(100|101|150|153)/);
    if (info) {
      var code = info[1];
      reportedFail = true;
      if (code === '100') send('SOURCE_NOT_FOUND');
      else send('EMBED_UNAVAILABLE');
      return;
    }
    if (/onError/.test(raw) && /150|153|101/.test(raw)) {
      reportedFail = true;
      send('EMBED_UNAVAILABLE');
    } else if (/onError/.test(raw) && /100/.test(raw)) {
      reportedFail = true;
      send('SOURCE_NOT_FOUND');
    }
  });
  setTimeout(check, 600);
  setTimeout(check, 1600);
  setTimeout(check, 3500);
  setTimeout(check, 6000);
})();
true;
`;

/**
 * Watch page plays when iframe embed is blocked — strip the rest of YouTube chrome
 * so the in-app sheet looks like a player-only surface.
 */
const WATCH_PAGE_CHROME_CSS = `
html,body{background:#000!important;overflow:hidden!important;height:100%!important;margin:0!important;padding:0!important}
ytd-masthead,#masthead-container,#guide-button,#guide,#guide-content,#secondary,#related,#comments,
ytd-watch-metadata,#below,#chat,#chat-container,ytd-live-chat-frame,tp-yt-paper-dialog,ytd-popup-container,
#ticket-shelf,ytd-merch-shelf-renderer,ytd-watch-next-secondary-results-renderer,#columns > #secondary,
ytm-mobile-topbar-renderer,.mobile-topbar-header,ytm-pivot-bar-renderer,ytm-item-section-renderer,
ytm-slim-video-metadata-section-renderer,ytm-slim-owner-renderer,ytm-engagement-panel,
ytm-comment-section-renderer,bottom-sheet-container,.ytm-bottom-sheet-overlay,
.open-app-button,ytm-companion-slot,ytm-promoted-sparkles-web-renderer,#appbar-content,
#header,header,nav,.ytp-chrome-top-buttons,ytd-mealbar-promo-renderer,
#clarify-box,ytd-info-panel-content-renderer{display:none!important;height:0!important;max-height:0!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important}
#player,#player-container-outer,#player-container-inner,ytd-player,#movie_player,#player-container,
.html5-video-player,#player-theater-container,#player-container-id,#ytd-player,
#player-api,.player-container,.html5-video-container{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;min-height:100vh!important;z-index:2147483646!important;margin:0!important;padding:0!important;background:#000!important;transform:none!important}
video.html5-main-video,video{object-fit:contain!important;width:100%!important;height:100%!important}
#content,#page-manager,ytd-watch-flexy,#columns,#primary,#primary-inner{margin:0!important;padding:0!important;max-width:none!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#000!important}
`;

const WATCH_PAGE_PROBE = `
(function () {
  var reportedPlaying = false;
  var reportedFail = false;
  function send(reason) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage('reason:' + reason + ':' + (window.__HL_VID || '') + ':' + location.href);
    }
  }
  function injectChrome() {
    try {
      if (!document.getElementById('hl-yt-chrome-hide')) {
        var style = document.createElement('style');
        style.id = 'hl-yt-chrome-hide';
        style.type = 'text/css';
        style.appendChild(document.createTextNode(${JSON.stringify(WATCH_PAGE_CHROME_CSS)}));
        (document.head || document.documentElement).appendChild(style);
      }
      document.documentElement.style.background = '#000';
      if (document.body) {
        document.body.style.background = '#000';
        document.body.style.overflow = 'hidden';
      }
    } catch (e) {}
  }
  function hasPlayableVideo() {
    try {
      var video = document.querySelector('video.html5-main-video, #movie_player video, video');
      if (video && video.readyState >= 2 && !video.error) return true;
      var mp = document.querySelector('#movie_player');
      if (mp && mp.classList && (mp.classList.contains('playing-mode') || mp.classList.contains('paused-mode'))) return true;
      if (mp && !document.querySelector('.ytp-error')) return true;
    } catch (e) {}
    return false;
  }
  function playerErrorText() {
    try {
      var err = document.querySelector('.ytp-error, .ytp-error-content, .ytp-error-content-wrap-subreason');
      return err ? (err.innerText || '') : '';
    } catch (e) { return ''; }
  }
  function check() {
    injectChrome();
    if (!reportedPlaying && hasPlayableVideo()) {
      reportedPlaying = true;
      send('PLAYER_READY');
      send('PLAYING');
      return;
    }
    if (reportedFail || reportedPlaying) return;
    // Only fail on hard player errors — never on page-wide "country" copy (false positives).
    var errText = playerErrorText();
    if (/configuration error|error\\s*153|playback on other websites has been disabled/i.test(errText)) {
      reportedFail = true;
      send('EMBED_UNAVAILABLE');
      return;
    }
    if (/video unavailable/i.test(errText) && /uploader|country|region/i.test(errText)) {
      reportedFail = true;
      send('EMBED_UNAVAILABLE');
    }
  }
  injectChrome();
  check();
  try {
    var obs = new MutationObserver(function () { check(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  setTimeout(check, 200);
  setTimeout(check, 800);
  setTimeout(check, 1600);
  setTimeout(check, 3200);
  setTimeout(check, 6000);
})();
true;
`;

/** Early CSS so the full YouTube chrome never flashes before the probe runs. */
const WATCH_PAGE_BEFORE_LOAD = `
(function () {
  try {
    var style = document.createElement('style');
    style.id = 'hl-yt-chrome-hide-early';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(${JSON.stringify(WATCH_PAGE_CHROME_CSS)}));
    (document.head || document.documentElement).appendChild(style);
  } catch (e) {}
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
  const [youtubeTier, setYoutubeTier] = useState<YoutubeSurfaceTier>('embed');

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
    setYoutubeTier('embed');
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
  const mobileWatchUrl = videoId ? youtubeMobileWatchUrl(videoId) : null;
  const embedWebSource = videoId ? youtubeWebViewEmbedSource(videoId) : null;
  const showSurface = visible && surfaceReady;
  const unsupported = Boolean(url) && !embedUrl && !direct;
  const sourceType = classifyHighlightSourceType(fileUrl || url);
  const isWatchTier = youtubeTier === 'watch';
  const youtubeWebSource =
    embedUrl && videoId
      ? isWatchTier && mobileWatchUrl
        ? { uri: mobileWatchUrl }
        : embedWebSource
      : null;
  // Keep stable names for layout math (avoids stale HMR refs to removed locals).
  const youtubePlayerWidth = playerWidth;
  const youtubePlayerHeight = playerHeight;

  const matchDetailsText = t.matchDetails as unknown as Record<string, string | undefined>;

  const messageFor = useCallback(
    (reason: PlaybackFailureReason) => {
      const key = playbackErrorMessageKey(reason);
      const fromLocale = matchDetailsText[key];
      return fromLocale || FALLBACK_MESSAGES[key] || FALLBACK_MESSAGES.playbackUnknownError;
    },
    [matchDetailsText],
  );

  const openYouTubeExternally = useCallback((candidateUrl: string) => {
    const id = youtubeVideoId(candidateUrl);
    if (!id) return false;
    const watch = `https://www.youtube.com/watch?v=${id}`;
    void Linking.openURL(watch);
    return true;
  }, []);

  const finishWithReasons = useCallback(() => {
    const finalReason = pickFinalPlaybackReason(failureReasons.current);
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

    const ytCandidate =
      [...attempted.current].reverse().find((candidate) => youtubeVideoId(candidate)) ||
      (youtubeVideoId(url) ? url : '');

    // Don't leave the user on a dead error sheet — open YouTube and close.
    if (
      ytCandidate &&
      (finalReason === 'EMBED_UNAVAILABLE' ||
        finalReason === 'GEO_RESTRICTED' ||
        finalReason === 'PLAYBACK_TIMEOUT') &&
      openYouTubeExternally(ytCandidate)
    ) {
      onClose();
      return;
    }

    setFailureReason(finalReason);
    setFailed(true);
    setDirectReady(false);
    setUiPhase(highlightUiPhaseForFailure(finalReason));
  }, [fileUrl, onClose, openYouTubeExternally, retryCount, sourceType, url]);

  const skipWithReason = useCallback(
    (reason: PlaybackFailureReason) => {
      if (!url) {
        failureReasons.current.push(reason);
        finishWithReasons();
        return;
      }

      // Embed blocked (153 / rights) → try the full watch page in-app before giving up.
      if (
        embedUrl &&
        youtubeTier === 'embed' &&
        (reason === 'EMBED_UNAVAILABLE' ||
          reason === 'GEO_RESTRICTED' ||
          reason === 'PLAYBACK_TIMEOUT')
      ) {
        failureReasons.current.push(reason);
        emitHighlightPlaybackDiagnostic({
          sessionId: sessionId.current,
          stage: reason === 'PLAYBACK_TIMEOUT' ? 'PLAYER_TIMEOUT' : 'PLAYBACK_ERROR',
          errorCategory: reason,
          sourceType,
          provider: 'youtube',
          sourceHost: sanitizePlaybackUrlForDiagnostics(url),
          retryCount,
        });
        setYoutubeLoaded(false);
        setYoutubeTier('watch');
        setUiPhase('loading');
        return;
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
        setYoutubeTier('embed');
        setUiPhase('loading');
        setIndex((current) => current + 1);
      } else {
        finishWithReasons();
      }
    },
    [
      embedUrl,
      finishWithReasons,
      index,
      retryCount,
      sourceType,
      url,
      urls.length,
      videoId,
      youtubeTier,
    ],
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
    // Watch page can take longer to paint the player; embed should be ready sooner.
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
    setYoutubeTier('embed');
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
          <View
            style={
              isWatchTier
                ? styles.watchShell
                : [styles.player, { width: youtubePlayerWidth, height: youtubePlayerHeight }]
            }
          >
            <WebView
              key={`${listKey}:${embedUrl}:${youtubeTier}:${sessionNonce}`}
              source={youtubeWebSource}
              style={isWatchTier ? styles.watchWebView : styles.webView}
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
              // Watch page needs native fullscreen controls; embed stays modal-safe on iOS.
              allowsFullscreenVideo={isWatchTier ? true : youtubeAllowsFullscreenVideo()}
              javaScriptEnabled
              domStorageEnabled
              injectedJavaScriptBeforeContentLoaded={
                isWatchTier ? WATCH_PAGE_BEFORE_LOAD : undefined
              }
              injectedJavaScript={isWatchTier ? WATCH_PAGE_PROBE : PLAYBACK_PROBE}
              onLoadEnd={() => {
                // Clear spinner once the surface paints; probes still catch hard player errors.
                setYoutubeLoaded(true);
                youtubeLoadedRef.current = true;
                setUiPhase('ready');
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
                    sourceHost: sanitizePlaybackUrlForDiagnostics(embedUrl || url),
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
                    sourceHost: sanitizePlaybackUrlForDiagnostics(embedUrl || url),
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
                  failedUrl.startsWith(embedUrl) ||
                  (Boolean(mobileWatchUrl) && failedUrl.startsWith(mobileWatchUrl)) ||
                  (Boolean(videoId) && failedUrl.includes(`/embed/${videoId}`)) ||
                  (Boolean(videoId) && failedUrl.includes(`watch?v=${videoId}`));
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
            width={youtubePlayerWidth}
            height={youtubePlayerHeight}
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
          <View style={[styles.player, { width: youtubePlayerWidth, height: youtubePlayerHeight }]}>
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
                  if (openYouTubeExternally(lastYouTubeUrl)) onClose();
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
    // YouTube UI is LTR; an RTL root collapses the watch WebView into a thin right strip.
    direction: 'ltr',
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
  /** Full-bleed shell for youtube.com/watch — no 16:9 box (that crushed the page into a strip). */
  watchShell: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    direction: 'ltr',
  },
  watchWebView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    opacity: 0.99,
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
