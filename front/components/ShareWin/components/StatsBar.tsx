/**
 * Stats bar — Figma node 186:108.
 *
 * The final content section of the page, NOT a footer: it scrolls with
 * everything else and sits 44pt below the last-winner section in the same
 * 404pt column. See `statsBar` in ../styles.ts for the Figma coordinates.
 *
 * Invited friends · participation count · rank this week. All three are read
 * straight from `/share-win/me`; the app never computes a rank.
 * A brand-new user renders 0 / 0 / their real tail rank — no blank slots.
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
  rank: number;
}

const StatsBar = memo(function StatsBar({ participants, rank }: StatsBarProps) {
  const { sw, metrics } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const { s } = metrics;

  return (
    <View style={sw.statsBar}>
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

      <View style={[sw.statsCol, { width: s(80) }]}>
        <Text style={sw.statsLabel}>{copy.statsShares}</Text>
        <GradientText colors={SW_GRADIENT.purpleText} style={sw.statsValue}>
          {formatNumber(participants, language)}
        </GradientText>
      </View>
      <Image source={SW_ASSET.gift} style={sw.statsIcon} contentFit="contain" transition={0} />

      <Image
        source={SW_ASSET.dividerVertical}
        style={sw.statsDivider}
        contentFit="fill"
        transition={0}
      />

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
