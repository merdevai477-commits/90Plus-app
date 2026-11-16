import React from 'react';
import {
  View,
  ScrollView,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { AuthBrandHeader } from './AuthBrandHeader';
import { AuthScaleProvider, getAuthLayoutMetrics } from './authLayoutMetrics';
import { AuthThemeProvider, useAuthTheme } from './useAuthTheme';
import { useTranslation } from '@/src/i18n';

type Props = {
  children: React.ReactNode;
  /**
   * Hides the close button on a screen that must not be dismissable.
   */
  hideClose?: boolean;
  /** Optional brand header copy override (e.g. signup journey lines). */
  brandTitleLines?: [string, string];
  brandTagline?: string;
};

function AuthScreenShellInner({
  children,
  hideClose,
  brandTitleLines,
  brandTagline,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useTranslation();
  const isRTL = language === 'ar';
  const { width, height } = useWindowDimensions();
  const metrics = getAuthLayoutMetrics(width, height);
  const { s, panelOverlap, panelDropOffset, panelPaddingX, contentWidth } =
    metrics;
  const { colors } = useAuthTheme();

  const canClose = !hideClose && router.canGoBack();

  return (
    <AuthScaleProvider value={metrics}>
      <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
        <StatusBar style={colors.statusBar} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom: Math.max(insets.bottom, 16) + s(24),
            },
          ]}
        >
          <View style={[styles.column, { width: contentWidth }]}>
            <AuthBrandHeader
              titleLines={brandTitleLines}
              tagline={brandTagline}
            />

            <View
              style={[
                styles.panelOuter,
                {
                  marginTop: -panelOverlap + panelDropOffset,
                  paddingHorizontal: panelPaddingX,
                  borderRadius: s(29),
                  paddingTop: s(30),
                  paddingBottom: s(28),
                  backgroundColor: colors.cardBg,
                  borderColor: colors.cardBorder,
                  borderWidth: colors.cardBorder === 'transparent' ? 0 : 0.5,
                },
              ]}
            >
              <View style={styles.panelBody}>{children}</View>
            </View>
          </View>
        </ScrollView>

        {canClose ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'إغلاق' : 'Close'}
            testID="auth-close"
            hitSlop={12}
            style={({ pressed }) => [
              styles.close,
              {
                top: insets.top + s(12),
                width: s(44),
                height: s(44),
                borderRadius: s(22),
                backgroundColor: colors.closeBg,
                borderColor: colors.closeBorder,
              },
              isRTL
                ? { right: Math.max(insets.right, s(20)) }
                : { left: Math.max(insets.left, s(20)) },
              pressed && styles.closePressed,
            ]}
          >
            <X size={s(22)} color={colors.closeIcon} strokeWidth={2.25} />
          </Pressable>
        ) : null}
      </View>
    </AuthScaleProvider>
  );
}

/**
 * Pre-login shell matching Figma Authentication frames:
 * purple brand header + elevated form card with theme (light / dark / system).
 */
export function AuthScreenShell(props: Props) {
  return (
    <AuthThemeProvider>
      <AuthScreenShellInner {...props} />
    </AuthThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
  },
  column: {
    alignSelf: 'center',
  },
  panelOuter: {
    width: '100%',
    overflow: 'hidden',
    minHeight: 520,
  },
  panelBody: {
    width: '100%',
  },
  close: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 30,
  },
  closePressed: {
    opacity: 0.7,
  },
});
