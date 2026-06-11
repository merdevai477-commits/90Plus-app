import React, { forwardRef, useCallback } from 'react';
import { Linking, Platform, StyleSheet, type ViewStyle } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import {
  isAllowedWorldCupNewsUrl,
  NEWS_WEBVIEW_INJECTED_JS,
  parseNewsWebViewMessage,
  WORLD_CUP_NEWS_URL,
} from '../../utils/worldCupNewsWebView';

export type WorldCupNewsWebViewRef = WebView;

interface WorldCupNewsWebViewProps {
  style?: ViewStyle;
  onCanGoBackChange?: (canGoBack: boolean) => void;
  onLoadingChange?: (loading: boolean) => void;
  onError?: () => void;
}

/**
 * Cross-platform WebView for 90plus.pro/news.
 * Props are kept minimal — Android Fabric crashes if iOS-only string props
 * (e.g. decelerationRate="normal") are passed.
 */
export const WorldCupNewsWebView = forwardRef<WebView, WorldCupNewsWebViewProps>(
  function WorldCupNewsWebView(
    { style, onCanGoBackChange, onLoadingChange, onError },
    ref,
  ) {
    const handleNavChange = useCallback(
      (nav: WebViewNavigation) => {
        onCanGoBackChange?.(nav.canGoBack);
        onLoadingChange?.(nav.loading);
      },
      [onCanGoBackChange, onLoadingChange],
    );

    const openExternalUrl = useCallback((url: string) => {
      void Linking.openURL(url).catch(() => {});
    }, []);

    const shouldStartLoad = useCallback(
      (request: { url: string }) => {
        if (isAllowedWorldCupNewsUrl(request.url)) return true;
        openExternalUrl(request.url);
        return false;
      },
      [openExternalUrl],
    );

    const handleMessage = useCallback(
      (event: { nativeEvent: { data: string } }) => {
        const msg = parseNewsWebViewMessage(event.nativeEvent.data);
        if (msg?.type === 'OPEN_EXTERNAL') {
          openExternalUrl(msg.url);
        }
      },
      [openExternalUrl],
    );

    return (
      <WebView
        ref={ref}
        source={{ uri: WORLD_CUP_NEWS_URL }}
        style={[styles.webview, style]}
        onNavigationStateChange={handleNavChange}
        onShouldStartLoadWithRequest={shouldStartLoad}
        onMessage={handleMessage}
        onLoadStart={() => onLoadingChange?.(true)}
        onLoadEnd={() => onLoadingChange?.(false)}
        onError={() => {
          onLoadingChange?.(false);
          onError?.();
        }}
        onHttpError={() => {
          onLoadingChange?.(false);
        }}
        injectedJavaScript={NEWS_WEBVIEW_INJECTED_JS}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        showsVerticalScrollIndicator={false}
        {...(Platform.OS === 'ios'
          ? {
              allowsBackForwardNavigationGestures: true,
              pullToRefreshEnabled: true,
              decelerationRate: 'normal' as const,
            }
          : {})}
      />
    );
  },
);

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#0c0b18',
  },
});
