/**
 * RankHeader
 *
 * Floating header for the Rank tab. Displays the 90PLUS brand pill on the
 * leading edge and the live coin balance (from CoinsContext) on the trailing
 * edge. Glass matches Matches / Quiz via glassProps.header.
 */

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView, type BlurTint } from 'expo-blur';
import { Zap } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCoins } from '../../contexts/CoinsContext';
import { useTranslation } from '../../src/i18n';
import { glassProps } from '../../constants/ui';

const ACCENT = '#A855F7';
const blurTint: BlurTint = 'dark';

interface RankHeaderProps {
  topInset: number;
}

const RankHeader: React.FC<RankHeaderProps> = ({ topInset }) => {
  const { coins, loading } = useCoins();
  const { t } = useTranslation();

  const display: string = loading ? '—' : String(coins);

  const shellStyle = [
    s.headerContainer,
    { paddingTop: Math.max(topInset, 10) + 10 },
  ];

  const content = (
    <>
      <View style={s.logoPillSmall}>
        <Text style={s.logo90Small}>90</Text>
        <View style={s.plusChipSmall}>
          <Text style={s.logoPlusSmall}>PLUS</Text>
        </View>
      </View>

      <View
        style={s.coinChip}
        accessibilityRole="text"
        accessibilityLabel={`${t.rank.a11yCoinChip}: ${display}`}
      >
        <Zap size={13} color={ACCENT} fill={ACCENT} />
        <Text style={s.coinTxt}>{display}</Text>
      </View>
    </>
  );

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView {...glassProps.header} style={shellStyle}>
        {content}
      </LiquidGlassView>
    );
  }

  return (
    <BlurView intensity={15} tint={blurTint} style={shellStyle}>
      {content}
    </BlurView>
  );
};

export default RankHeader;

const s = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'transparent',
  },
  logoPillSmall: {
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
  logo90Small: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  plusChipSmall: {
    backgroundColor: ACCENT,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  logoPlusSmall: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 5,
  },
  coinTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
