/**
 * Prizes podium — Figma nodes 1536:3235 / 1538:3403 / 1540:3499 / 1538:3311.
 *
 * Layout:
 *   1. Featured gold card  → prizes[0]  (الفائز الأول — PS5)
 *   2. Side-by-side pair    → prizes[1], prizes[2]  (الفائز الثاني / الثالث)
 *   3. "باقي الفائزين"     → prizes.slice(3)
 */

import React, { memo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../../src/i18n';
import type { ShareWinPrize } from '../../../services/shareWin.service';
import { SW_ASSET } from '../assets';
import { prizeCopy, prizeImageSource, winnerBadge } from '../data';
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
        {/* Featured — 1st winner (PS5) */}
        <View style={sw.prizeFeaturedCard}>
          <View style={sw.prizeFeaturedImageWrap}>
            <Image
              source={prizeImageSource(featured, 0)}
              style={sw.prizeFeaturedImage}
              contentFit="cover"
              contentPosition="center"
              transition={150}
              cachePolicy="memory-disk"
            />
            <View style={sw.prizeFeaturedBadge}>
              <Text style={sw.prizeFeaturedBadgeText}>{winnerBadge(0, language)}</Text>
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

        {/* 2nd & 3rd winners — jersey + stars kit */}
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
                      <Text style={sw.prizeSecondaryBadgeText}>{winnerBadge(index, language)}</Text>
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

        {/* Remaining winners */}
        {remaining.length > 0 ? (
          <View style={sw.prizeRemainingSection}>
            <View style={sw.prizeRemainingHeader}>
              <Image
                source={SW_ASSET.chevronDown}
                style={{ width: s(24), height: s(24), transform: [{ scaleY: -1 }] }}
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
                  <View key={`${prize.id}-${index}`} style={sw.prizeMiniCard}>
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
