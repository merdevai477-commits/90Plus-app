import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCoins } from '../../contexts/CoinsContext';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ICON } from './assets';
import { GlassSurface } from './GlassSurface';

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

      <GlassSurface radius={78} style={[styles.island, styles.brand]} accessibilityLabel={copy.brandA11y}>
        <Text style={[styles.ninety, { fontFamily: fontBold }]} allowFontScaling={false}>90</Text>
        <LinearGradient colors={['#6E36EE', '#3F1F88']} style={styles.plus}>
          <Text style={[styles.plusText, { fontFamily: fontExtra }]} allowFontScaling={false}>PLUS</Text>
        </LinearGradient>
      </GlassSurface>

      <GlassSurface radius={78} style={[styles.island, styles.energy]} accessibilityLabel={`${copy.energyA11y}: ${coins}`}>
        <Text
          style={[styles.energyValue, { fontFamily: fontBold }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          allowFontScaling={false}
        >
          {loading ? '—' : String(coins)}
        </Text>
        <Image source={KING_ICON.energy} style={styles.energyIcon} contentFit="contain" />
      </GlassSurface>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
    flexShrink: 1,
    maxWidth: 72,
  },
  energyIcon: {
    width: 24,
    height: 24,
  },
});
