/**
 * ProfileTopBar
 *
 * Fixed floating header for the Profile screen.
 * Leading side: LVL badge only (no 90PLUS text — cleaner look).
 * Trailing side: purple coin badge with Zap icon.
 * Glass matches Matches / Quiz via glassProps.header.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Zap } from 'lucide-react-native';
import { BlurView, type BlurTint } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { useCoins } from '../../contexts/CoinsContext';
import { glassProps } from '../../constants/ui';
import { useTranslation } from '../../src/i18n';
import { CoinsInfoModal } from '../common/CoinsInfoModal';
import { LevelInfoModal } from '../common/LevelInfoModal';

const ACCENT = '#A855F7';
const blurTint: BlurTint = 'dark';

interface ProfileTopBarProps {
  topInset: number;
  level?: number;
}

const ProfileTopBar: React.FC<ProfileTopBarProps> = ({ topInset, level }) => {
  const { coins, loading } = useCoins();
  const { t } = useTranslation();
  const [showCoinsInfo, setShowCoinsInfo] = React.useState(false);
  const [showLevelInfo, setShowLevelInfo] = React.useState(false);

  const openLevelInfo = useCallback(() => setShowLevelInfo(true), []);
  const closeLevelInfo = useCallback(() => setShowLevelInfo(false), []);
  const openCoinsInfo = useCallback(() => setShowCoinsInfo(true), []);
  const closeCoinsInfo = useCallback(() => setShowCoinsInfo(false), []);

  const display: string = loading ? '—' : String(coins);
  const levelLabel =
    level != null
      ? t.levelInfo.youAreLevel.replace('{level}', String(level))
      : undefined;

  const shellStyle = [
    s.container,
    { paddingTop: Math.max(topInset, 10) + 10 },
  ];

  const barContent = (
    <>
      {level != null ? (
        <Pressable
          style={s.lvlBadge}
          onPress={openLevelInfo}
          accessibilityRole="button"
          accessibilityLabel={levelLabel}
        >
          <Text style={s.lvlLabel}>LVL</Text>
          <Text style={s.lvlNumber}>{level}</Text>
        </Pressable>
      ) : (
        <View style={s.lvlPlaceholder} />
      )}

      <Pressable
        style={s.coinChip}
        onPress={openCoinsInfo}
        accessibilityRole="button"
        accessibilityLabel={`${t.rank.a11yCoinChip}: ${display}`}
      >
        <Zap size={13} color={ACCENT} fill={ACCENT} />
        <Text style={s.coinTxt}>{display}</Text>
      </Pressable>
    </>
  );

  return (
    <>
      {isLiquidGlassSupported ? (
        <LiquidGlassView {...glassProps.header} style={shellStyle}>
          {barContent}
        </LiquidGlassView>
      ) : (
        <BlurView intensity={15} tint={blurTint} style={shellStyle}>
          {barContent}
        </BlurView>
      )}

      {level != null && (
        <LevelInfoModal
          visible={showLevelInfo}
          onClose={closeLevelInfo}
          level={level}
        />
      )}

      <CoinsInfoModal
        visible={showCoinsInfo}
        onClose={closeCoinsInfo}
      />
    </>
  );
};

export default React.memo(ProfileTopBar);

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'transparent',
  },

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
