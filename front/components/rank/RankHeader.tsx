/**
 * RankHeader
 *
 * Floating header for the Rank tab. Search (users, posts, hashtags) stays on
 * the leading edge (top-right in Arabic). Brand pill + coin chip adapt to
 * light/dark from Figma 1957:131.
 */

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView, type BlurTint } from 'expo-blur';
import { Crown, Search, Zap } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCoins } from '../../contexts/CoinsContext';
import { useResolvedAppScheme } from '@/hooks/useResolvedAppScheme';
import { useTranslation } from '../../src/i18n';
import { glassProps } from '../../constants/ui';
import AdvancedSearchBar from '../common/AdvancedSearchBar';
import { CoinsInfoModal } from '../common/CoinsInfoModal';
import { FeatureInfoModal } from '../common/FeatureInfoModal';
import { getRankTheme, RANK_LIGHT_ELEVATION } from './rankTheme';

const ACCENT = '#A855F7';

interface RankHeaderProps {
  topInset: number;
}

const RankHeader: React.FC<RankHeaderProps> = ({ topInset }) => {
  const { coins, loading } = useCoins();
  const { t } = useTranslation();
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getRankTheme(isDark), [isDark]);
  const [showCoinsInfo, setShowCoinsInfo] = React.useState(false);
  const [showRankInfo, setShowRankInfo] = React.useState(false);
  const [showUserSearch, setShowUserSearch] = React.useState(false);

  const display: string = loading ? '—' : String(coins);
  const blurTint: BlurTint = isDark ? 'dark' : 'light';

  const shellStyle = [
    s.headerContainer,
    { paddingTop: Math.max(topInset, 10) + 10 },
    !isDark && { borderBottomColor: 'rgba(106,43,217,0.08)' },
  ];

  const headerChrome = (
    <>
      {/* Leading edge — top-right in Arabic; keep search here as requested. */}
      <View style={[s.sideSlot, s.sideSlotStart]}>
        <Pressable
          style={[
            s.searchBtn,
            {
              backgroundColor: theme.searchBg,
              borderColor: theme.searchBorder,
            },
            !isDark && RANK_LIGHT_ELEVATION.soft,
          ]}
          onPress={() => setShowUserSearch(true)}
          accessibilityRole="button"
          accessibilityLabel={t.rank.a11ySearch}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Search size={20} color={theme.searchIcon} />
        </Pressable>
      </View>

      <Pressable
        style={[
          s.logoPill,
          {
            backgroundColor: theme.pillBg,
            borderColor: theme.pillBorder,
          },
          !isDark && RANK_LIGHT_ELEVATION.soft,
        ]}
        onPress={() => setShowRankInfo(true)}
        accessibilityRole="button"
        accessibilityLabel={t.rankInfo.title}
      >
        <Text style={[s.logo90, { color: theme.headerTitle }]}>90</Text>
        <View style={s.plusChip}>
          <Text style={s.logoPlus}>PLUS</Text>
        </View>
        <Text style={[s.pillTitle, { color: theme.headerTitle }]}>
          {t.rank.competitions.title}
        </Text>
      </Pressable>

      <View style={[s.sideSlot, s.sideSlotEnd]}>
        <Pressable
          style={[
            s.coinChip,
            {
              backgroundColor: theme.coinBg,
              borderColor: theme.coinBorder,
            },
            !isDark && RANK_LIGHT_ELEVATION.soft,
          ]}
          onPress={() => setShowCoinsInfo(true)}
          accessibilityRole="button"
          accessibilityLabel={`${t.rank.a11yCoinChip}: ${display}`}
        >
          <Zap size={13} color={ACCENT} fill={ACCENT} />
          <Text style={[s.coinTxt, { color: theme.coinText }]}>{display}</Text>
        </Pressable>
      </View>
    </>
  );

  const headerShell = isLiquidGlassSupported ? (
    <LiquidGlassView {...glassProps.header} style={shellStyle}>
      {headerChrome}
    </LiquidGlassView>
  ) : (
    <BlurView intensity={isDark ? 15 : 28} tint={blurTint} style={shellStyle}>
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
        variant="community"
        initialTab="all"
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    gap: 5,
    maxWidth: '58%',
  },
  logo90: {
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
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginLeft: 2,
    flexShrink: 1,
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    gap: 5,
  },
  coinTxt: { fontSize: 13, fontWeight: '800' },
});
