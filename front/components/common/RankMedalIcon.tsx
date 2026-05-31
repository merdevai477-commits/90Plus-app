/**
 * RankMedalIcon — vector medals for ranks 1–3, numeric badge for 4+.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Medal, Star, Trophy } from 'lucide-react-native';

const RANK_COLORS: Record<number, string> = {
  1: '#F5C518',
  2: '#C0C0C0',
  3: '#CD7F32',
};

interface RankMedalIconProps {
  rank: number;
  size?: number;
}

export function RankMedalIcon({ rank, size = 28 }: RankMedalIconProps) {
  const color = RANK_COLORS[rank];

  if (rank === 1) {
    return <Trophy color={color} size={size} fill={color} strokeWidth={2} />;
  }

  if (rank === 2 || rank === 3) {
    return <Medal color={color} size={size} fill={color} strokeWidth={2} />;
  }

  return (
    <View style={[styles.rankBadge, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.rankText, { fontSize: size * 0.38 }]}>{rank}</Text>
    </View>
  );
}

export function BadgeTypeIcon({
  type,
  size = 22,
}: {
  type: 'gold' | 'silver' | 'bronze' | 'diamond' | 'ranked';
  size?: number;
}) {
  if (type === 'gold') {
    return <Trophy color="#F5C518" size={size} fill="#F5C518" strokeWidth={2} />;
  }
  if (type === 'silver') {
    return <Medal color="#C0C0C0" size={size} fill="#C0C0C0" strokeWidth={2} />;
  }
  if (type === 'bronze') {
    return <Medal color="#CD7F32" size={size} fill="#CD7F32" strokeWidth={2} />;
  }
  if (type === 'diamond') {
    return <Star color="#00BFFF" size={size} fill="#00BFFF" strokeWidth={2} />;
  }
  return <Trophy color="#22c55e" size={size} strokeWidth={2} />;
}

const styles = StyleSheet.create({
  rankBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#fff',
    fontWeight: '900',
  },
});

export default RankMedalIcon;
