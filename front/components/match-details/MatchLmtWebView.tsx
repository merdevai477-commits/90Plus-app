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
  /** Backend HTML embed URL (iframes official GetWidget). */
  embedUrl: string;
  /** Direct 365 GetWidget URL — used as fallback if embed fails. */
  widgetUrl?: string | null;
  aspectRatio?: number | null;
  unavailableLabel?: string;
  loadingLabel?: string;
  retryLabel?: string;
};

/**
 * WebView that loads our LMT HTML shell (iframe → lmtsrcf GetWidget).
 */
export function MatchLmtWebView({
  embedUrl,
  widgetUrl,
  aspectRatio,
  unavailableLabel = 'Live tracking is not available for this match.',
  loadingLabel = 'Loading tracking…',
  retryLabel = 'Retry',
}: MatchLmtWebViewProps) {
  const { width } = useWindowDimensions();
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const frameWidth = Math.max(280, width - 32);
  const frameHeight = Math.round(frameWidth / ratio);

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const uri = useMemo(() => {
    if (useFallback && widgetUrl) return widgetUrl;
    return embedUrl;
  }, [embedUrl, widgetUrl, useFallback]);

  const handleRetry = useCallback(() => {
    setFailed(false);
    setLoading(true);
    if (failed && widgetUrl && !useFallback) {
      setUseFallback(true);
    }
    setReloadKey((k) => k + 1);
  }, [failed, widgetUrl, useFallback]);

  if (!uri) {
    return (
      <View style={[styles.empty, { minHeight: frameHeight }]}>
        <Ionicons name="football-outline" size={36} color="#6b7280" />
        <Text style={styles.emptyText}>{unavailableLabel}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { height: frameHeight }]}>
      {loading && !failed ? (
        <View style={styles.overlay}>
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
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          nestedScrollEnabled
          scrollEnabled
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
          onHttpError={() => {
            setLoading(false);
            setFailed(true);
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
    marginBottom: 16,
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
  empty: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
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
