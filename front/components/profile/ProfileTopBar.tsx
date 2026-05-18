/**
 * ProfileTopBar
 *
 * Fixed floating header for the Profile screen.
 * Leading side: LVL badge only (no 90PLUS text — cleaner look).
 * Trailing side: purple coin badge with Zap icon.
 */

import React from 'react';
import { I18nManager, StyleSheet, Text, View } from 'react-native';
import { Zap } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { useCoins } from '../../contexts/CoinsContext';

const ACCENT = '#A855F7';

interface ProfileTopBarProps {
  topInset: number;
  level?: number;
}

const ProfileTopBar: React.FC<ProfileTopBarProps> = ({ topInset, level }) => {
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
      {/* Leading: LVL badge */}
      {level != null ? (
        <View style={s.lvlBadge}>
          <Text style={s.lvlLabel}>LVL</Text>
          <Text style={s.lvlNumber}>{level}</Text>
        </View>
      ) : (
        <View style={s.lvlPlaceholder} />
      )}

      {/* Trailing: coin badge */}
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

  /* LVL badge */
  lvlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
  },
  lvlLabel: {
    color: 'rgba(168,85,247,0.9)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  lvlNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  lvlPlaceholder: {
    width: 52,
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
