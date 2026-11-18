/**
 * Monthly prizes — Figma Frame123 nodes 2010:5799 / 2003:5549 / 2003:5550.
 * Featured PS5 card + secondary jersey card.
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../../src/i18n';
import type { ShareWinPrize } from '../../../services/shareWin.service';
import { SW_ASSET } from '../assets';
import { prizeCopy, prizeImageSource } from '../data';
import { useShareWinStyles } from '../styles';

interface WeeklyPrizesProps {
  prizes: ShareWinPrize[];
}

const WeeklyPrizes = memo(function WeeklyPrizes({ prizes }: WeeklyPrizesProps) {
  const { metrics, theme } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const { s, f } = metrics;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          width: '100%',
          gap: s(19),
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: s(8),
        },
        title: {
          fontSize: f(18),
          fontWeight: '700',
          color: theme.ink,
          textAlign: 'right',
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
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingHorizontal: s(10),
          paddingBottom: s(19),
          paddingTop: s(10),
        },
        featuredLabels: {
          position: 'absolute',
          top: s(24),
          alignItems: 'center',
          gap: s(6),
          zIndex: 2,
        },
        placeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(4),
        },
        placeLabel: {
          fontSize: f(14),
          fontWeight: '600',
          color: '#DEDEDE',
          textAlign: 'center',
        },
        medal: {
          width: s(17),
          height: s(17),
        },
        featuredTitle: {
          fontSize: f(30),
          fontWeight: '700',
          color: theme.accent,
          textAlign: 'center',
        },
        featuredImage: {
          width: '92%',
          height: s(220),
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
        secondaryPlace: {
          fontSize: f(12),
          fontWeight: '600',
          color: '#E9E9E9',
          textAlign: 'center',
        },
        secondaryTitle: {
          fontSize: f(20),
          fontWeight: '700',
          color: theme.white,
          textAlign: 'center',
        },
        secondaryImage: {
          width: '100%',
          height: s(160),
        },
      }),
    [f, s, theme],
  );

  if (prizes.length === 0) return null;

  const featured = prizes[0];
  const featuredCopy = prizeCopy(featured, language);
  const secondary = prizes[1] ?? prizes[0];
  const secondaryCopy = prizeCopy(secondary, language);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {copy.prizesTitle}
        </Text>
        <Image source={SW_ASSET.giftV2} style={styles.gift} contentFit="contain" transition={0} />
      </View>

      <View style={styles.stack}>
        <LinearGradient
          colors={[...theme.prizeFeaturedGradient]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.featured}
        >
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
          <Image
            source={prizeImageSource(featured, 0)}
            style={styles.featuredImage}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
          />
        </LinearGradient>

        <LinearGradient
          colors={[...theme.prizeSecondaryGradient]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.secondary}
        >
          <View style={styles.placeRow}>
            <Text style={styles.secondaryPlace}>{copy.secondThirdPlace}</Text>
            <Image
              source={SW_ASSET.rankingV2}
              style={styles.medal}
              contentFit="contain"
              transition={0}
            />
          </View>
          <Text style={styles.secondaryTitle} numberOfLines={1}>
            {copy.favoriteKitTitle || secondaryCopy.title}
          </Text>
          <Image
            source={prizeImageSource(secondary, 1)}
            style={styles.secondaryImage}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
          />
        </LinearGradient>
      </View>
    </View>
  );
});

export default WeeklyPrizes;
