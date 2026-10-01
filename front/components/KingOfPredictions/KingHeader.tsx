import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlurIntensity } from '../../constants/theme';
import { useCoins } from '../../contexts/CoinsContext';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { LiquidGlassView, isLiquidGlassSupported } from '../../utils/liquidGlassSafe';
import { KING_ICON } from './assets';

const ISLAND_TINT = 'rgba(48,48,48,0.2)';

function GlassIsland({
  style,
  accessibilityLabel,
  children,
}: {
  style: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children: React.ReactNode;
}) {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        {...({
          style: [styles.island, style],
          effect: 'regular',
          tint: ISLAND_TINT,
          colorScheme: 'dark',
          accessibilityLabel,
        } as object)}
      >
        {children}
      </LiquidGlassView>
    );
  }

  return (
    <View style={[styles.island, styles.islandFallback, style]} accessibilityLabel={accessibilityLabel}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={BlurIntensity.header} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.08)']}
        locations={[0, 0.45, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.islandRim]} />
      {children}
    </View>
  );
}

export function KingHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coins, loading } = useCoins();
  const { t } = useTranslation();
  const fontBold = useAppFont(700);
  const fontExtra = useAppFont(800);
  const copy = t.kingPredictions;

  return (
    <View style={[styles.bar, { paddingTop: Math.max(insets.top, 10) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.back}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/rank' as never);
        }}
        style={styles.back}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={26} color="#fff" />
      </Pressable>

      <GlassIsland style={styles.brand} accessibilityLabel={copy.brandA11y}>
        <Text style={[styles.ninety, { fontFamily: fontBold }]}>90</Text>
        <LinearGradient colors={['#6E36EE', '#3F1F88']} style={styles.plus}>
          <Text style={[styles.plusText, { fontFamily: fontExtra }]}>PLUS</Text>
        </LinearGradient>
      </GlassIsland>

      <GlassIsland style={styles.energy} accessibilityLabel={`${copy.energyA11y}: ${coins}`}>
        <Text style={[styles.energyValue, { fontFamily: fontBold }]}>
          {loading ? '—' : String(coins)}
        </Text>
        <Image source={KING_ICON.energy} style={styles.energyIcon} contentFit="contain" />
      </GlassIsland>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 38,
    height: 38,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  island: {
    borderRadius: 78,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  islandFallback: {
    backgroundColor: Platform.OS === 'ios' ? ISLAND_TINT : 'rgba(48,48,48,0.38)',
  },
  islandRim: {
    borderRadius: 78,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.28)',
  },
  brand: {
    height: 40,
    width: 111,
  },
  ninety: {
    color: '#fff',
    fontSize: 22,
  },
  plus: {
    height: 16,
    width: 46,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: '#fff',
    fontSize: 12,
  },
  energy: {
    minWidth: 71,
    height: 36,
    paddingHorizontal: 7,
  },
  energyValue: {
    color: '#fff',
    fontSize: 22,
  },
  energyIcon: {
    width: 24,
    height: 24,
  },
});
