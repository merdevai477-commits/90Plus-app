import React, { useMemo, useState, useCallback } from 'react';
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

type MatchLmtWebViewProps = {
  /** Official 365 GetWidget URL — primary source for RN WebView. */
  widgetUrl: string;
  /** Optional backend HTML shell (nested iframe — fallback only). */
  embedUrl?: string | null;
  aspectRatio?: number | null;
  unavailableLabel?: string;
  loadingLabel?: string;
  retryLabel?: string;
};

/**
 * WebView for live pitch tracking.
 * Loads lmtsrcf GetWidget directly (reliable on mobile); score card stays above.
 */
export function MatchLmtWebView({
  widgetUrl,
  embedUrl,
  aspectRatio,
  unavailableLabel = 'Live tracking is not available for this match.',
  loadingLabel = 'Loading tracking…',
  retryLabel = 'Retry',
}: MatchLmtWebViewProps) {
  const { width } = useWindowDimensions();
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const frameWidth = Math.max(280, width - 32);
  const frameHeight = Math.max(220, Math.round(frameWidth / ratio));

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const uri = useMemo(() => {
    if (useEmbedFallback && embedUrl) return embedUrl;
    return widgetUrl;
  }, [widgetUrl, embedUrl, useEmbedFallback]);

  const handleRetry = useCallback(() => {
    setFailed(false);
    setLoading(true);
    if (failed && embedUrl && !useEmbedFallback) {
      setUseEmbedFallback(true);
    }
    setReloadKey((k) => k + 1);
  }, [failed, embedUrl, useEmbedFallback]);

  if (!uri?.trim()) {
    return null;
  }

  return (
    <View style={[styles.card, { height: frameHeight }]}>
      {loading && !failed ? (
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
      ) : (
        <WebView
          key={`${uri}-${reloadKey}`}
          source={{ uri }}
          style={styles.webview}
          originWhitelist={['https://*', 'http://*']}
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
            setLoading(false);
            setFailed(true);
          }}
          onHttpError={(e) => {
            const code = e.nativeEvent?.statusCode ?? 0;
            if (code >= 400) {
              setLoading(false);
              setFailed(true);
            }
          }}
          {...(Platform.OS === 'ios'
            ? { allowsBackForwardNavigationGestures: false }
            : {})}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
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
