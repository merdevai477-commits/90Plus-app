/**
 * Monthly prizes — Figma 2010:5799.
 * Featured + secondary cards use Figma raster backgrounds (compressed JPEG).
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useTranslation } from '../../../src/i18n';
import { getAppFont } from '../../../utils/fontSetup';
import type { ShareWinPrize } from '../../../services/shareWin.service';
import { SW_ASSET } from '../assets';
import { prizeCopy } from '../data';
import { useShareWinStyles } from '../styles';

interface WeeklyPrizesProps {
  prizes: ShareWinPrize[];
}

const WeeklyPrizes = memo(function WeeklyPrizes({ prizes }: WeeklyPrizesProps) {
  const { metrics, theme } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const { s, f } = metrics;
  const mirrorRtl = language === 'ar';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          width: '100%',
          gap: s(19),
        },
        header: {
          flexDirection: mirrorRtl ? 'row' : 'row-reverse',
          alignItems: 'center',
          justifyContent: mirrorRtl ? 'flex-end' : 'flex-start',
          gap: s(8),
          alignSelf: mirrorRtl ? 'flex-end' : 'flex-start',
        },
        title: {
          fontFamily: getAppFont(700, language),
          fontSize: f(18),
          color: theme.ink,
          textAlign: mirrorRtl ? 'right' : 'left',
        },
        gift: {
          width: s(25),
          height: s(25),
        },
        stack: {
          width: '100%',
          gap: s(22),
        },
        featured: {
          width: '100%',
          height: s(341),
          borderRadius: s(28),
          overflow: 'hidden',
        },
        featuredBg: {
          ...StyleSheet.absoluteFillObject,
          width: '100%',
          height: '100%',
        },
        featuredLabels: {
          position: 'absolute',
          top: s(24),
          left: 0,
          right: 0,
          alignItems: 'center',
          gap: s(6),
          zIndex: 2,
          paddingHorizontal: s(12),
        },
        placeRow: {
          flexDirection: mirrorRtl ? 'row' : 'row-reverse',
          alignItems: 'center',
          gap: s(4),
        },
        placeLabel: {
          fontFamily: getAppFont(600, language),
          fontSize: f(14),
          color: '#DEDEDE',
          textAlign: 'center',
        },
        medal: {
          width: s(17),
          height: s(17),
        },
        featuredTitle: {
          fontFamily: getAppFont(700, language),
          fontSize: f(30),
          color: theme.accent,
          textAlign: 'center',
        },
        secondary: {
          width: '100%',
          height: s(255),
          borderRadius: s(17),
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingHorizontal: s(10),
          paddingTop: s(10),
          paddingBottom: s(10),
          gap: s(4),
        },
        secondaryBg: {
          ...StyleSheet.absoluteFillObject,
          width: '100%',
          height: '100%',
        },
        secondaryPlace: {
          fontFamily: getAppFont(600, language),
          fontSize: f(12),
          color: '#E9E9E9',
          textAlign: 'center',
        },
        secondaryTitle: {
          fontFamily: getAppFont(700, language),
          fontSize: f(20),
          color: theme.white,
          textAlign: 'center',
          zIndex: 2,
        },
        secondaryImage: {
          width: '100%',
          height: s(155),
          zIndex: 2,
        },
      }),
    [f, language, mirrorRtl, s, theme],
  );

  if (prizes.length === 0) return null;

  const featured = prizes[0];
  const featuredCopy = prizeCopy(featured, language);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {copy.prizesTitle}
        </Text>
        <Image source={SW_ASSET.giftV2} style={styles.gift} contentFit="contain" transition={0} />
      </View>

      <View style={styles.stack}>
        {/* Featured — full Figma card art includes PS5 + rays */}
        <View style={styles.featured}>
          <Image
            source={SW_ASSET.prizeFeaturedBg}
            style={styles.featuredBg}
            contentFit="cover"
            contentPosition="center"
            transition={150}
            cachePolicy="memory-disk"
          />
          <View style={styles.featuredLabels}>
            <View style={styles.placeRow}>
              <Text style={styles.placeLabel}>{copy.firstPlace}</Text>
              <Image
                source={SW_ASSET.medal1stV2}
                style={styles.medal}
                contentFit="contain"
                transition={0}
              />
            </View>
            <Text style={styles.featuredTitle} numberOfLines={1}>
              {featuredCopy.title || 'PlayStation 5'}
            </Text>
          </View>
        </View>

        {/* Secondary — Figma bg + jerseys row */}
        <View style={styles.secondary}>
          <Image
            source={SW_ASSET.prizeSecondaryBg}
            style={styles.secondaryBg}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
          <View style={[styles.placeRow, { zIndex: 2 }]}>
            <Text style={styles.secondaryPlace}>{copy.secondThirdPlace}</Text>
            <Image
              source={SW_ASSET.rankingV2}
              style={styles.medal}
              contentFit="contain"
              transition={0}
            />
          </View>
          <Text style={styles.secondaryTitle} numberOfLines={1}>
            {copy.favoriteKitTitle}
          </Text>
          <Image
            source={SW_ASSET.prizeJerseysRow}
            style={styles.secondaryImage}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
          />
        </View>
      </View>
    </View>
  );
});

export default WeeklyPrizes;
