import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Zap } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCoins } from '../../contexts/CoinsContext';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KING_PURPLE } from './shared';

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
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>

      <View style={styles.brand} accessibilityLabel={copy.brandA11y}>
        <Text style={[styles.ninety, { fontFamily: fontBold }]}>90</Text>
        <View style={styles.plus}>
          <Text style={[styles.plusText, { fontFamily: fontExtra }]}>PLUS</Text>
        </View>
      </View>

      <View style={styles.energy} accessibilityLabel={`${copy.energyA11y}: ${coins}`}>
        <Text style={[styles.energyValue, { fontFamily: fontBold }]}>
          {loading ? '—' : String(coins)}
        </Text>
        <Zap size={16} color={KING_PURPLE} fill={KING_PURPLE} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(48,48,48,0.35)',
  },
  brand: {
    height: 40,
    width: 111,
    borderRadius: 78,
    backgroundColor: 'rgba(48,48,48,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ninety: {
    color: '#fff',
    fontSize: 22,
  },
  plus: {
    height: 16,
    width: 46,
    borderRadius: 5,
    backgroundColor: '#6E36EE',
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
    paddingHorizontal: 10,
    borderRadius: 78,
    backgroundColor: 'rgba(48,48,48,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  energyValue: {
    color: '#fff',
    fontSize: 18,
  },
});
