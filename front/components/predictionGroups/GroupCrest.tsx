/**
 * GroupCrest — the group's shield badge (purple gradient shield + gold crown +
 * soccer ball), matching the reference design. Drawn with react-native-svg so
 * the shield shape is crisp at any size; the crown (lucide) sits on top.
 */

import { Crown } from 'lucide-react-native';
import React, { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { PG } from './theme';

export interface GroupCrestProps {
  size?: number;
}

export function GroupCrest({ size = 64 }: GroupCrestProps) {
  const gradientId = useId();
  const w = size;
  const h = size * 1.1;

  const shield = [
    `M ${w / 2} 1`,
    `C ${w * 0.8} 1, ${w - 1} ${h * 0.06}, ${w - 1} ${h * 0.14}`,
    `L ${w - 1} ${h * 0.52}`,
    `C ${w - 1} ${h * 0.8}, ${w * 0.72} ${h * 0.95}, ${w / 2} ${h - 1}`,
    `C ${w * 0.28} ${h * 0.95}, 1 ${h * 0.8}, 1 ${h * 0.52}`,
    `L 1 ${h * 0.14}`,
    `C 1 ${h * 0.06}, ${w * 0.2} 1, ${w / 2} 1 Z`,
  ].join(' ');

  return (
    <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={PG.purpleLight} />
            <Stop offset="1" stopColor="#5B21B6" />
          </LinearGradient>
        </Defs>
        <Path
          d={shield}
          fill={`url(#${gradientId})`}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1.5}
        />
      </Svg>

      <Text style={{ fontSize: size * 0.42, marginTop: size * 0.06 }}>⚽</Text>

      <View style={[styles.crown, { top: -size * 0.12 }]}>
        <Crown size={size * 0.34} color="#3A2600" fill={PG.gold} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  crown: { position: 'absolute', alignSelf: 'center' },
});
