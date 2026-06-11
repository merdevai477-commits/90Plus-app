import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import { ChevronLeft } from 'lucide-react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

import { WorldCupNewsWebView } from '../components/news/WorldCupNewsWebView';
import { APP_BG } from '../constants/ui';
import {
  PURPLE_SOFT,
  SCREEN_PADDING_H,
  TEXT_PRIMARY,
} from '../constants/tokens';
import { useTranslation } from '../src/i18n';

const HeaderGlass: typeof LiquidGlassView | typeof BlurView =
  isLiquidGlassSupported ? LiquidGlassView : BlurView;

const headerGlassProps = isLiquidGlassSupported
  ? { effect: 'clear' as const, interactive: true }
  : { intensity: 22, tint: 'dark' as const };

const HEADER_BODY_HEIGHT = 64;

export default function WorldCupNewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleBack = useCallback(() => {
    if (canGoBack) {
      webRef.current?.goBack();
      return true;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/rank');
    }
    return true;
  }, [canGoBack, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => sub.remove();
  }, [handleBack]);

  const toggleWebLang = useCallback(() => {
    webRef.current?.injectJavaScript(
      "document.getElementById('lang-toggle')?.click(); true;",
    );
  }, []);

  const headerTop = Math.max(insets.top, 10) + 8;
  const webTopInset = headerTop + HEADER_BODY_HEIGHT;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <WorldCupNewsWebView
        ref={webRef}
        style={{ marginTop: webTopInset }}
        onCanGoBackChange={setCanGoBack}
        onLoadingChange={setLoading}
      />

      {loading ? (
        <View style={[styles.loader, { top: webTopInset }]} pointerEvents="none">
          <ActivityIndicator size="large" color={PURPLE_SOFT} />
        </View>
      ) : null}

      <HeaderGlass
        {...headerGlassProps}
        style={[styles.header, { paddingTop: headerTop }]}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.75}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t.rank.worldCup.newsBack}
          >
            <ChevronLeft color={TEXT_PRIMARY} size={22} strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>{t.rank.worldCup.newsScreenEyebrow}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {t.rank.worldCup.newsScreenTitle}
            </Text>
          </View>

          <TouchableOpacity
            onPress={toggleWebLang}
            activeOpacity={0.82}
            style={styles.langBtn}
            accessibilityRole="button"
            accessibilityLabel={t.rank.worldCup.newsLangToggle}
          >
            <Text style={styles.langBtnTxt}>{t.rank.worldCup.newsLangLabel}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.hairline} />
      </HeaderGlass>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_BG,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,11,24,0.35)',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: Platform.OS === 'android' ? 'rgba(6,4,10,0.5)' : 'transparent',
  },
  headerInner: {
    minHeight: HEADER_BODY_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING_H,
    gap: 10,
    paddingVertical: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: PURPLE_SOFT,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  langBtn: {
    minWidth: 44,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
  },
  langBtnTxt: {
    color: PURPLE_SOFT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
