import React, { forwardRef, useCallback, useRef } from 'react';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import {
  isAllowedWorldCupNewsUrl,
  NEWS_WEBVIEW_INJECTED_JS,
  NEWS_WEBVIEW_INJECTED_JS_BEFORE_LOAD,
  normalizeExternalNewsUrl,
  parseNewsWebViewMessage,
  WORLD_CUP_NEWS_ORIGIN_WHITELIST,
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
    const webViewRef = useRef<WebView>(null);

    const setWebViewRef = useCallback(
      (instance: WebView | null) => {
        webViewRef.current = instance;
        if (typeof ref === 'function') {
          ref(instance);
        } else if (ref) {
          ref.current = instance;
        }
      },
      [ref],
    );

    const openExternalUrl = useCallback((rawUrl: string) => {
      const url = normalizeExternalNewsUrl(rawUrl);
      if (!url) return;
      void openBrowserAsync(url, {
        presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
        enableBarCollapsing: true,
        showInRecents: false,
      }).catch(() => {});
    }, []);

    const handleNavChange = useCallback(
      (nav: WebViewNavigation) => {
        if (!isAllowedWorldCupNewsUrl(nav.url)) {
          webViewRef.current?.stopLoading();
          openExternalUrl(nav.url);
          if (nav.canGoBack) {
            webViewRef.current?.goBack();
          } else {
            webViewRef.current?.injectJavaScript(
              `window.location.replace('${WORLD_CUP_NEWS_URL}'); true;`,
            );
          }
          onCanGoBackChange?.(false);
          onLoadingChange?.(false);
          return;
        }
        onCanGoBackChange?.(nav.canGoBack);
        onLoadingChange?.(nav.loading);
      },
      [openExternalUrl, onCanGoBackChange, onLoadingChange],
    );

    const shouldStartLoad = useCallback(
      (request: { url: string; isTopFrame?: boolean }) => {
        if (Platform.OS === 'ios' && request.isTopFrame === false) {
          openExternalUrl(request.url);
          return false;
        }
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
        ref={setWebViewRef}
        source={{ uri: WORLD_CUP_NEWS_URL }}
        style={[styles.webview, style]}
        originWhitelist={[...WORLD_CUP_NEWS_ORIGIN_WHITELIST]}
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
        injectedJavaScriptBeforeContentLoaded={NEWS_WEBVIEW_INJECTED_JS_BEFORE_LOAD}
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
