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
import { AUTH_PANEL_BG, AUTH_PANEL_BORDER } from './AuthTokens';
import { AUTH_V2_ASSETS } from './authV2Assets';

type Props = {
  children: React.ReactNode;
  showHero?: boolean;
};

/** Figma hero frame height (node 1015:3722). */
const HERO_HEIGHT = 391;
/** Panel overlaps hero bottom edge. */
const PANEL_OVERLAP = 48;

const rootStyle: ViewStyle = { flex: 1, backgroundColor: '#000' };

export function AuthScreenShell({ children, showHero = true }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroHeight = Math.min(HERO_HEIGHT, height * 0.34);

  const bgimgAssetStyle: ImageStyle = {
    height: '108%',
    transform: [{ translateY: -12 }],
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
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.92)']}
            locations={[0.55, 0.8, 1]}
            style={StyleSheet.absoluteFill}
          />
          {showHero ? (
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
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Math.max(insets.bottom, 24),
              marginTop: -PANEL_OVERLAP,
            },
          ]}
        >
          <View style={styles.panelOuter}>
            <View style={styles.panelFill} />
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
  panelFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AUTH_PANEL_BG,
  },
  panelInner: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 28,
  },
});
