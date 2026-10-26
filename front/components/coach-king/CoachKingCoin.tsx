/**
 * King of Coaches money: a minted gold coin with an engraved "M", ringed in
 * the pitch purple, beside the amount in millions.
 */

import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ckMoneyParts } from '../../services/coachKing.service';
import { useAppFont } from '../../utils/fontSetup';

export type CkCoinSize = 'sm' | 'md' | 'lg';

const COIN: Record<CkCoinSize, { d: number; glyph: number; value: number; unit: number; gap: number }> = {
  sm: { d: 14, glyph: 8, value: 12, unit: 9, gap: 4 },
  md: { d: 20, glyph: 11, value: 16, unit: 11, gap: 6 },
  lg: { d: 30, glyph: 16, value: 26, unit: 13, gap: 8 },
};

export const CoachKingCoin = memo(function CoachKingCoin({ size = 'md' }: { size?: CkCoinSize }) {
  const spec = COIN[size];
  const fontBold = useAppFont(700);
  const d = spec.d;
  const inner = d * 0.74;
  return (
    <View style={[styles.ring, { width: d + 4, height: d + 4, borderRadius: (d + 4) / 2 }]}>
      <LinearGradient
        colors={['#FFF4B8', '#F8C94A', '#D98E04', '#8A5200']}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[styles.face, { width: d, height: d, borderRadius: d / 2 }]}
      >
        <LinearGradient
          colors={['#B8730A', '#F3B93A', '#FFE08A']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2 }]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.glyph, { fontFamily: fontBold, fontSize: spec.glyph, lineHeight: spec.glyph * 1.15 }]}
          >
            M
          </Text>
        </LinearGradient>
        <View
          pointerEvents="none"
          style={[styles.shine, { width: d * 0.42, height: d * 0.18, borderRadius: d, top: d * 0.12, left: d * 0.16 }]}
        />
      </LinearGradient>
    </View>
  );
});

type MoneyProps = {
  milli: number;
  lang: string;
  size?: CkCoinSize;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const CoachKingMoney = memo(function CoachKingMoney({ milli, lang, size = 'md', color = '#FFFFFF', style, testID }: MoneyProps) {
  const spec = COIN[size];
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const { value, unit } = ckMoneyParts(milli, lang);
  return (
    <View style={[styles.money, { columnGap: spec.gap }, style]} testID={testID}>
      <CoachKingCoin size={size} />
      <Text allowFontScaling={false} style={[styles.value, { color, fontFamily: fontBold, fontSize: spec.value }]}>
        {value}
        <Text style={[styles.unit, { fontFamily: fontSemi, fontSize: spec.unit }]}>{lang === 'ar' ? ` ${unit}` : unit}</Text>
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E146A',
    borderWidth: 1,
    borderColor: '#8C5CF5',
    boxShadow: '0px 0px 8px rgba(248,201,74,0.45)',
  },
  face: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.75,
    borderColor: 'rgba(122,72,0,0.55)',
  },
  glyph: {
    color: '#6B3A00',
    textAlign: 'center',
    textShadowColor: 'rgba(255,240,190,0.85)',
    textShadowOffset: { width: 0, height: 0.75 },
    textShadowRadius: 0.5,
  },
  shine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-24deg' }] },
  money: { flexDirection: 'row', alignItems: 'center' },
  value: {},
  unit: { color: '#F8C94A' },
});
