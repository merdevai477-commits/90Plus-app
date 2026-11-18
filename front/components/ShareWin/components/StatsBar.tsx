/**
 * Stats strip — Figma Frame123 node 2003:5460.
 * Rank · Shares · Points (featured purple pill).
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../../src/i18n';
import { getAppFont } from '../../../utils/fontSetup';
import { SW_ASSET } from '../assets';
import { formatNumber } from '../data';
import { useShareWinStyles } from '../styles';

interface StatsBarProps {
  score: number;
  shareCount: number;
  rank: number | null;
}

const StatsBar = memo(function StatsBar({ score, shareCount, rank }: StatsBarProps) {
  const { metrics, theme } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const { s, f } = metrics;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          width: '100%',
          height: s(88),
          borderRadius: s(20),
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          // Figma Frame566 LTR artboard: Rank | Shares | Points(pill on the right)
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: s(7),
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: theme.isDark ? 0.35 : 0.12,
          shadowRadius: 4,
          elevation: 3,
        },
        col: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(2),
        },
        labelRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(2),
        },
        label: {
          fontFamily: getAppFont(400, language),
          fontSize: f(12),
          color: theme.muted,
          textAlign: 'center',
        },
        value: {
          fontFamily: getAppFont(700, language),
          fontSize: f(32),
          color: theme.dark,
          textAlign: 'center',
          width: '100%',
        },
        pointsPill: {
          width: s(144),
          height: s(67),
          borderRadius: s(16),
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        pointsLabel: {
          fontFamily: getAppFont(600, language),
          fontSize: f(12),
          color: '#DDDDDD',
          textAlign: 'center',
        },
        pointsValue: {
          fontFamily: getAppFont(700, language),
          fontSize: f(24),
          color: theme.white,
          textAlign: 'center',
          width: '100%',
        },
        icon: {
          width: s(15),
          height: s(15),
        },
        coinsIcon: {
          width: s(17),
          height: s(17),
        },
        divider: {
          width: 1,
          height: s(50),
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(36,16,78,0.12)',
        },
      }),
    [f, language, s, theme],
  ); // language kept for getAppFont

  return (
    <View style={styles.wrap}>
      <View style={styles.col}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{copy.statsYourRank}</Text>
          <Image source={SW_ASSET.rankV2} style={styles.icon} contentFit="contain" transition={0} />
        </View>
        <Text style={styles.value}>
          {rank != null && rank > 0 ? `#${formatNumber(rank, language)}` : '—'}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.col}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{copy.statsYourShares}</Text>
          <Image source={SW_ASSET.shareV2} style={styles.icon} contentFit="contain" transition={0} />
        </View>
        <Text style={styles.value}>{formatNumber(shareCount, language)}</Text>
      </View>

      <LinearGradient
        colors={[...theme.pointsGradient]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.pointsPill}
      >
        <View style={styles.labelRow}>
          <Text style={styles.pointsLabel}>{copy.statsMyPoints}</Text>
          <Image
            source={SW_ASSET.coinsV2}
            style={styles.coinsIcon}
            contentFit="contain"
            transition={0}
          />
        </View>
        <Text style={styles.pointsValue}>{formatNumber(score, language)}</Text>
      </LinearGradient>
    </View>
  );
});

export default StatsBar;
