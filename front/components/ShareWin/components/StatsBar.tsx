/**
 * Stats strip — Figma Frame123 node 2003:5460.
 * Rank · Shares · Points (featured purple pill).
 * Three equal slots; label + value centered in each for any device width.
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
          minHeight: s(88),
          borderRadius: s(20),
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          flexDirection: 'row',
          alignItems: 'stretch',
          paddingHorizontal: s(8),
          paddingVertical: s(8),
          gap: s(4),
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: theme.isDark ? 0.35 : 0.12,
          shadowRadius: 4,
          elevation: 3,
        },
        col: {
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(4),
          paddingHorizontal: s(2),
        },
        labelRow: {
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(3),
          paddingHorizontal: s(2),
        },
        label: {
          fontFamily: getAppFont(400, language),
          fontSize: f(11),
          lineHeight: f(14),
          color: theme.muted,
          textAlign: 'center',
          flexShrink: 1,
          includeFontPadding: false,
        },
        value: {
          fontFamily: getAppFont(700, language),
          fontSize: f(28),
          lineHeight: f(34),
          color: theme.dark,
          textAlign: 'center',
          width: '100%',
          includeFontPadding: false,
        },
        pointsPill: {
          flex: 1,
          minWidth: 0,
          borderRadius: s(16),
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(4),
          paddingHorizontal: s(6),
          paddingVertical: s(8),
          overflow: 'hidden',
        },
        pointsLabel: {
          fontFamily: getAppFont(600, language),
          fontSize: f(11),
          lineHeight: f(14),
          color: '#DDDDDD',
          textAlign: 'center',
          flexShrink: 1,
          includeFontPadding: false,
        },
        pointsValue: {
          fontFamily: getAppFont(700, language),
          fontSize: f(24),
          lineHeight: f(30),
          color: theme.white,
          textAlign: 'center',
          width: '100%',
          includeFontPadding: false,
        },
        icon: {
          width: s(14),
          height: s(14),
          flexShrink: 0,
        },
        coinsIcon: {
          width: s(16),
          height: s(16),
          flexShrink: 0,
        },
        divider: {
          width: StyleSheet.hairlineWidth,
          alignSelf: 'center',
          height: '62%',
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(36,16,78,0.12)',
        },
      }),
    [f, language, s, theme],
  );

  const rankText = rank != null && rank > 0 ? `#${formatNumber(rank, language)}` : '—';

  return (
    <View style={styles.wrap}>
      <View style={styles.col}>
        <View style={styles.labelRow}>
          <Text style={styles.label} numberOfLines={1}>
            {copy.statsYourRank}
          </Text>
          <Image source={SW_ASSET.rankV2} style={styles.icon} contentFit="contain" transition={0} />
        </View>
        <Text
          style={styles.value}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {rankText}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.col}>
        <View style={styles.labelRow}>
          <Text style={styles.label} numberOfLines={1}>
            {copy.statsYourShares}
          </Text>
          <Image source={SW_ASSET.shareV2} style={styles.icon} contentFit="contain" transition={0} />
        </View>
        <Text
          style={styles.value}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {formatNumber(shareCount, language)}
        </Text>
      </View>

      <LinearGradient
        colors={[...theme.pointsGradient]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.pointsPill}
      >
        <View style={styles.labelRow}>
          <Text style={styles.pointsLabel} numberOfLines={1}>
            {copy.statsMyPoints}
          </Text>
          <Image
            source={SW_ASSET.coinsV2}
            style={styles.coinsIcon}
            contentFit="contain"
            transition={0}
          />
        </View>
        <Text
          style={styles.pointsValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {formatNumber(score, language)}
        </Text>
      </LinearGradient>
    </View>
  );
});

export default StatsBar;
