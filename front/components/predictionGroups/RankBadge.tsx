/**
 * RankBadge — the rank indicator used in every leaderboard row.
 *
 *  - Ranks 1-3  → circular badge filled with a gold radial gradient
 *                 (react-native-svg `RadialGradient`, a Skia-free equivalent
 *                 that needs no native rebuild) + a crown glyph for rank 1.
 *  - Ranks 4+   → a plain bold number.
 *
 * Digits are Latin (1, 2, 3…) so they're rendered with an overlaid RN <Text>
 * for crisp, font-consistent output rather than SVG text.
 */

import React, { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { PG, PG_GLOW_GOLD, usePGFonts } from './theme';

export interface RankBadgeProps {
  rank: number;
  size?: number;
}

const MEDAL_RING: Record<number, string> = {
  1: '#FFF3D0',
  2: '#EAD9A8',
  3: '#E7C79A',
};

export function RankBadge({ rank, size = 36 }: RankBadgeProps) {
  const { extra } = usePGFonts();
  const gradientId = useId();
  const isMedal = rank <= 3;

  if (!isMedal) {
    return (
      <View style={[styles.plain, { width: size, height: size }]}>
        <Text style={[styles.plainTxt, { fontFamily: extra, fontSize: size * 0.42 }]}>
          {rank}
        </Text>
      </View>
    );
  }

  const r = size / 2;
  return (
    <View style={[{ width: size, height: size }, PG_GLOW_GOLD]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="36%" r="68%">
            <Stop offset="0" stopColor="#FCE3A0" />
            <Stop offset="0.55" stopColor={PG.gold} />
            <Stop offset="1" stopColor={PG.goldDeep} />
          </RadialGradient>
        </Defs>
        <Circle
          cx={r}
          cy={r}
          r={r - 1}
          fill={`url(#${gradientId})`}
          stroke={MEDAL_RING[rank]}
          strokeWidth={1.5}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>
          <Text style={[styles.medalTxt, { fontFamily: extra, fontSize: size * 0.44 }]}>
            {rank}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plain: { alignItems: 'center', justifyContent: 'center' },
  plainTxt: { color: PG.textSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  medalTxt: {
    color: '#3A2600',
    textShadowColor: 'rgba(255,255,255,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
