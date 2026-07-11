import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { PitchBrandLogo } from './PitchBrandLogo';
import {
  fetchBrandedLmtHtml,
  LMT_WIDGET_BASE_ORIGIN,
} from '../../services/lmt.service';

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
};

type LoadMode = 'html' | 'uri';

/**
 * Live Match Tracker WebView — DD-style branding:
 * 1) fetch GetWidget HTML
 * 2) replace pitchLogo / goalBannerImage / vlmtCourtBannerUrl
 * 3) render via source={{ html, baseUrl }}
 * Overlay + uri only if that path fails.
 */
export function MatchLmtWebView({
  widgetUrl,
  embedUrl,
  aspectRatio,
  variant = 'hero',
  hideBrand = false,
  brandLogoUrl = null,
  coverBrand = true,
  unavailableLabel = 'Live tracking is not available for this match.',
  loadingLabel = 'Loading tracking…',
  retryLabel = 'Retry',
}: MatchLmtWebViewProps) {
  const { width } = useWindowDimensions();
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const sidePad = 16;
  const frameWidth = variant === 'hero'
    ? width
    : Math.max(280, width - sidePad * 2);
  const frameHeight = Math.max(
    variant === 'hero' ? 300 : 220,
    Math.round(frameWidth / ratio) + (variant === 'hero' ? 48 : 0),
  );

  const brandWidth = Math.min(220, Math.round(frameWidth * 0.58));
  const brandHeight = Math.round(brandWidth * (90 / 240));

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<LoadMode>('html');
  const [brandedHtml, setBrandedHtml] = useState<string | null>(null);
  const [uriFallback, setUriFallback] = useState(widgetUrl);

  const prepareHtml = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    setMode('html');
    setBrandedHtml(null);
    try {
      const html = await fetchBrandedLmtHtml(widgetUrl, { hideBrand, brandLogoUrl });
      setBrandedHtml(html);
      setMode('html');
    } catch {
      // DD fallback path: load licensed GetWidget URI + optional visual cover
      setBrandedHtml(null);
      setMode('uri');
      setUriFallback(widgetUrl);
    }
  }, [widgetUrl, hideBrand, brandLogoUrl]);

  useEffect(() => {
    void prepareHtml();
  }, [prepareHtml, reloadKey]);

  const handleRetry = useCallback(() => {
    // First retry: re-fetch branded HTML. Second path already uses uri.
    if (mode === 'uri' && embedUrl && uriFallback === widgetUrl) {
      setUriFallback(embedUrl);
      setReloadKey((k) => k + 1);
      setFailed(false);
      setLoading(true);
      return;
    }
    setReloadKey((k) => k + 1);
  }, [mode, embedUrl, uriFallback, widgetUrl]);

  const webSource = useMemo(() => {
    if (mode === 'html' && brandedHtml) {
      return {
        html: brandedHtml,
        baseUrl: `${LMT_WIDGET_BASE_ORIGIN}/`,
      };
    }
    return { uri: uriFallback };
  }, [mode, brandedHtml, uriFallback]);

  const showOverlayFallback = coverBrand && mode === 'uri' && !loading && !failed;

  if (!widgetUrl?.trim()) {
    return null;
  }

  // Still preparing branded HTML — keep spinner until we have html or switched to uri
  const waitingForHtml = mode === 'html' && !brandedHtml && !failed;

  return (
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
      ) : brandedHtml || mode === 'uri' ? (
        <>
          <WebView
            key={`${mode}-${reloadKey}-${mode === 'html' ? 'html' : uriFallback}`}
            source={webSource}
            style={styles.webview}
            originWhitelist={['https://*', 'http://*', 'about:blank']}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            nestedScrollEnabled
            scrollEnabled={false}
            startInLoadingState={false}
            onLoadStart={() => {
              setLoading(true);
              setFailed(false);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              if (mode === 'html') {
                // HTML injection failed at render — drop to official URI
                setMode('uri');
                setBrandedHtml(null);
                setUriFallback(widgetUrl);
                setLoading(true);
                return;
              }
              setLoading(false);
              setFailed(true);
            }}
            onHttpError={(e) => {
              const code = e.nativeEvent?.statusCode ?? 0;
              if (code < 400) return;
              if (mode === 'html') {
                setMode('uri');
                setBrandedHtml(null);
                setUriFallback(widgetUrl);
                setLoading(true);
                return;
              }
              setLoading(false);
              setFailed(true);
            }}
            {...(Platform.OS === 'ios'
              ? { allowsBackForwardNavigationGestures: false }
              : {})}
          />

          {/* Overlay only when branded HTML path failed */}
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
        </>
      ) : null}
    </View>
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
  webview: {
    flex: 1,
    backgroundColor: '#000',
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
