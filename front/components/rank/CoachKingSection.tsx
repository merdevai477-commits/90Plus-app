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
const PROMO_RATIO = 404 / 161;

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
  const bannerWidth = width - 44;
  const dir = isAr ? 'rtl' : 'ltr';

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
