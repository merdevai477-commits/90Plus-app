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
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { AuthHeroBlock } from './AuthHeroBlock';
import { AUTH_PANEL_BG, AUTH_PANEL_BORDER } from './AuthTokens';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const heroImg = require('../../../assets/images/auth-hero.jpg') as number;

type Props = {
  children: React.ReactNode;
  showHero?: boolean;
};

const rootStyle: ViewStyle = { flex: 1, backgroundColor: '#000' };

const photoSlotStyle: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 0,
};

const bgimgStyle: ViewStyle = { flex: 1, width: '100%', height: '100%' };

const bgimgAssetStyle: ImageStyle = {
  height: '108%',
  transform: [{ translateY: -20 }],
};

const fillV: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const keyboardStyle: ViewStyle = { flex: 1, zIndex: 1 };

const scrollContentBase: ViewStyle = {
  flexGrow: 1,
  paddingHorizontal: 20,
  paddingTop: 8,
};

const panelOuter: ViewStyle = {
  marginTop: 8,
  borderRadius: 40,
  borderWidth: 0.5,
  borderColor: AUTH_PANEL_BORDER,
  overflow: 'hidden',
  backgroundColor: 'rgba(0,0,0,0.8)',
};

const panelInner: ViewStyle = {
  paddingHorizontal: 20,
  paddingTop: 38,
  paddingBottom: 24,
};

export function AuthScreenShell({ children, showHero = true }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const imgH = Math.min(height * 0.42, 391);

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
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', '#000']}
            locations={[0.58, 0.85, 1]}
            style={fillV}
          />
        </ImageBackground>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={keyboardStyle}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            scrollContentBase,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          {showHero ? <AuthHeroBlock /> : <View style={{ height: 48 }} />}

          <View style={panelOuter}>
            <BlurView intensity={12} tint="dark" style={fillV} />
            <View style={[fillV, { backgroundColor: AUTH_PANEL_BG }]} />
            <View style={panelInner}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const _unused = StyleSheet.create({});
void _unused;
