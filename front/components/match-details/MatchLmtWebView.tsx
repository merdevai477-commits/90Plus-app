import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Modal,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PitchBrandLogo } from './PitchBrandLogo';
import {
  fetchBrandedLmtHtml,
  LMT_WIDGET_BASE_ORIGIN,
} from '../../services/lmt.service';
import { getApiEndpoint } from '../../config/api.config';

const LMT_REMOTE_LOG_URL = getApiEndpoint('debug/lmt-log');

function remoteLog(event: string, data: Record<string, unknown> = {}): void {
  console.warn(event, data);
  fetch(LMT_REMOTE_LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      ...data,
      platform: Platform.OS,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

type MatchLmtWebViewProps = {
  /** Official 365 GetWidget URL (partnerid — NOT gameId). */
  widgetUrl: string;
  /** Optional backend HTML shell — last-resort URI fallback. */
  embedUrl?: string | null;
  aspectRatio?: number | null;
  /** hero = replaces score card at top of match details */
  variant?: 'hero' | 'card';
  /**
   * true → transparent pitchLogo (hide 365 mark entirely).
   * false → brandLogoUrl or default 90PLUS-app SVG data URI.
   */
  hideBrand?: boolean;
  /** Absolute / data URI used as pitchLogo when hideBrand is false. */
  brandLogoUrl?: string | null;
  /**
   * Visual overlay fallback only when GetWidget HTML branding failed
   * and we fell back to loading widgetUrl as uri.
   */
  coverBrand?: boolean;
  unavailableLabel?: string;
  loadingLabel?: string;
  retryLabel?: string;
  expandLabel?: string;
  collapseLabel?: string;
};

type LoadMode = 'html' | 'uri';

type WebSource =
  | { html: string; baseUrl: string }
  | { uri: string };

function LmtPitchSurface({
  webSource,
  webKey,
  showOverlayFallback,
  hideBrand,
  brandWidth,
  brandHeight,
  onLoadStart,
  onLoadEnd,
  onError,
  onHttpError,
}: {
  webSource: WebSource;
  webKey: string;
  showOverlayFallback: boolean;
  hideBrand: boolean;
  brandWidth: number;
  brandHeight: number;
  onLoadStart: () => void;
  onLoadEnd: () => void;
  onError: () => void;
  onHttpError: (code: number) => void;
}) {
  const isHtmlSource = 'html' in webSource;
  // Static HTML on iOS requires ['*'] or WKWebView can render blank.
  const originWhitelist = isHtmlSource
    ? (['*'] as const)
    : (['https://*', 'http://*', 'about:blank'] as const);

  return (
    <View style={styles.surfaceFill}>
      <WebView
        key={webKey}
        source={webSource}
        style={styles.webview}
        originWhitelist={[...originWhitelist]}
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        startInLoadingState={false}
        cacheEnabled
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onHttpError={(e) => onHttpError(e.nativeEvent?.statusCode ?? 0)}
        {...(Platform.OS === 'ios'
          ? {
              allowsBackForwardNavigationGestures: false,
              allowsLinkPreview: false,
              bounces: false,
              sharedCookiesEnabled: true,
              dataDetectorTypes: 'none' as const,
            }
          : {})}
        {...(Platform.OS === 'android'
          ? {
              mixedContentMode: 'always' as const,
              nestedScrollEnabled: true,
              thirdPartyCookiesEnabled: true,
              overScrollMode: 'never' as const,
            }
          : {})}
      />
      {showOverlayFallback ? (
        <View
          pointerEvents="none"
          style={[
            styles.brandCover,
            {
              width: brandWidth,
              height: brandHeight,
              marginLeft: -brandWidth / 2,
            },
          ]}
        >
          <View style={styles.brandPatch} />
          {!hideBrand ? (
            <PitchBrandLogo width={brandWidth} height={brandHeight} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Live Match Tracker WebView — DD-style branding + optional landscape expand.
 */
export function MatchLmtWebView({
  widgetUrl,
  embedUrl,
  aspectRatio,
  variant = 'hero',
  hideBrand = false,
  brandLogoUrl = null,
  coverBrand = false,
  unavailableLabel = 'Live tracking is not available for this match.',
  loadingLabel = 'Loading tracking…',
  retryLabel = 'Retry',
  expandLabel = 'Wider view',
  collapseLabel = 'Close wider view',
}: MatchLmtWebViewProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const sidePad = 16;
  const frameWidth = variant === 'hero'
    ? width
    : Math.max(280, width - sidePad * 2);
  const frameHeight = Math.max(
    variant === 'hero' ? 300 : 220,
    Math.round(frameWidth / ratio) + (variant === 'hero' ? 48 : 0),
  );

  const brandWidth = Math.min(280, Math.round(frameWidth * 0.72));
  const brandHeight = Math.round(brandWidth * (84 / 280));

  // Landscape-like frame while device stays portrait (rotate content 90°).
  const landscapeW = Math.max(width, height);
  const landscapeH = Math.min(width, height);
  const landscapeBrandW = Math.min(320, Math.round(landscapeW * 0.55));
  const landscapeBrandH = Math.round(landscapeBrandW * (84 / 280));

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<LoadMode>('html');
  const [brandedHtml, setBrandedHtml] = useState<string | null>(null);
  const [uriFallback, setUriFallback] = useState(widgetUrl);
  const [landscapeOpen, setLandscapeOpen] = useState(false);

  const prepareHtml = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    setMode('html');
    setBrandedHtml(null);
    try {
      const html = await fetchBrandedLmtHtml(widgetUrl, { hideBrand, brandLogoUrl });
      setBrandedHtml(html);
      setMode('html');
    } catch (err) {
      remoteLog('[LMT] fetchBrandedLmtHtml failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      setBrandedHtml(null);
      setMode('uri');
      setUriFallback(widgetUrl);
    }
  }, [widgetUrl, hideBrand, brandLogoUrl]);

  useEffect(() => {
    void prepareHtml();
  }, [prepareHtml, reloadKey]);

  const handleRetry = useCallback(() => {
    if (mode === 'uri' && embedUrl && uriFallback === widgetUrl) {
      setUriFallback(embedUrl);
      setReloadKey((k) => k + 1);
      setFailed(false);
      setLoading(true);
      return;
    }
    setReloadKey((k) => k + 1);
  }, [mode, embedUrl, uriFallback, widgetUrl]);

  const webSource = useMemo((): WebSource => {
    if (mode === 'html' && brandedHtml) {
      return {
        html: brandedHtml,
        baseUrl: `${LMT_WIDGET_BASE_ORIGIN}/`,
      };
    }
    return { uri: uriFallback };
  }, [mode, brandedHtml, uriFallback]);

  useEffect(() => {
    remoteLog('[LMT] source mode resolved', {
      mode,
      isHtml: 'html' in webSource,
    });
  }, [mode, webSource]);

  const showOverlayFallback = coverBrand && mode === 'uri' && !loading && !failed;
  const ready = Boolean(brandedHtml || mode === 'uri');
  const waitingForHtml = mode === 'html' && !brandedHtml && !failed;
  const webKey = `${mode}-${reloadKey}-${mode === 'html' ? 'html' : uriFallback}`;

  const onWebError = useCallback(() => {
    // iOS WKWebView often fires onError for subresources even when branded HTML
    // loaded fine. Falling back to uri showed raw 365 + a green cover — keep HTML.
    if (mode === 'html' && brandedHtml) {
      remoteLog('[LMT] WebView error ignored (keeping branded html)', { mode });
      setLoading(false);
      return;
    }
    if (mode === 'html') {
      remoteLog('[LMT] WebView error → fallback triggered', { mode });
      setMode('uri');
      setBrandedHtml(null);
      setUriFallback(widgetUrl);
      setLoading(true);
      return;
    }
    setLoading(false);
    setFailed(true);
  }, [mode, brandedHtml, widgetUrl]);

  const onWebHttpError = useCallback(
    (code: number) => {
      if (code < 400) return;
      // Same as onError: do not drop successful HTML branding on subresource 4xx/5xx.
      if (mode === 'html' && brandedHtml) {
        remoteLog('[LMT] WebView HTTP error ignored (keeping branded html)', {
          mode,
          code,
        });
        return;
      }
      remoteLog('[LMT] WebView HTTP error', { mode, code });
      onWebError();
    },
    [mode, brandedHtml, onWebError],
  );

  if (!widgetUrl?.trim()) {
    return null;
  }

  return (
    <>
      <View
        style={[
          variant === 'hero' ? styles.hero : styles.card,
          { height: frameHeight },
        ]}
      >
        {(loading || waitingForHtml) && !failed ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color="#a78bfa" size="large" />
            <Text style={styles.loadingText}>{loadingLabel}</Text>
          </View>
        ) : null}

        {failed ? (
          <View style={styles.overlay}>
            <Ionicons name="cloud-offline-outline" size={36} color="#9ca3af" />
            <Text style={styles.emptyText}>{unavailableLabel}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.85}>
              <Text style={styles.retryText}>{retryLabel}</Text>
            </TouchableOpacity>
          </View>
        ) : ready && !landscapeOpen ? (
          <>
            <LmtPitchSurface
              webSource={webSource}
              webKey={webKey}
              showOverlayFallback={showOverlayFallback}
              hideBrand={hideBrand}
              brandWidth={brandWidth}
              brandHeight={brandHeight}
              onLoadStart={() => {
                setLoading(true);
                setFailed(false);
              }}
              onLoadEnd={() => setLoading(false)}
              onError={onWebError}
              onHttpError={onWebHttpError}
            />

            {/* Expand to wide / landscape-like view (video-style) */}
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => setLandscapeOpen(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={expandLabel}
            >
              <Ionicons name="phone-landscape-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </>
        ) : ready && landscapeOpen ? (
          // Keep hero chrome while landscape modal owns the only WKWebView (iOS memory).
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color="#a78bfa" size="large" />
          </View>
        ) : null}
      </View>

      <Modal
        visible={landscapeOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setLandscapeOpen(false)}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <StatusBar hidden={landscapeOpen} />
        <View style={styles.landscapeRoot}>
          <View
            style={[
              styles.landscapeStage,
              {
                width: landscapeW,
                height: landscapeH,
              },
            ]}
          >
            {ready ? (
              <LmtPitchSurface
                webSource={webSource}
                webKey={`land-${webKey}`}
                showOverlayFallback={showOverlayFallback}
                hideBrand={hideBrand}
                brandWidth={landscapeBrandW}
                brandHeight={landscapeBrandH}
                onLoadStart={() => {}}
                onLoadEnd={() => {}}
                onError={onWebError}
                onHttpError={onWebHttpError}
              />
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.landscapeClose,
              {
                top: Math.max(insets.top, 12) + 8,
                right: Math.max(insets.right, 12) + 8,
              },
            ]}
            onPress={() => setLandscapeOpen(false)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={collapseLabel}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: 0,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 0,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  surfaceFill: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  expandBtn: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    zIndex: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  landscapeRoot: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  landscapeStage: {
    backgroundColor: '#000',
    overflow: 'hidden',
    // Rotate so pitch reads as landscape while app stays portrait-locked.
    transform: [{ rotate: '90deg' }],
  },
  landscapeClose: {
    position: 'absolute',
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCover: {
    position: 'absolute',
    left: '50%',
    top: '58%',
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandPatch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    opacity: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    backgroundColor: '#0b1220',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#8b5cf6',
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
