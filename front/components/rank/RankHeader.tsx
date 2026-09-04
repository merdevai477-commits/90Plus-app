/**
 * RankHeader
 *
 * Floating header for the Rank tab. Displays the centered "90plus rank"
 * brand pill and the live coin balance (from CoinsContext) on the trailing
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
const TITLE = '90plus rank';

interface RankHeaderProps {
  topInset: number;
}

const RankHeader: React.FC<RankHeaderProps> = ({ topInset }) => {
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
      <View style={s.sideSlot} />

      <Pressable
        style={s.titlePill}
        onPress={() => setShowRankInfo(true)}
        accessibilityRole="button"
        accessibilityLabel={t.rankInfo.title}
      >
        <Text style={s.titleText}>{TITLE}</Text>
      </Pressable>

      <View style={[s.sideSlot, s.sideSlotEnd]}>
        <Pressable
          style={s.coinChip}
          onPress={() => setShowCoinsInfo(true)}
          accessibilityRole="button"
          accessibilityLabel={`${t.rank.a11yCoinChip}: ${display}`}
        >
          <Zap size={13} color={ACCENT} fill={ACCENT} />
          <Text style={s.coinTxt}>{display}</Text>
        </Pressable>
      </View>

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
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'transparent',
  },
  /** Equal flex sides keep the title optically centered. */
  sideSlot: {
    flex: 1,
  },
  sideSlotEnd: {
    alignItems: 'flex-end',
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  titleText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
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
