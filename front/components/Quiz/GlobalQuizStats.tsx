import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Coins, Zap } from 'lucide-react-native';

import { useCoins } from '../../contexts/CoinsContext';
import { useXp } from '../../contexts/XpContext';
import { GAME_COLOR, useGameChromeStyles } from './gameChrome';
import { getAppFont } from '../../utils/fontSetup';

function createStyles(scale: number, fontScale: number, language: string) {
  const s = (v: number) => Math.round(v * scale);
  const f = (v: number) => Math.round(v * fontScale);
  const font = (weight: 500 | 700) => getAppFont(weight, language);

  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(8),
    },
    pill: {
      height: s(31),
      borderRadius: s(14),
      borderWidth: 1,
      paddingHorizontal: s(10),
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(6),
      backgroundColor: GAME_COLOR.pillSurface,
    },
    coinPill: {
      borderColor: '#E4B200',
      backgroundColor: 'rgba(228,178,0,0.12)',
    },
    xpPill: {
      borderColor: GAME_COLOR.accent,
      backgroundColor: 'rgba(168,85,247,0.14)',
    },
    label: {
      fontFamily: font(700),
      fontSize: f(12),
      lineHeight: f(14),
      letterSpacing: 0.2,
    },
    coinLabel: {
      color: '#FFD24A',
    },
    xpLabel: {
      color: '#D8B4FE',
    },
    levelLabel: {
      color: GAME_COLOR.textMuted,
    },
  });
}

export function GlobalQuizStats() {
  const { coins, loading: coinsLoading } = useCoins();
  const { xp, level, loading: xpLoading } = useXp();
  const { metrics, isRtl } = useGameChromeStyles();

  const styles = useMemo(
    () => createStyles(metrics.scale, metrics.fontScale, isRtl ? 'ar' : 'en'),
    [metrics.scale, metrics.fontScale, isRtl],
  );

  const coinsLabel = coinsLoading ? '—' : coins.toLocaleString();
  const xpLabel = xpLoading ? '—' : xp.toLocaleString();
  const levelLabel = xpLoading ? 'Lv —' : `Lv ${level}`;

  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, styles.coinPill]}>
        <Coins size={metrics.s(14)} color="#FFD24A" strokeWidth={2.2} />
        <Text style={[styles.label, styles.coinLabel]}>{coinsLabel}</Text>
      </View>
      <View style={[styles.pill, styles.xpPill]}>
        <Zap size={metrics.s(14)} color="#D8B4FE" strokeWidth={2.2} />
        <Text style={[styles.label, styles.xpLabel]}>{xpLabel}</Text>
        <Text style={[styles.label, styles.levelLabel]}>{levelLabel}</Text>
      </View>
    </View>
  );
}
