import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView } from 'expo-blur';
import { Zap } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const ACCENT = '#A855F7';

interface RankHeaderProps {
  topInset: number;
}

export default function RankHeader({ topInset }: RankHeaderProps) {
  const GlassContainer = isLiquidGlassSupported ? LiquidGlassView : BlurView;

  return (
    <GlassContainer
      intensity={20}
      tint="dark"
      effect="regular"
      style={[s.headerContainer, { paddingTop: topInset + 10 }]}
    >
      <View style={s.logoPillSmall}>
        <Text style={s.logo90Small}>90</Text>
        <View style={s.plusChipSmall}>
          <Text style={s.logoPlusSmall}>PLUS</Text>
        </View>
      </View>

      <View style={s.coinChip}>
        <Zap size={13} color={ACCENT} fill={ACCENT} />
        <Text style={s.coinTxt}>50</Text>
      </View>
    </GlassContainer>
  );
}

const s = StyleSheet.create({
  headerContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(5,1,13,0.0)',
  },
  logoPillSmall: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 5,
  },
  logo90Small: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  plusChipSmall: { backgroundColor: ACCENT, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  logoPlusSmall: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  coinChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 5,
  },
  coinTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
