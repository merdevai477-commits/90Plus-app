import React from 'react';
import {
  View,
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthHeroBlock } from './AuthHeroBlock';
import {
  AUTH_PANEL_BG,
  AUTH_PANEL_BORDER,
  AUTH_PANEL_DARK,
} from './AuthTokens';
import { AUTH_V2_ASSETS } from './authV2Assets';

type Props = {
  children: React.ReactNode;
  /** Show dynamic logo/text overlay — off when hero PNG already includes branding. */
  showHeroOverlay?: boolean;
};

/** Figma hero frame height (node 1015:3722). */
const HERO_HEIGHT = 391;
/** Panel overlaps hero bottom edge. */
const PANEL_OVERLAP = 56;

const rootStyle: ViewStyle = { flex: 1, backgroundColor: '#000' };

export function AuthScreenShell({
  children,
  showHeroOverlay = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroHeight = Math.min(HERO_HEIGHT, Math.round(height * 0.36));

  const bgimgAssetStyle: ImageStyle = {
    width: '100%',
    height: '100%',
  };

  return (
    <View style={rootStyle}>
      <StatusBar style="light" />

      <View style={{ height: heroHeight, width: '100%' }}>
        <ImageBackground
          source={AUTH_V2_ASSETS.hero}
          style={StyleSheet.absoluteFill}
          imageStyle={bgimgAssetStyle}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.75)']}
            locations={[0.5, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />
          {showHeroOverlay ? (
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
              <AuthHeroBlock />
            </View>
          ) : null}
        </ImageBackground>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 32,
              marginTop: -PANEL_OVERLAP,
            },
          ]}
        >
          <View style={styles.panelOuter}>
            <View style={styles.panelDark} />
            <View style={styles.panelTint} />
            <View style={styles.panelInner}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  panelOuter: {
    borderRadius: 40,
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
  panelInner: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 24,
  },
});
