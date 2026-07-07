/**
 * Premium rank badges — top 3 get gradient rings + glow; others stay minimal.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Medal, Trophy } from 'lucide-react-native';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { PG, usePGFonts } from './theme';

const SIZE = 34;

const RANK_STYLES: Record<
  number,
  {
    colors: [string, string, string];
    border: string;
    glow: string;
    icon: React.ReactNode;
  }
> = {
  1: {
    colors: ['#FDE68A', '#F5B942', '#B45309'],
    border: 'rgba(253,230,138,0.7)',
    glow: '#F5B942',
    icon: <Crown size={15} color="#3A2600" fill="#3A2600" />,
  },
  2: {
    colors: ['#F8FAFC', '#CBD5E1', '#64748B'],
    border: 'rgba(248,250,252,0.65)',
    glow: '#CBD5E1',
    icon: <Medal size={15} color="#1E293B" />,
  },
  3: {
    colors: ['#FDBA74', '#EA580C', '#9A3412'],
    border: 'rgba(253,186,116,0.65)',
    glow: '#EA580C',
    icon: <Trophy size={14} color="#431407" />,
  },
};

export function HomeRankBadge({ rank }: { rank: number }) {
  const { extra } = usePGFonts();
  const premium = RANK_STYLES[rank];

  if (premium) {
    const glow = Platform.select({
      ios: {
        shadowColor: premium.glow,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      default: {},
    });

    return (
      <View style={[styles.premiumWrap, { width: SIZE, height: SIZE }, glow]}>
        <LinearGradient
          colors={premium.colors}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.premiumGrad, { borderColor: premium.border }]}
        >
          {premium.icon}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.plain}>
      <Text style={[styles.rankText, { fontFamily: extra }]}>{rank}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  premiumWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumGrad: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  plain: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rankText: {
    fontSize: 13,
    color: PG.textMuted,
  },
});
