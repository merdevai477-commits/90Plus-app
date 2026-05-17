/**
 * ProfileTopBar
 *
 * Fixed floating header for the Profile screen.
 * Matches the visual language of RankHeader — liquid glass background,
 * 90PLUS brand pill on the leading edge, purple coin badge on the trailing edge.
 *
 * The coin badge uses a Zap icon in purple (matching the profile accent colour)
 * instead of the gold used elsewhere, giving the profile screen its own identity.
 */

import React from 'react';
import { I18nManager, StyleSheet, Text, View } from 'react-native';
import { Zap } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { useCoins } from '../../contexts/CoinsContext';

// Purple accent — matches ProfileCard and LevelCard
const ACCENT = '#A855F7';

interface ProfileTopBarProps {
  topInset: number;
}

const ProfileTopBar: React.FC<ProfileTopBarProps> = ({ topInset }) => {
  const GlassContainer = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const { coins, loading } = useCoins();

  const rowDirection = I18nManager.isRTL ? 'row-reverse' : 'row';
  const display: string = loading ? '—' : String(coins);

  return (
    <GlassContainer
      intensity={20}
      tint="dark"
      effect="regular"
      style={[
        s.container,
        { paddingTop: topInset + 10, flexDirection: rowDirection },
      ]}
    >
      {/* 90PLUS brand pill */}
      <View style={s.logoPill}>
        <Text style={s.logo90}>90</Text>
        <View style={s.plusChip}>
          <Text style={s.logoPlus}>PLUS</Text>
        </View>
      </View>

      {/* Purple coin badge */}
      <View
        style={s.coinChip}
        accessibilityRole="text"
        accessibilityLabel={`رصيد العملات: ${display}`}
      >
        <Zap size={13} color={ACCENT} fill={ACCENT} />
        <Text style={s.coinTxt}>{display}</Text>
      </View>
    </GlassContainer>
  );
};

export default ProfileTopBar;

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 200,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(5,1,13,0.0)',
  },

  /* 90PLUS pill */
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 5,
  },
  logo90: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  plusChip: {
    backgroundColor: ACCENT,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  logoPlus: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* Coin badge */
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    gap: 5,
  },
  coinTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
