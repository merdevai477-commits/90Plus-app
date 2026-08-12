/**
 * Stats bar — Figma node 186:108.
 *
 * The final content section of the page, NOT a footer: it scrolls with
 * everything else and sits 44pt below the last-winner section in the same
 * 404pt column. See `statsBar` in ../styles.ts for the Figma coordinates.
 *
 * Invited friends · current points · rank this week. All three are read
 * straight from `/share-win/me`; the app never computes a score or a rank.
 * A brand-new user renders 0 / 0 XP / their real tail rank — no blank slots.
 *
 * Internal geometry (all verified against the Figma frame): three 78/80/76pt
 * columns separated by 8pt gaps, 21pt glyphs and the 26pt XP badge between
 * them. The parts total 358pt inside a 404pt bar, so `justifyContent: center`
 * reproduces Figma's 23pt side padding exactly rather than hardcoding it.
 */

import React, { memo } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useTranslation } from '../../../src/i18n';
import { SW_ASSET } from '../assets';
import { formatNumber } from '../data';
import { SW_GRADIENT, useShareWinStyles } from '../styles';
import GradientText from './GradientText';

interface StatsBarProps {
  participants: number;
  score: number;
  rank: number;
}

/** Figma paints the XP badge glyph with its own two-stop sweep. */
const XP_BADGE_GRADIENT = ['#460BCB', '#BFABED', '#460BCB'] as const;
const XP_BADGE_LOCATIONS = [0.046, 0.336, 0.885] as const;

const StatsBar = memo(function StatsBar({ participants, score, rank }: StatsBarProps) {
  const { sw, metrics } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const { s } = metrics;

  return (
    <View style={sw.statsBar}>
      {/* Friends invited */}
      <View style={[sw.statsCol, { width: s(78) }]}>
        <Text style={sw.statsLabel}>{copy.statsInvitedFriends}</Text>
        <Text style={[sw.statsValue, sw.statsFriendsValue]}>
          {copy.statsFriendsValue.replace('{count}', formatNumber(participants, language))}
        </Text>
      </View>
      <Image source={SW_ASSET.usersDuo} style={sw.statsIcon} contentFit="contain" transition={0} />

      <Image
        source={SW_ASSET.dividerVertical}
        style={sw.statsDivider}
        contentFit="fill"
        transition={0}
      />

      {/* Current points */}
      <View style={[sw.statsCol, { width: s(80) }]}>
        <Text style={sw.statsLabel}>{copy.statsCurrentPoints}</Text>
        <GradientText colors={SW_GRADIENT.purpleText} style={sw.statsValue}>
          {`${formatNumber(score, language)} xp`}
        </GradientText>
      </View>

      {/* XP hexagon badge */}
      <View style={sw.statsXpBadge}>
        <Image
          source={SW_ASSET.xpPolygon}
          style={{ position: 'absolute', width: s(26), height: s(26) }}
          contentFit="contain"
          transition={0}
        />
        <GradientText
          colors={XP_BADGE_GRADIENT}
          locations={XP_BADGE_LOCATIONS}
          style={sw.statsXpBadgeText}
        >
          XP
        </GradientText>
      </View>

      <Image
        source={SW_ASSET.dividerVertical}
        style={sw.statsDivider}
        contentFit="fill"
        transition={0}
      />

      {/* Rank this week */}
      <View style={[sw.statsCol, { width: s(76) }]}>
        <Text style={sw.statsLabel}>{copy.statsRankThisWeek}</Text>
        <GradientText colors={SW_GRADIENT.purpleText} style={sw.statsValue}>
          {`#${formatNumber(rank, language)}`}
        </GradientText>
      </View>
      <Image source={SW_ASSET.chartLine} style={sw.statsIcon} contentFit="contain" transition={0} />
    </View>
  );
});

export default StatsBar;
