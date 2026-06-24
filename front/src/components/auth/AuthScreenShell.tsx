import React from 'react';
import {
  View,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  heroTitle?: string;
  heroSubtitle?: string;
};

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

const mainContentStyle: ViewStyle = {
  flex: 1,
  paddingHorizontal: 20,
};

const panelBase: ViewStyle = {
  backgroundColor: 'transparent',
  borderRadius: 20,
  borderTopLeftRadius: 22,
  borderTopRightRadius: 22,
  paddingHorizontal: 20,
  paddingTop: 8,
  paddingBottom: 10,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
};

const panelCompactStyle: ViewStyle = {
  paddingTop: 18,
  paddingBottom: 14,
};

const fillV: ViewStyle = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
};

const panelBlurClipStyle: ViewStyle = {
  ...fillV,
  borderRadius: 20,
  borderTopLeftRadius: 22,
  borderTopRightRadius: 22,
  overflow: 'hidden',
};

export function AuthScreenShell({
  heroMode = 'full',
  children,
  panelOffset,
  heroTitle,
  heroSubtitle,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isCompact = heroMode === 'compact';
  const imgH = isCompact
    ? height
    : Math.min(height * (heroMode === 'full' ? 0.46 : 0.72), heroMode === 'full' ? 380 : 480);
  const shadowBandTop = Math.max(0, imgH - 72);
  const contentTop = isCompact ? 0 : Math.max(insets.top, 16) + 8;

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

      <LinearGradient
        colors={[`${BG_BASE}00`, BG_BASE]}
        locations={[0, 0.12]}
        style={[shadowBandBase, { top: shadowBandTop }]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={keyboardStyle}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View
          style={[
            mainContentStyle,
            isCompact && { justifyContent: 'flex-end' },
            {
              paddingTop: contentTop,
              paddingBottom: Math.max(insets.bottom, isCompact ? 16 : 10),
            },
          ]}
        >
          {!isCompact && heroMode !== 'none' ? (
            <AuthHeroBlock compact={false} subtitle={heroSubtitle} />
          ) : !isCompact && heroMode === 'none' ? (
            <View style={{ height: 4 }} />
          ) : null}

          <View
            style={[
              panelBase,
              isCompact && panelCompactStyle,
              !isCompact && {
                marginTop: panelOffset ?? (heroMode === 'full' ? 6 : 8),
              },
            ]}
          >
            <View style={panelBlurClipStyle} pointerEvents="none">
              <BlurView intensity={10} tint="dark" style={fillV} />
            </View>
            {isCompact ? (
              <AuthHeroBlock
                compact
                embedded
                title={heroTitle}
                subtitle={heroSubtitle}
              />
            ) : null}
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const _unused = StyleSheet.create({});
void _unused;
