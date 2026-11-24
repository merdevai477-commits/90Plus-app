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
import { Image as ExpoImage } from 'expo-image';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { holdHighlightReplay, releaseHighlightReplay } from '../../services/sentry.service';
import { useTranslation } from '../../src/i18n';
import {
  isYouTubePlayerReadySignal,
  isYouTubePlayingSignal,
  parseYouTubeProbeMessage,
  pickFinalPlaybackReason,
  playbackErrorMessageKey,
  shouldOfferOpenInYouTube,
  type PlaybackFailureReason,
} from '../../utils/highlightPlaybackErrors';
import * as HighlightPlaybackErrors from '../../utils/highlightPlaybackErrors';
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
  YOUTUBE_EMBED_ORIGIN,
} from '../../utils/highlightPlaybackUrl';
import {
  createInitialYoutubePlaybackSession,
  reduceYoutubePlaybackSession,
  youtubeSessionShowsLoadingSpinner,
  type YoutubePlaybackSessionEvent,
} from '../../utils/youtubePlaybackSession';

/**
 * Hosted IFrame URL (90plus.pro). Built locally so Fast Refresh cannot drop a
 * named `youtubeHostedPlayerUrl` import binding (Hermes ReferenceError).
 */
function hostedYoutubePlayerUrl(
  videoId: string,
  sessionToken?: string | null,
): string {
  const params = new URLSearchParams({ v: videoId });
  const sid = sessionToken?.trim();
  if (sid) params.set('rn_sid', sid);
  return `${YOUTUBE_EMBED_ORIGIN}/embed/youtube.html?${params.toString()}`;
}

/**
 * In-app YouTube surfaces (embeddable clips only).
 * 1) Hosted IFrame API page on 90plus.pro (real origin + raw onError codes)
 * 2) Direct youtube.com/embed URI with app Referer (Error 153 mitigation)
 * Non-embeddable clips → in-app fallback card (user-initiated Watch on YouTube).
 */
type YoutubeSurfaceTier = 'hosted' | 'embed';

