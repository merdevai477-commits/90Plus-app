/**
 * RankMedalIcon — PNG medals for ranks 1–3, numeric badge for 4+.
 */

import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { Star, Trophy } from 'lucide-react-native';

const MEDAL_IMAGES: Record<number, ImageSourcePropType> = {
  1: require('../../assets/images/1st.png'),
  2: require('../../assets/images/2st.png'),
  3: require('../../assets/images/3st.png'),
};

interface RankMedalIconProps {
  rank: number;
  size?: number;
}

export function RankMedalIcon({ rank, size = 28 }: RankMedalIconProps) {
  const medal = MEDAL_IMAGES[rank];
  if (medal) {
    return (
      <Image
        source={medal}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
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
    return <Image source={MEDAL_IMAGES[1]} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  if (type === 'silver') {
    return <Image source={MEDAL_IMAGES[2]} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  if (type === 'bronze') {
    return <Image source={MEDAL_IMAGES[3]} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  if (type === 'diamond') {
    return <Star color="#00BFFF" size={size} fill="#00BFFF" />;
  }
  return <Trophy color="#22c55e" size={size} />;
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
