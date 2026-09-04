/**
 * RankHeader
 *
 * Floating header for the Rank tab. Centered brand pill matches Matches /
 * Predict & Win (90 + purple PLUS chip + screen title). Search (users) on the
 * leading edge; live coin balance on the trailing edge.
 */

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView, type BlurTint } from 'expo-blur';
import { Crown, Search, Zap } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCoins } from '../../contexts/CoinsContext';
import { useTranslation } from '../../src/i18n';
import { glassProps } from '../../constants/ui';
import AdvancedSearchBar from '../common/AdvancedSearchBar';
import { CoinsInfoModal } from '../common/CoinsInfoModal';
import { FeatureInfoModal } from '../common/FeatureInfoModal';

const ACCENT = '#A855F7';
const blurTint: BlurTint = 'dark';

interface RankHeaderProps {
  topInset: number;
}

const RankHeader: React.FC<RankHeaderProps> = ({ topInset }) => {
  const { coins, loading } = useCoins();
  const { t } = useTranslation();
  const [showCoinsInfo, setShowCoinsInfo] = React.useState(false);
  const [showRankInfo, setShowRankInfo] = React.useState(false);
  const [showUserSearch, setShowUserSearch] = React.useState(false);

  const display: string = loading ? '—' : String(coins);

  const shellStyle = [
    s.headerContainer,
    { paddingTop: Math.max(topInset, 10) + 10 },
  ];

  const headerChrome = (
    <>
      <View style={[s.sideSlot, s.sideSlotStart]}>
        <Pressable
          style={s.searchBtn}
          onPress={() => setShowUserSearch(true)}
          accessibilityRole="button"
          accessibilityLabel={t.rank.a11ySearchUsers}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Search size={20} color="#e9d5ff" />
        </Pressable>
      </View>

      <Pressable
        style={s.logoPill}
        onPress={() => setShowRankInfo(true)}
        accessibilityRole="button"
        accessibilityLabel={t.rankInfo.title}
      >
        <Text style={s.logo90}>90</Text>
        <View style={s.plusChip}>
          <Text style={s.logoPlus}>PLUS</Text>
        </View>
        <Text style={s.pillTitle}>rank</Text>
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
    </>
  );

  const headerShell = isLiquidGlassSupported ? (
    <LiquidGlassView {...glassProps.header} style={shellStyle}>
      {headerChrome}
    </LiquidGlassView>
  ) : (
    <BlurView intensity={15} tint={blurTint} style={shellStyle}>
      {headerChrome}
    </BlurView>
  );

  return (
    <>
      {headerShell}

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

      {/* Outside the header shell so the overlay covers the full screen. */}
      <AdvancedSearchBar
        visible={showUserSearch}
        onClose={() => setShowUserSearch(false)}
        initialTab="users"
        onResultSelect={() => setShowUserSearch(false)}
      />
    </>
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
  /** Equal flex sides keep the brand pill optically centered. */
  sideSlot: {
    flex: 1,
  },
  sideSlotStart: {
    alignItems: 'flex-start',
  },
  sideSlotEnd: {
    alignItems: 'flex-end',
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  pillTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginLeft: 2,
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
