import React from 'react';
import {
  View,
  ImageBackground,
  Pressable,
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
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { AuthHeroBlock } from './AuthHeroBlock';
import { BG_BASE } from '../../../constants/tokens';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const heroImg = require('../../../assets/images/auth-hero.png') as number;

type Props = {
  heroMode?: 'full' | 'compact' | 'none';
  children: React.ReactNode;
  panelOffset?: number;
};

// ─── Typed style objects ──────────────────────────────────────────────────────
// StyleSheet.create() returns a union type (ViewStyle | TextStyle | ImageStyle)
// which conflicts with strict component style props in RN 0.83+.
// Defining styles as explicit typed constants avoids the overload mismatch.

const rootStyle: ViewStyle = { flex: 1, backgroundColor: BG_BASE };

const photoSlotStyle: ViewStyle = {
  position: 'absolute', top: 5, left: 0, right: 0, zIndex: 0,
};

const bgimgStyle: ViewStyle = { flex: 1, width: '100%', height: '100%' };

const bgimgAssetStyle: ImageStyle = {
  height: '108%',
  transform: [{ translateY: -28 }, { translateX: -5 }],
};

const shadowBandBase: ViewStyle = {
  position: 'absolute', left: 0, right: 0, height: 120, zIndex: 0,
};

const keyboardStyle: ViewStyle = { flex: 1, zIndex: 1 };

const scrollContentBase: ViewStyle = {
  flexGrow: 1, paddingHorizontal: 20, paddingTop: 52,
};

const closeStyle: ViewStyle = {
  position: 'absolute',
  right: 20,
  zIndex: 10,
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.4)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  overflow: 'hidden',
};

const closeInnerStyle: ViewStyle = { justifyContent: 'center', alignItems: 'center' };

const panelBase: ViewStyle = {
  flex: 1,
  marginTop: -55,
  backgroundColor: 'transparent',
  overflow: 'hidden',
  borderRadius: 20,
  borderTopLeftRadius: 22,
  borderTopRightRadius: 22,
  paddingHorizontal: 20,
  paddingTop: 26,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
};

// absoluteFill as a plain ViewStyle object (no StyleSheet registration needed)
const fillV: ViewStyle = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AuthScreenShell({ heroMode = 'full', children, panelOffset }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const imgH = Math.min(height * 0.90, 550);
  const shadowBandTop = Math.max(0, imgH - 72);

  return (
    <View style={rootStyle}>
      <StatusBar style="light" />

      <View style={[photoSlotStyle, { height: imgH }]}>
        <ImageBackground
          source={heroImg}
          style={bgimgStyle}
          imageStyle={bgimgAssetStyle}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(11,11,21,0.15)', 'rgba(11,11,21,0.55)', 'rgba(6,5,14,1)']}
            locations={[0, 0.45, 1]}
            style={fillV}
          />
        </ImageBackground>
      </View>

      <Pressable
        style={[closeStyle, { top: Math.max(insets.top, 20) + 10, left: 20 }]}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }}
      >
        <BlurView intensity={20} tint="dark" style={fillV} />
        <View style={closeInnerStyle}>
          <X color="#fff" size={20} strokeWidth={1.5} />
        </View>
      </Pressable>

      <LinearGradient
        colors={[`${BG_BASE}00`, BG_BASE]}
        locations={[0, 0.12]}
        style={[shadowBandBase, { top: shadowBandTop }]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={keyboardStyle}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            scrollContentBase,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          {heroMode !== 'none' ? (
            <AuthHeroBlock compact={heroMode === 'compact'} />
          ) : (
            <View style={{ height: 8 }} />
          )}

          <View
            style={[
              panelBase,
              { paddingBottom: Math.max(insets.bottom, 16) },
              panelOffset !== undefined ? { marginTop: panelOffset } : undefined,
            ]}
          >
            <BlurView intensity={10} tint="dark" style={fillV} />
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Keep StyleSheet for any future additions — not used above to avoid union type issues
const _unused = StyleSheet.create({});
void _unused;
