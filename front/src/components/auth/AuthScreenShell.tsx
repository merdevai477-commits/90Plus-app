import React from 'react';
import {
  View,
  ImageBackground,
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
import {
  AUTH_PANEL_BG,
  AUTH_PANEL_BORDER,
  AUTH_PANEL_DARK,
} from './AuthTokens';
import { AUTH_V2_ASSETS } from './authV2Assets';
import { AuthScaleProvider, getAuthLayoutMetrics } from './authLayoutMetrics';
import { useTranslation } from '@/src/i18n';

type Props = {
  children: React.ReactNode;
  /**
   * Hides the close button on a screen that must not be dismissable. Nothing
   * passes this today — it exists so turning the affordance off is a deliberate
   * decision at a call site rather than an omission in this file.
   */
  hideClose?: boolean;
};

/**
 * =============================================================================
 * THE SHELL EVERY PRE-LOGIN SCREEN SITS IN
 * =============================================================================
 * Sign up, Log in and Forgot password all render inside this. The Figma frame
 * (448 × 1154) is a hero composite with a rounded panel riding up over it.
 *
 * ── THE CLOSE BUTTON IS NOT DECORATION ───────────────────────────────────────
 * `/auth` is PUSHED from inside the signed-in app in half a dozen places — the
 * chat tab's sign-in prompt, a prediction, someone's profile, the quiz hub — so
 * a visitor who taps "Sign in" to see what it is lands here. This shell had no
 * back or close affordance at all and the auth stack sets `headerShown: false`,
 * so on iOS there was no way out except force-quitting; on Android the hardware
 * key was the only escape. The button is drawn only when there is genuinely
 * somewhere to go back TO, so it never appears on a cold start where `/auth` is
 * the first screen.
 *
 * ── RESPONSIVENESS ───────────────────────────────────────────────────────────
 * Every measurement comes from ./authLayoutMetrics, on ONE clamped scale, so
 * the hero and the panel can no longer disagree about how big the screen is.
 * See that file for the sizes and why they are bounded the way they are.
 *
 * The keyboard is handled by the ScrollView rather than a KeyboardAvoidingView:
 *   • iOS  — `automaticallyAdjustKeyboardInsets` insets the scroll content by
 *            the real keyboard frame, which is correct at every screen size.
 *            The KeyboardAvoidingView this replaced used `behavior="padding"`
 *            around a ScrollView, which pads the OUTER box: it shrinks the
 *            viewport instead of scrolling to the focused field, and on short
 *            phones that pushed the password field under the keyboard.
 *   • Android — app.json sets `softwareKeyboardLayoutMode: "resize"`, so the
 *            window is already resized and the ScrollView simply gets shorter.
 * =============================================================================
 */
export function AuthScreenShell({ children, hideClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL } = useTranslation();
  const { width, height } = useWindowDimensions();
  const metrics = getAuthLayoutMetrics(width, height);
  const {
    s,
    heroHeight,
    panelOverlap,
    panelDropOffset,
    horizontalInset,
    panelPaddingX,
    contentWidth,
  } = metrics;

  // Only offer a way out when there is one. `canGoBack` is false when `/auth`
  // is the first screen of the session (a cold start on a signed-out device).
  const canClose = !hideClose && router.canGoBack();

  return (
    <AuthScaleProvider value={metrics}>
      <View style={styles.root}>
        <StatusBar style="light" />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[
            styles.scroll,
            {
              // The panel's own bottom edge clears the home indicator, and the
              // extra breathing room keeps the footer link off the very edge on
              // a phone with no inset at all.
              paddingBottom: Math.max(insets.bottom, 16) + s(24),
            },
          ]}
        >
          {/* Centred column so a tablet or a landscape phone gets a readable
              width instead of a stretched phone layout. */}
          <View style={[styles.column, { width: contentWidth }]}>
            <View style={[styles.heroWrap, { height: heroHeight }]}>
              <ImageBackground
                source={AUTH_V2_ASSETS.hero}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            </View>

            <View
              style={[
                styles.panelOuter,
                {
                  marginTop: -panelOverlap + panelDropOffset,
                  marginHorizontal: horizontalInset,
                  paddingHorizontal: panelPaddingX,
                  borderRadius: s(50),
                  paddingTop: s(40),
                  paddingBottom: s(28),
                },
              ]}
            >
              <View style={styles.panelDark} />
              <View style={styles.panelTint} />
              <View style={styles.panelBody}>{children}</View>
            </View>
          </View>
        </ScrollView>

        {/*
          Pinned to the window, NOT to the scroll content: it has to stay
          reachable after the player scrolls down to the Sign Up button, and it
          must sit below the notch / Dynamic Island on every device. Rendered
          last so it draws over the hero.
        */}
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
              },
              isRTL
                ? { right: Math.max(insets.right, s(20)) }
                : { left: Math.max(insets.left, s(20)) },
              pressed && styles.closePressed,
            ]}
          >
            <X size={s(22)} color="#fff" strokeWidth={2.25} />
          </Pressable>
        ) : null}
      </View>
    </AuthScaleProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
  },
  column: {
    // The hero is full-bleed inside the column, so the column itself carries no
    // padding — the panel supplies its own inset.
    alignSelf: 'center',
  },
  heroWrap: {
    width: '100%',
    overflow: 'hidden',
  },
  panelOuter: {
    borderWidth: 0.5,
    borderColor: AUTH_PANEL_BORDER,
    overflow: 'hidden',
  },
  panelDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AUTH_PANEL_DARK,
  },
  panelTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AUTH_PANEL_BG,
  },
  panelBody: {
    width: '100%',
  },
  close: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 6, 24, 0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 30,
  },
  closePressed: {
    opacity: 0.7,
  },
});