type Props = {
  visible: boolean;
  urls: string[];
  onClose: () => void;
  closeLabel?: string;
  /** Optional clip title for the in-app fallback card. */
  title?: string | null;
  /** Optional thumbnail for the in-app fallback card. */
  thumbnailUrl?: string | null;
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

const FALLBACK_MESSAGES: Record<string, string> = {
  playbackGeoRestricted: 'This video is not available in your region inside the app.',
  playbackSourceUnavailable: 'This video is currently unavailable.',
  playbackSourceExpired: 'This video is currently unavailable.',
  playbackUnsupportedProvider: 'This video source is not supported.',
  playbackNetworkError: 'Unable to load the video. Please try again.',
  playbackPlayerFailed: 'Unable to play this video.',
  playbackEmbedUnavailable: 'This highlight cannot play inside the app. Watch it on YouTube.',
  playbackTimeout: 'Unable to load the video. Please try again.',
  playbackUnknownError: 'Something went wrong. Please try again.',
  openInYouTube: 'Watch on YouTube',
  playbackLoading: 'Loading video…',
  playbackInitializing: 'Preparing player…',
  playbackTapToPlay: 'Tap to play',
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
export function HighlightVideoSheet({
  visible,
  urls,
  onClose,
  closeLabel = 'Close',
  title = null,
  thumbnailUrl = null,
}: Props) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const playerWidth = Math.max(280, screenWidth - 48);
  const playerHeight = Math.round(playerWidth * 9 / 16);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<PlaybackFailureReason | null>(null);
  const [youtubeErrorCode, setYoutubeErrorCode] = useState<number | null>(null);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const [directReady, setDirectReady] = useState(false);
  const [playableDirectUrl, setPlayableDirectUrl] = useState('');
  const [uiPhase, setUiPhase] = useState<HighlightUiPhase>('idle');
  const [sessionNonce, setSessionNonce] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [youtubeTier, setYoutubeTier] = useState<YoutubeSurfaceTier>('hosted');
  const [ytSession, setYtSession] = useState(createInitialYoutubePlaybackSession);
  /**
   * Playback confirmed (PLAYING only) — NOT PLAYER_READY.
   * Kept as an explicit binding so Fast Refresh / Hermes never hit
   * "Property 'youtubeLoaded' doesn't exist" after the state rename,
   * and diagnostics keep the historical field name.
   */
  const youtubeLoaded = ytSession.playing;

  const skippedId = useRef('');
  const attempted = useRef<string[]>([]);
  const failureReasons = useRef<PlaybackFailureReason[]>([]);
  const lastYoutubeErrorCode = useRef<number | null>(null);
  const lastBridgeMessageKind = useRef<string | null>(null);
  const bridgeConnectedRef = useRef(false);
  const youtubeLoadedRef = useRef(false);
  const youtubeWebViewRef = useRef<WebView>(null);
  const sessionId = useRef(createHighlightPlaybackSessionId());
  const sessionStartedAt = useRef(Date.now());
  const listKey = urls.join('|');
  const openKey = visible ? `${listKey}#${sessionNonce}` : '';
  const [seenKey, setSeenKey] = useState(openKey);

  const dispatchYt = useCallback((event: YoutubePlaybackSessionEvent) => {
    setYtSession((prev) => reduceYoutubePlaybackSession(prev, event));
  }, []);

  useEffect(() => {
    youtubeLoadedRef.current = youtubeLoaded;
  }, [youtubeLoaded]);

  if (seenKey !== openKey) {
    resetSessionRefs({ skippedId, attempted, failureReasons });
    lastYoutubeErrorCode.current = null;
    lastBridgeMessageKind.current = null;
    bridgeConnectedRef.current = false;
    if (visible) {
      sessionId.current = createHighlightPlaybackSessionId();
      sessionStartedAt.current = Date.now();
    }
    setSeenKey(openKey);
    setIndex(0);
    setFailed(false);
    setFailureReason(null);
    setYoutubeErrorCode(null);
    setDirectReady(false);
    setPlayableDirectUrl('');
    setYtSession(createInitialYoutubePlaybackSession());
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
  const playbackSessionToken = `${sessionId.current}_${sessionNonce}`;
  const hostedPlayerUrl = videoId
    ? hostedYoutubePlayerUrl(videoId, playbackSessionToken)
    : null;
  const embedWebSource = videoId ? youtubeWebViewEmbedSource(videoId) : null;
  const showSurface = visible && surfaceReady;
  const unsupported = Boolean(url) && !embedUrl && !direct;
  const sourceType = classifyHighlightSourceType(fileUrl || url);
  const isHostedTier = youtubeTier === 'hosted';
  const youtubeWebSource =
    embedUrl && videoId
      ? isHostedTier && hostedPlayerUrl
        ? { uri: hostedPlayerUrl }
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
    const watch = youtubeMobileWatchUrl(id) || `https://www.youtube.com/watch?v=${id}`;
    void Linking.openURL(watch);
    return true;
  }, []);

  const finishWithReasons = useCallback(() => {
    const finalReason = pickFinalPlaybackReason(failureReasons.current);
    emitHighlightPlaybackDiagnostic({
      sessionId: sessionId.current,
      stage: 'PLAYBACK_ERROR',
      errorCategory: finalReason,
      errorCode:
        lastYoutubeErrorCode.current != null ? String(lastYoutubeErrorCode.current) : undefined,
      sourceType,
      provider: inferHighlightProvider(url || fileUrl),
      sourceHost: sanitizePlaybackUrlForDiagnostics(url || fileUrl),
      retryCount,
      initMs: Date.now() - sessionStartedAt.current,
    });

    // Stay inside match details — never auto-redirect. Show in-app fallback card.
    setFailureReason(finalReason);
    setYoutubeErrorCode(lastYoutubeErrorCode.current);
    setFailed(true);
    setDirectReady(false);
    setUiPhase(highlightUiPhaseForFailure(finalReason));
  }, [fileUrl, retryCount, sourceType, url]);

  const skipWithReason = useCallback(
    (reason: PlaybackFailureReason, code?: number | null) => {
      if (code != null && Number.isFinite(code)) {
        lastYoutubeErrorCode.current = code;
      }

      if (!url) {
        failureReasons.current.push(reason);
        finishWithReasons();
        return;
      }

      // Hosted IFrame failed → try direct embed URI + app Referer (may fix Error 153).
      if (
        embedUrl &&
        youtubeTier === 'hosted' &&
        (reason === 'EMBED_UNAVAILABLE' ||
          reason === 'PLAYBACK_TIMEOUT' ||
          reason === 'PLAYER_INITIALIZATION_FAILED' ||
          reason === 'NETWORK_ERROR')
      ) {
        failureReasons.current.push(reason);
        emitHighlightPlaybackDiagnostic({
          sessionId: sessionId.current,
          stage: reason === 'PLAYBACK_TIMEOUT' ? 'PLAYER_TIMEOUT' : 'PLAYBACK_ERROR',
          errorCategory: reason,
          errorCode: code != null ? String(code) : undefined,
          sourceType,
          provider: 'youtube',
          sourceHost: sanitizePlaybackUrlForDiagnostics(url),
          retryCount,
        });
        setYtSession(createInitialYoutubePlaybackSession());
        setYoutubeTier('embed');
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
        errorCode: code != null ? String(code) : lastYoutubeErrorCode.current != null
          ? String(lastYoutubeErrorCode.current)
          : undefined,
        sourceType,
        provider: inferHighlightProvider(url),
        sourceHost: sanitizePlaybackUrlForDiagnostics(url),
        retryCount,
      });
      if (index + 1 < urls.length) {
        setDirectReady(false);
        setYtSession(createInitialYoutubePlaybackSession());
        setYoutubeTier('hosted');
        lastYoutubeErrorCode.current = null;
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

  // Reset YouTube session when surface / tier / clip changes.
  // Keep bridgeConnected across hosted→embed escalate within same session token;
  // full openKey reset clears it above.
  useEffect(() => {
    setYtSession(createInitialYoutubePlaybackSession());
  }, [embedUrl, index, sessionNonce, youtubeTier]);

  const ytSessionRef = useRef(ytSession);
  useEffect(() => {
    ytSessionRef.current = ytSession;
  }, [ytSession]);

  // HTML / player-init watchdog — stops only after PLAYER_READY or PLAYING (or fail).
  useEffect(() => {
    if (!visible || failed || !embedUrl || !showSurface) return;
    if (!ytSession.loadWatchdogActive) return;
    const waitMs = HIGHLIGHT_PLAYBACK_TIMEOUTS.YOUTUBE_LOAD_MS;
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      const prev = ytSessionRef.current;
      if (!prev.loadWatchdogActive || prev.playerReady || prev.playing || prev.failed) return;
      dispatchYt({ type: 'LOAD_TIMEOUT' });
      emitHighlightPlaybackDiagnostic({
        sessionId: sessionId.current,
        stage: 'PLAYER_TIMEOUT',
        timeoutStage: 'youtube_load',
        errorCategory: 'PLAYBACK_TIMEOUT',
        tier: youtubeTier,
        sessionNonce,
        youtubeLoaded: false,
        bridgeConnected: bridgeConnectedRef.current,
        lastMessage: lastBridgeMessageKind.current,
        elapsedMs: Date.now() - startedAt,
        sourceType: 'youtube',
        sourceHost: sanitizePlaybackUrlForDiagnostics(hostedPlayerUrl || embedUrl || url),
        retryCount,
      });
      skipWithReason(resolveTimeoutReason('youtube_load'));
    }, waitMs);
    return () => clearTimeout(timer);
  }, [
    visible,
    failed,
    embedUrl,
    showSurface,
    index,
    sessionNonce,
    skipWithReason,
    youtubeTier,
    hostedPlayerUrl,
    url,
    retryCount,
    ytSession.loadWatchdogActive,
    dispatchYt,
  ]);

  // Playback-start watchdog — armed after autoplay attempt (PLAYER_READY) or USER_PLAY.
  // Does NOT clear merely because the player initialized; only PLAYING clears it.
  useEffect(() => {
    if (!visible || failed || !embedUrl || !showSurface) return;
    if (!ytSession.playbackWatchdogActive || ytSession.playing) return;
    const waitMs = HIGHLIGHT_PLAYBACK_TIMEOUTS.PLAYBACK_START_MS;
    const startedAt = Date.now();
    const epoch = ytSession.playbackWatchdogEpoch;
    const timer = setTimeout(() => {
      const prev = ytSessionRef.current;
      if (
        prev.playbackWatchdogEpoch !== epoch ||
        !prev.playbackWatchdogActive ||
        prev.playing ||
        prev.failed
      ) {
        return;
      }
      dispatchYt({ type: 'PLAYBACK_TIMEOUT' });
      emitHighlightPlaybackDiagnostic({
        sessionId: sessionId.current,
        stage: 'PLAYER_TIMEOUT',
        timeoutStage: 'playback_start',
        errorCategory: 'PLAYBACK_TIMEOUT',
        tier: youtubeTier,
        sessionNonce,
        youtubeLoaded: prev.playerReady,
        bridgeConnected: bridgeConnectedRef.current,
        lastMessage: lastBridgeMessageKind.current,
        elapsedMs: Date.now() - startedAt,
        sourceType: 'youtube',
        sourceHost: sanitizePlaybackUrlForDiagnostics(hostedPlayerUrl || embedUrl || url),
        retryCount,
      });
      skipWithReason(resolveTimeoutReason('playback_start'));
    }, waitMs);
    return () => clearTimeout(timer);
  }, [
    visible,
    failed,
    embedUrl,
    showSurface,
    index,
    sessionNonce,
    skipWithReason,
    youtubeTier,
    hostedPlayerUrl,
    url,
    retryCount,
    ytSession.playbackWatchdogActive,
    ytSession.playbackWatchdogEpoch,
    ytSession.playing,
    dispatchYt,
  ]);

  const handleRetry = useCallback(() => {
    emitHighlightPlaybackDiagnostic({
      sessionId: sessionId.current,
      stage: 'PLAYER_RETRY',
      errorCategory: failureReason ?? undefined,
      errorCode: youtubeErrorCode != null ? String(youtubeErrorCode) : undefined,
      tier: youtubeTier,
      sessionNonce,
      lastMessage: lastBridgeMessageKind.current,
      bridgeConnected: bridgeConnectedRef.current,
      retryCount: retryCount + 1,
    });
    resetSessionRefs({ skippedId, attempted, failureReasons });
    lastYoutubeErrorCode.current = null;
    lastBridgeMessageKind.current = null;
    bridgeConnectedRef.current = false;
    setRetryCount((count) => count + 1);
    setFailed(false);
    setFailureReason(null);
    setYoutubeErrorCode(null);
    setDirectReady(false);
    setYtSession(createInitialYoutubePlaybackSession());
    setYoutubeTier('hosted');
    setIndex(0);
    setUiPhase('initializing');
    setSessionNonce((nonce) => nonce + 1);
  }, [failureReason, retryCount, youtubeErrorCode, youtubeTier, sessionNonce]);

  const handlePlayAffordancePress = useCallback(() => {
    dispatchYt({ type: 'USER_PLAY' });
    // Prefer the hosted page's own tap control (posts USER_PLAY + tryPlay(true)).
    youtubeWebViewRef.current?.injectJavaScript(`
(function(){
  try {
    var t = document.getElementById('tap');
    if (t) { t.hidden = false; t.click(); }
    else {
      var v = document.querySelector('video');
      if (v) { try { v.muted = false; } catch (e1) {} v.play(); }
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('reason:USER_PLAY:' + (window.__HL_VID || '') + ':' + location.href);
      }
    }
  } catch (e) {}
  true;
})();`);
  }, [dispatchYt]);

  const openInYouTubeLabel = matchDetailsText.openInYouTube || FALLBACK_MESSAGES.openInYouTube;
  const loadingLabel =
    uiPhase === 'initializing'
      ? matchDetailsText.playbackInitializing || FALLBACK_MESSAGES.playbackInitializing
      : matchDetailsText.playbackLoading || FALLBACK_MESSAGES.playbackLoading;
  const tapToPlayLabel =
    matchDetailsText.playbackTapToPlay || FALLBACK_MESSAGES.playbackTapToPlay;
  const retryLabel = matchDetailsText.playbackRetry || FALLBACK_MESSAGES.playbackRetry;

  const lastYouTubeUrl =
    [...attempted.current].reverse().find((candidate) => youtubeVideoId(candidate)) ||
    (videoId ? url : '');

  const showOpenInYouTube =
    failed &&
    shouldOfferOpenInYouTube(failureReason) &&
    Boolean(lastYouTubeUrl && youtubeVideoId(lastYouTubeUrl));

  const showRetry = failed && failureReason != null && isRecoverablePlaybackFailure(failureReason);
  const fallbackTitle = (title || '').trim();
  const fallbackThumb = (thumbnailUrl || '').trim();

  const showYoutubeLoadingSpinner =
    Boolean(embedUrl) && youtubeSessionShowsLoadingSpinner(ytSession);
  const showPlayAffordance =
    visible &&
    !failed &&
    Boolean(embedUrl) &&
    ytSession.showPlayAffordance &&
    !ytSession.playing;
  const showLoadingChrome =
    visible &&
    !failed &&
    (showYoutubeLoadingSpinner || (direct && !directReady) || uiPhase === 'initializing');

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
          <View style={[styles.player, { width: youtubePlayerWidth, height: youtubePlayerHeight }]}>
            <WebView
              ref={youtubeWebViewRef}
              key={`${listKey}:${embedUrl}:${youtubeTier}:${sessionNonce}`}
              source={youtubeWebSource}
              style={styles.webView}
              androidLayerType="hardware"
              userAgent={youtubeWebViewUserAgent()}
              onLoadStart={() => {
                setUiPhase('loading');
                emitHighlightPlaybackDiagnostic({
                  sessionId: sessionId.current,
                  stage: 'PLAYER_INITIALIZING',
                  sourceType: 'youtube',
                  provider: 'youtube',
                  tier: youtubeTier,
                  sessionNonce,
                  sourceHost: sanitizePlaybackUrlForDiagnostics(
                    hostedPlayerUrl || embedUrl || url,
                  ),
                  playerStatus: 'load_start',
                  retryCount,
                });
              }}
              onLoadProgress={(event) => {
                const progress = event.nativeEvent.progress;
                if (progress < 0.25 || progress >= 1) {
                  emitHighlightPlaybackDiagnostic({
                    sessionId: sessionId.current,
                    stage: 'PLAYER_INITIALIZING',
                    sourceType: 'youtube',
                    provider: 'youtube',
                    tier: youtubeTier,
                    sessionNonce,
                    loadProgress: progress,
                    playerStatus: 'load_progress',
                    retryCount,
                  });
                }
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
              injectedJavaScript={isHostedTier ? undefined : PLAYBACK_PROBE}
              onLoadEnd={() => {
                emitHighlightPlaybackDiagnostic({
                  sessionId: sessionId.current,
                  stage: 'PLAYER_INITIALIZING',
                  sourceType: 'youtube',
                  provider: 'youtube',
                  tier: youtubeTier,
                  sessionNonce,
                  playerStatus: 'load_end',
                  youtubeLoaded: youtubeLoadedRef.current,
                  sourceHost: sanitizePlaybackUrlForDiagnostics(
                    hostedPlayerUrl || embedUrl || url,
                  ),
                  retryCount,
                });
                // Never treat HTML paint as playback success (hosted or embed).
                // Hosted posts PLAYER_READY/PLAYING; embed probe posts the same.
                void youtubeLoaded;
              }}
              onMessage={(event) => {
                const data = event.nativeEvent.data || '';
                // Ignore posts from a previous WebView session (rn_sid stamped into hosted URL).
                if (
                  isHostedTier &&
                  playbackSessionToken &&
                  !data.includes(`rn_sid=${playbackSessionToken}`) &&
                  !data.includes(`rn_sid%3D${encodeURIComponent(playbackSessionToken)}`)
                ) {
                  return;
                }

                const kind = HighlightPlaybackErrors.youtubeBridgeMessageKind(data);
                lastBridgeMessageKind.current = kind;
                emitHighlightPlaybackDiagnostic({
                  sessionId: sessionId.current,
                  stage: 'PLAYER_INITIALIZING',
                  sourceType: 'youtube',
                  provider: 'youtube',
                  tier: youtubeTier,
                  sessionNonce,
                  messageKind: kind,
                  lastMessage: kind,
                  bridgeConnected: bridgeConnectedRef.current,
                  playerStatus: 'bridge_message',
                  retryCount,
                });

                if (
                  HighlightPlaybackErrors.isYouTubeBridgeDiagnosticSignal(data) ||
                  kind === 'BRIDGE_HELLO'
                ) {
                  bridgeConnectedRef.current = true;
                  return;
                }

                if (isYouTubePlayerReadySignal(data)) {
                  bridgeConnectedRef.current = true;
                  // Init only — do not claim playback success or disable playback watchdog.
                  dispatchYt({ type: 'PLAYER_READY' });
                  setUiPhase('ready');
                  emitHighlightPlaybackDiagnostic({
                    sessionId: sessionId.current,
                    stage: 'PLAYER_READY',
                    sourceType: 'youtube',
                    provider: 'youtube',
                    tier: youtubeTier,
                    sessionNonce,
                    messageKind: kind,
                    bridgeConnected: true,
                    youtubeLoaded: false,
                    sourceHost: sanitizePlaybackUrlForDiagnostics(
                      hostedPlayerUrl || embedUrl || url,
                    ),
                    readyMs: Date.now() - sessionStartedAt.current,
                    retryCount,
                  });
                  return;
                }
                if (/reason:USER_PLAY:/i.test(data)) {
                  bridgeConnectedRef.current = true;
                  dispatchYt({ type: 'USER_PLAY' });
                  setUiPhase('ready');
                  emitHighlightPlaybackDiagnostic({
                    sessionId: sessionId.current,
                    stage: 'PLAYER_INITIALIZING',
                    sourceType: 'youtube',
                    provider: 'youtube',
                    tier: youtubeTier,
                    sessionNonce,
                    messageKind: 'USER_PLAY',
                    bridgeConnected: true,
                    youtubeLoaded: false,
                    sourceHost: sanitizePlaybackUrlForDiagnostics(
                      hostedPlayerUrl || embedUrl || url,
                    ),
                    retryCount,
                  });
                  return;
                }
                if (isYouTubePlayingSignal(data)) {
                  bridgeConnectedRef.current = true;
                  dispatchYt({ type: 'PLAYING' });
                  setUiPhase('playing');
                  emitHighlightPlaybackDiagnostic({
                    sessionId: sessionId.current,
                    stage: 'PLAYBACK_STARTED',
                    sourceType: 'youtube',
                    provider: 'youtube',
                    tier: youtubeTier,
                    sessionNonce,
                    messageKind: 'PLAYING',
                    bridgeConnected: true,
                    youtubeLoaded: true,
                    sourceHost: sanitizePlaybackUrlForDiagnostics(
                      hostedPlayerUrl || embedUrl || url,
                    ),
                    playbackStartMs: Date.now() - sessionStartedAt.current,
                    retryCount,
                  });
                  youtubeLoadedRef.current = true;
                  emitHighlightPlaybackDiagnostic({
                    sessionId: sessionId.current,
                    stage: 'PLAYBACK_CONFIRMED',
                    sourceType: 'youtube',
                    provider: 'youtube',
                    tier: youtubeTier,
                    sessionNonce,
                    messageKind: 'PLAYING',
                    youtubeLoaded: true,
                    playbackStartMs: Date.now() - sessionStartedAt.current,
                    retryCount,
                  });
                  return;
                }
                const parsed = parseYouTubeProbeMessage(data);
                if (parsed.isProgress || !parsed.reason) return;
                if (!/^reason:/i.test(data.trim()) && videoId && !data.includes(videoId)) return;
                bridgeConnectedRef.current = true;
                dispatchYt({ type: 'FAIL' });
                skipWithReason(parsed.reason, parsed.youtubeErrorCode);
              }}
              onHttpError={(event) => {
                const status = event.nativeEvent.statusCode;
                const failedUrl = event.nativeEvent.url || '';
                if (status < 400) return;
                const mainDocument =
                  !failedUrl ||
                  (Boolean(hostedPlayerUrl) && failedUrl.startsWith(hostedPlayerUrl.split('?')[0])) ||
                  failedUrl.startsWith(embedUrl) ||
                  (Boolean(videoId) && failedUrl.includes(`/embed/${videoId}`));
                // YouTube loads ads and thumbnails that 403/404. Those are not a failed video.
                if (!mainDocument) return;
                if (status === 404) skipWithReason('SOURCE_NOT_FOUND');
                else if (status === 410) skipWithReason('SOURCE_EXPIRED');
                else if (status >= 500) skipWithReason('NETWORK_ERROR');
                else skipWithReason('UNKNOWN_ERROR');
              }}
            />
            {showPlayAffordance ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tapToPlayLabel}
                onPress={handlePlayAffordancePress}
                style={styles.playAffordance}
              >
                <View style={styles.playDisc}>
                  <View style={styles.playTriangle} />
                </View>
                <Text style={styles.playAffordanceText}>{tapToPlayLabel}</Text>
              </Pressable>
            ) : null}
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
          <View style={[styles.fallbackCard, { width: youtubePlayerWidth }]}>
            {fallbackThumb ? (
              <ExpoImage
                source={{ uri: fallbackThumb }}
                style={[styles.fallbackThumb, { height: youtubePlayerHeight }]}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.fallbackThumbPlaceholder, { height: youtubePlayerHeight }]}>
                <Ionicons name="videocam-off-outline" size={36} color="#9CA3AF" />
              </View>
            )}
            {fallbackTitle ? <Text style={styles.fallbackTitle}>{fallbackTitle}</Text> : null}
            <Text style={styles.error}>{messageFor(failureReason ?? 'UNKNOWN_ERROR')}</Text>
            {youtubeErrorCode != null ? (
              <Text style={styles.fallbackMeta}>YouTube error {youtubeErrorCode}</Text>
            ) : null}
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
                  // User-initiated only — keep the sheet open so closing returns to match details.
                  openYouTubeExternally(lastYouTubeUrl);
                }}
                style={[styles.openYoutube, styles.openYoutubePrimary]}
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
  fallbackCard: {
    marginHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#111111',
    paddingBottom: 16,
  },
  fallbackThumb: {
    width: '100%',
    backgroundColor: '#000000',
  },
  fallbackThumbPlaceholder: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  fallbackMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 6,
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
  playAffordance: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  playDisc: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderStyle: 'solid',
    borderTopWidth: 12,
    borderBottomWidth: 12,
    borderLeftWidth: 20,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#1a0b3a',
  },
  playAffordanceText: {
    color: '#FFFFFF',
    fontSize: 14,
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
  openYoutubePrimary: {
    backgroundColor: '#FF0033',
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
