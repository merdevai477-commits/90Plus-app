import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import {
  CoachArrowIcon,
  CoachCrownIcon,
  CoachFieldIcon,
  CoachTrophyIcon,
  CoachUsersIcon,
} from './CoachKingIcons';

const PAGE_BG = '#030303';
const SUBTITLE = '#D0D0D0';
const CARD_HINT = '#BBA1F6';
const CARD_BG = '#09001D';
const CARD_BORDER = '#241152';
const WATERMARK = 'rgba(166,128,253,0.40)';
const PROMO_ASPECT = 404 / 161;

const HERO = require('../../assets/images/coach-king/hero.jpg');
const PROMO = require('../../assets/images/coach-king/promo.png');

export type CoachKingCopy = {
  title: string;
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

export default function CoachKingSection({ isAr, fonts, copy, onStart }: Props) {
  const { width } = useWindowDimensions();
  const photoHeight = Math.round(Math.min(width * 1.18, 470));
  const promoWidth = width - 44;
  const promoHeight = Math.round(promoWidth / PROMO_ASPECT);
  const dir = isAr ? 'rtl' : 'ltr';

  const pillars: Pillar[] = [
    { key: 'squad', title: copy.squad, hint: copy.squadHint, Icon: CoachUsersIcon },
    { key: 'tactics', title: copy.tactics, hint: copy.tacticsHint, Icon: CoachFieldIcon },
    { key: 'matches', title: copy.matches, hint: copy.matchesHint, Icon: CoachTrophyIcon },
  ];

  return (
    <View style={s.root} testID="coach-king-section">
      <View style={[s.photo, { height: photoHeight }]}>
        <Image
          source={HERO}
          style={s.photoImg}
          contentFit="cover"
          contentPosition="center"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={['transparent', 'transparent', PAGE_BG]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <Text
          style={[
            s.sectionTitle,
            { fontFamily: fonts.semibold, writingDirection: dir },
          ]}
        >
          {copy.title}
        </Text>

        <View style={s.heroCopy}>
          <CoachCrownIcon />
          <View style={s.heroRotate}>
            <Text style={[s.heroTitle, { fontFamily: fonts.extrabold }]}>{copy.hero}</Text>
            <Text
              style={[s.heroSub, { fontFamily: fonts.medium, writingDirection: dir }]}
            >
              {copy.subtitle}
            </Text>
          </View>
        </View>

        <Text pointerEvents="none" style={[s.watermark, { fontFamily: fonts.bold }]}>
          {copy.brand}
        </Text>
      </View>

      <View style={s.body}>
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

        <View style={[s.promo, { width: promoWidth, height: promoHeight }]}>
          <Image
            source={PROMO}
            style={StyleSheet.absoluteFill}
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
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    marginTop: 8,
    backgroundColor: PAGE_BG,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    overflow: 'hidden',
  },
  photoImg: {
    ...StyleSheet.absoluteFillObject,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 18,
  },
  heroCopy: {
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  heroRotate: {
    alignItems: 'center',
    transform: [{ rotate: '-5deg' }],
    paddingHorizontal: 20,
  },
  heroTitle: {
    color: '#F4EEFF',
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSub: {
    color: SUBTITLE,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  watermark: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    width: '100%',
    color: WATERMARK,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    marginTop: -72,
    paddingHorizontal: 22,
    paddingBottom: 36,
    gap: 18,
    zIndex: 2,
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
  promo: {
    alignSelf: 'center',
    borderRadius: 20,
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
