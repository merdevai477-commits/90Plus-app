/**
 * Monthly prizes — Figma node 758:2114.
 *
 * Layout (not a flat carousel):
 *   1. Featured gold card  → prizes[0]  (الشهر الأول)
 *   2. Side-by-side pair    → prizes[1], prizes[2]
 *   3. "باقي الشهور" track → prizes.slice(3)
 */

import React, { memo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../../src/i18n';
import type { ShareWinPrize } from '../../../services/shareWin.service';
import { SW_ASSET } from '../assets';
import { monthBadge, prizeCopy, prizeImageSource } from '../data';
import { useShareWinStyles } from '../styles';

interface WeeklyPrizesProps {
  prizes: ShareWinPrize[];
}

const WeeklyPrizes = memo(function WeeklyPrizes({ prizes }: WeeklyPrizesProps) {
  const { sw, metrics } = useShareWinStyles();
  const { t, language, isRTL } = useTranslation();
  const copy = t.shareWin;
  const { s } = metrics;

  if (prizes.length === 0) return null;

  const featured = prizes[0];
  const featuredCopy = prizeCopy(featured, language);
  const secondary = prizes.slice(1, 3);
  const remaining = prizes.slice(3);

  return (
    <View style={sw.prizesSection}>
      <View style={sw.prizesHeader}>
        <View style={sw.prizesTitleRow}>
          <Image
            source={SW_ASSET.ruleLeft}
            style={[sw.prizesRule, { transform: [{ rotate: '180deg' }, { scaleY: -1 }] }]}
            contentFit="contain"
            transition={0}
          />
          <Text style={sw.prizesTitle} accessibilityRole="header">
            {copy.prizesTitle}
          </Text>
          <Image
            source={SW_ASSET.ruleRight}
            style={sw.prizesRule}
            contentFit="contain"
            transition={0}
          />
        </View>

        <Text style={sw.prizesSubtitle}>
          {copy.prizesSubtitleLine1}
          {'\n'}
          {copy.prizesSubtitleLine2}
        </Text>
      </View>

      <View style={sw.prizesStack}>
        {/* Featured — month 1 */}
        <View style={sw.prizeFeaturedCard}>
          <View style={sw.prizeFeaturedImageWrap}>
            <Image
              source={prizeImageSource(featured, 0)}
              style={sw.prizeFeaturedImage}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            />
            <View style={sw.prizeFeaturedBadge}>
              <Text style={sw.prizeFeaturedBadgeText}>{monthBadge(0, language)}</Text>
            </View>
          </View>
          <View style={sw.prizeFeaturedCopy}>
            <Text style={sw.prizeFeaturedTitle} numberOfLines={1}>
              {featuredCopy.title}
            </Text>
            <Text style={sw.prizeFeaturedSubtitle} numberOfLines={2}>
              {featuredCopy.subtitle}
            </Text>
          </View>
        </View>

        {/* Months 2 & 3 */}
        {secondary.length > 0 ? (
          <View style={sw.prizeSecondaryRow}>
            {secondary.map((prize, offset) => {
              const index = offset + 1;
              const text = prizeCopy(prize, language);
              return (
                <View key={prize.id} style={sw.prizeSecondaryCard}>
                  <View style={sw.prizeSecondaryImageWrap}>
                    <Image
                      source={prizeImageSource(prize, index)}
                      style={sw.prizeSecondaryImage}
                      contentFit="cover"
                      contentPosition="center"
                      transition={150}
                      cachePolicy="memory-disk"
                    />
                    <View style={sw.prizeSecondaryBadge}>
                      <Text style={sw.prizeSecondaryBadgeText}>{monthBadge(index, language)}</Text>
                    </View>
                  </View>
                  <View style={sw.prizeSecondaryCopy}>
                    <Text style={sw.prizeSecondaryTitle} numberOfLines={2}>
                      {text.title}
                    </Text>
                    <Text style={sw.prizeSecondarySubtitle} numberOfLines={1}>
                      {text.subtitle}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Remaining months */}
        {remaining.length > 0 ? (
          <View style={sw.prizeRemainingSection}>
            <View style={sw.prizeRemainingHeader}>
              <Image
                source={SW_ASSET.chevronDown}
                style={{ width: s(24), height: s(24) }}
                contentFit="contain"
                transition={0}
              />
              <Text style={sw.prizeRemainingHeaderText}>{copy.remainingMonthsTitle}</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={sw.prizeRemainingTrack}
              {...(isRTL ? { contentOffset: { x: 0, y: 0 } } : {})}
            >
              {remaining.map((prize, offset) => {
                const index = offset + 3;
                const text = prizeCopy(prize, language);
                return (
                  <View key={prize.id} style={sw.prizeMiniCard}>
                    <Image
                      source={prizeImageSource(prize, index)}
                      style={sw.prizeMiniImage}
                      contentFit="cover"
                      transition={150}
                      cachePolicy="memory-disk"
                    />
                    <LinearGradient
                      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
                      locations={[0.5, 0.794]}
                      style={sw.prizeMiniScrim}
                    />
                    <View style={sw.prizeMiniCopy}>
                      <Text style={sw.prizeMiniTitle} numberOfLines={1}>
                        {text.title}
                      </Text>
                      <Text style={sw.prizeMiniSubtitle} numberOfLines={1}>
                        {text.subtitle}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </View>
  );
});

export default WeeklyPrizes;
