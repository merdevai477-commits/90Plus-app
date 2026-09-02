import React from 'react';
import {
  View,
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  AUTH_PANEL_BG,
  AUTH_PANEL_BORDER,
  AUTH_PANEL_DARK,
} from './AuthTokens';
import { AUTH_V2_ASSETS } from './authV2Assets';
import { getAuthLayoutMetrics } from './authLayoutMetrics';

type Props = {
  children: React.ReactNode;
};

/**
 * Full Figma auth screen shell (448×1154):
 * - Hero image 391px tall (composite PNG with branding)
 * - Panel 408px wide, overlaps hero by 27px, rounded 40, purple tint
 */
export function AuthScreenShell({ children }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { heroHeight, panelOverlap, horizontalInset, panelPaddingX } =
    getAuthLayoutMetrics(width, height);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, 16) + 24 },
          ]}
        >
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
                marginTop: -panelOverlap,
                marginHorizontal: horizontalInset,
                paddingHorizontal: panelPaddingX,
              },
            ]}
          >
            <View style={styles.panelDark} />
            <View style={styles.panelTint} />
            <View style={styles.panelBody}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  heroWrap: {
    width: '100%',
    overflow: 'hidden',
  },
  panelOuter: {
    borderRadius: 40,
    borderWidth: 0.5,
    borderColor: AUTH_PANEL_BORDER,
    overflow: 'hidden',
    paddingTop: 44,
    paddingBottom: 28,
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
});
