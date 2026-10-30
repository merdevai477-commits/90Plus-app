import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import {
  CoachArrowIcon,
  CoachFieldIcon,
  CoachTrophyIcon,
  CoachUsersIcon,
} from './CoachKingIcons';

const PAGE_BG = '#030303';
const CARD_HINT = '#BBA1F6';
const CARD_BG = '#09001D';
const CARD_BORDER = '#241152';
const PROMO = require('../../assets/images/coach-king/banner/promo.png');
const WEEK_HERO = require('../../assets/images/coach-king/coach-week-hero.png');
const WEEK_BADGE = require('../../assets/images/coach-king/coach-week-badge.svg');
const PROMO_RATIO = 404 / 161;

export type CoachKingCopy = {
  title: string;
  weekTitle: string;
  hero: string;
  subtitle: string;
  brand: string;
  squad: string;
  squadHint: string;
  tactics: string;
  tacticsHint: string;
  matches: string;
  matchesHint: string;
  start: string;
};

type Fonts = { medium: string; semibold: string; bold: string; extrabold: string };

type Pillar = {
  key: string;
  title: string;
  hint: string;
  Icon: React.ComponentType;
};

interface Props {
  isAr: boolean;
  fonts: Fonts;
  copy: CoachKingCopy;
  onStart?: () => void;
}

/** Rank landing — pillars, Coach of the Week card (Figma 1550:6500), jersey promo, CTA. */
export default function CoachKingSection({ isAr, fonts, copy, onStart }: Props) {
  const { width } = useWindowDimensions();
  const bannerWidth = width - 44;
  const dir = isAr ? 'rtl' : 'ltr';
  const headerRow = isAr ? ('row' as const) : ('row-reverse' as const);

  const pillars: Pillar[] = [
    { key: 'squad', title: copy.squad, hint: copy.squadHint, Icon: CoachUsersIcon },
    { key: 'tactics', title: copy.tactics, hint: copy.tacticsHint, Icon: CoachFieldIcon },
    { key: 'matches', title: copy.matches, hint: copy.matchesHint, Icon: CoachTrophyIcon },
  ];

  return (
    <View style={s.root} testID="coach-king-section">
      <View style={s.cards}>
        {pillars.map(({ key, title, hint, Icon }) => (
          <View key={key} style={s.card}>
            <View style={s.cardIcon}>
              <Icon />
            </View>
            <View style={s.cardCopy}>
              <Text
                style={[s.cardTitle, { fontFamily: fonts.bold, writingDirection: dir }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {title}
              </Text>
              <Text
                style={[s.cardHint, { fontFamily: fonts.medium, writingDirection: dir }]}
                numberOfLines={1}
              >
                {hint}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Coach of the Week — sits above the jersey promo (Figma 1550:6500). */}
      <View style={s.weekCard} testID="coach-week-card">
        <View style={[s.weekHeader, { flexDirection: headerRow }]}>
          <Image source={WEEK_BADGE} style={s.weekBadge} contentFit="contain" transition={0} />
          <View style={[s.weekCopy, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}>
            <Text
              style={[
                s.weekTitle,
                { fontFamily: fonts.bold, writingDirection: dir, textAlign: isAr ? 'right' : 'left' },
              ]}
              numberOfLines={1}
            >
              {copy.weekTitle}
            </Text>
            <Text
              style={[
                s.weekSubtitle,
                {
                  fontFamily: fonts.medium,
                  writingDirection: dir,
                  textAlign: isAr ? 'right' : 'left',
                },
              ]}
              numberOfLines={2}
            >
              {copy.subtitle}
            </Text>
          </View>
        </View>

        <View style={s.weekHeroWrap}>
          <Image
            source={WEEK_HERO}
            style={s.weekHero}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityLabel={copy.weekTitle}
          />
        </View>

        <Pressable
          onPress={onStart}
          disabled={!onStart}
          accessibilityRole="button"
          accessibilityLabel={copy.start}
          testID="coach-week-start"
          style={({ pressed }) => [s.weekCtaHit, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={['#8B5CF6', '#2E146A']}
            locations={[0, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={s.weekCta}
          >
            <Text style={[s.weekCtaTxt, { fontFamily: fonts.semibold }]}>{copy.start}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View
        style={[s.banner, { borderRadius: Math.round(20 * (bannerWidth / 404)) }]}
        accessibilityRole="image"
        accessibilityLabel={copy.title}
      >
        <Image
          source={PROMO}
          style={{ width: '100%', aspectRatio: PROMO_RATIO }}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessibilityLabel={copy.title}
        />
      </View>

      <Pressable
        onPress={onStart}
        disabled={!onStart}
        accessibilityRole="button"
        accessibilityLabel={copy.start}
        testID="coach-king-start"
        style={({ pressed }) => [s.ctaHit, pressed && { opacity: 0.92 }]}
      >
        <View style={s.ctaClip}>
          <LinearGradient
            colors={['#8B5CF6', '#2E146A']}
            locations={[0.12, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.ctaRow}>
            <CoachArrowIcon />
            <Text style={[s.ctaTxt, { fontFamily: fonts.semibold }]}>{copy.start}</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    marginTop: 8,
    backgroundColor: PAGE_BG,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 18,
  },
  cards: {
    flexDirection: 'row',
    gap: 10,
    height: 130,
  },
  card: {
    flex: 1,
    minWidth: 0,
    height: 130,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 14,
  },
  cardIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardHint: {
    color: CARD_HINT,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  weekCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: 'rgba(46,6,165,0.2)',
    paddingHorizontal: 22,
    paddingVertical: 17,
    gap: 14,
    alignItems: 'center',
    // Soft purple inner glow
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.39,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  weekHeader: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  weekBadge: {
    width: 78,
    height: 72,
  },
  weekCopy: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minWidth: 0,
  },
  weekTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  weekSubtitle: {
    color: '#B1B1B1',
    fontSize: 14,
    fontWeight: '400',
  },
  weekHeroWrap: {
    width: '100%',
    height: 238,
    borderRadius: 16,
    overflow: 'hidden',
  },
  weekHero: {
    width: '100%',
    height: '100%',
  },
  weekCtaHit: {
    width: '100%',
  },
  weekCta: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 23,
  },
  weekCtaTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  banner: {
    width: '100%',
    overflow: 'hidden',
  },
  ctaHit: {
    width: '100%',
    alignSelf: 'stretch',
  },
  ctaClip: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 58,
  },
  ctaTxt: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
});
