/**
 * Weekly prizes carousel — Figma node 161:79.
 *
 * Prizes come from the current cycle (`/share-win/me`), so a new week can ship
 * a different line-up without an app release. Art falls back to the bundled
 * Figma exports when a prize has no remote image.
 */

import React, { memo, useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../../src/i18n';
import type { ShareWinPrize } from '../../../services/shareWin.service';
import { SW_ASSET } from '../assets';
import { prizeCopy, prizeImageSource } from '../data';
import { SW_GRADIENT, useShareWinStyles } from '../styles';
import { getCarouselPageCount } from './carouselPagination';

interface WeeklyPrizesProps {
  prizes: ShareWinPrize[];
}

const WeeklyPrizes = memo(function WeeklyPrizes({ prizes }: WeeklyPrizesProps) {
  const { sw, metrics } = useShareWinStyles();
  const { t, language, isRTL } = useTranslation();
  const copy = t.shareWin;
  const { s } = metrics;

  const [activeIndex, setActiveIndex] = useState(0);
  const cardStride = useRef(s(127) + s(12));
  cardStride.current = s(127) + s(12);
  const pageCount = getCarouselPageCount(prizes.length);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = Math.abs(event.nativeEvent.contentOffset.x);
    const activeGiftIndex = Math.round(offset / cardStride.current);
    const nextPageIndex = Math.floor(activeGiftIndex / 3);
    setActiveIndex(Math.min(nextPageIndex, Math.max(pageCount - 1, 0)));
  }, [pageCount]);

  if (prizes.length === 0) return null;

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

      <View style={sw.prizesCarousel}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={sw.prizesTrackContent}
          onScroll={handleScroll}
          scrollEventThrottle={32}
          // RTL: start the track at the visual right, matching the Figma frame.
          {...(isRTL ? { contentOffset: { x: 0, y: 0 } } : {})}
        >
          {prizes.map((prize, index) => {
            const isActive = index === activeIndex;
            const text = prizeCopy(prize, language);
            return (
              <View
                key={prize.id}
                style={[sw.prizeCard, isActive ? sw.prizeCardActive : sw.prizeCardIdle]}
              >
                <Image
                  source={prizeImageSource(prize, index)}
                  style={sw.prizeImage}
                  contentFit="cover"
                  contentPosition={isActive ? 'center' : 'bottom'}
                  transition={150}
                  cachePolicy="memory-disk"
                />
                <View style={[sw.prizeCopy, !isActive && sw.prizeCopyIdle]}>
                  <Text style={sw.prizeTitle} numberOfLines={1}>
                    {text.title}
                  </Text>
                  <Text style={sw.prizeSubtitle} numberOfLines={1}>
                    {text.subtitle}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={sw.dotsRow}>
          {Array.from({ length: pageCount }, (_, index) => (
            <View key={`dot-${index}`} style={sw.dot}>
              <LinearGradient
                colors={index === activeIndex ? SW_GRADIENT.dotActive : SW_GRADIENT.dotIdle}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ flex: 1 }}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
});

export default WeeklyPrizes;
