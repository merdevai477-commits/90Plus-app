/**
 * RankHeader
 *
 * Floating header for the Rank tab. Displays the 90PLUS brand pill on the
 * leading edge and the live coin balance (from CoinsContext) on the trailing
 * edge. Glass matches Matches / Quiz via glassProps.header.
 */

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView, type BlurTint } from 'expo-blur';
import { Crown, Zap } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCoins } from '../../contexts/CoinsContext';
import { useTranslation } from '../../src/i18n';
import { glassProps } from '../../constants/ui';
import { CoinsInfoModal } from '../common/CoinsInfoModal';
import { FeatureInfoModal } from '../common/FeatureInfoModal';

const ACCENT = '#A855F7';
const blurTint: BlurTint = 'dark';

interface RankHeaderProps {
  topInset: number;
  onCrownPress?: () => void;
}

const RankHeader: React.FC<RankHeaderProps> = ({ topInset, onCrownPress }) => {
  const { coins, loading } = useCoins();
  const { t } = useTranslation();
  const [showCoinsInfo, setShowCoinsInfo] = React.useState(false);
  const [showRankInfo, setShowRankInfo] = React.useState(false);

  const display: string = loading ? '—' : String(coins);

  const shellStyle = [
    s.headerContainer,
    { paddingTop: Math.max(topInset, 10) + 10 },
  ];

  const content = (
    <>
      <Pressable
        style={s.logoPillSmall}
        onPress={() => setShowRankInfo(true)}
        accessibilityRole="button"
        accessibilityLabel={t.rankInfo.title}
      >
        <Text style={s.logo90Small}>90</Text>
        <View style={s.plusChipSmall}>
          <Text style={s.logoPlusSmall}>PLUS</Text>
        </View>
      </Pressable>

      <Pressable
        style={s.coinChip}
        onPress={() => setShowCoinsInfo(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t.rank.a11yCoinChip}: ${display}`}
      >
        <Zap size={13} color={ACCENT} fill={ACCENT} />
        <Text style={s.coinTxt}>{display}</Text>
      </Pressable>

      {onCrownPress ? (
        <Pressable
          style={s.crownChip}
          onPress={onCrownPress}
          accessibilityRole="button"
          accessibilityLabel={t.groups?.openFromRank ?? 'Open groups'}
        >
          <Crown size={14} color="#F59E0B" />
          <Text style={s.crownTxt}>{t.groups?.openFromRank ?? 'Groups'}</Text>
        </Pressable>
      ) : null}

      <CoinsInfoModal
        visible={showCoinsInfo}
        onClose={() => setShowCoinsInfo(false)}
      />

      <FeatureInfoModal
        visible={showRankInfo}
        onClose={() => setShowRankInfo(false)}
        icon={<Crown size={30} color="#d8b4fe" />}
        title={t.rankInfo.title}
        bullets={[t.rankInfo.rule1, t.rankInfo.rule2, t.rankInfo.rule3]}
        hype={t.rankInfo.hype}
        gotItLabel={t.rankInfo.gotIt}
      />
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
  crownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.16)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    gap: 5,
  },
  crownTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
