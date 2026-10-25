import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, Crown, Play, Shirt, Target } from 'lucide-react-native';

const CTA = '#8C5CF5';
const SUBTITLE = '#D1D1D1';
const CARD_HINT = '#BAA1F7';
const CARD_BG = '#0A001C';
const CARD_BORDER = '#240F52';
const WATERMARK = 'rgba(166,128,252,0.40)';
const MAROON = 'rgba(128,59,69,0.50)';

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
  Icon: typeof Shirt;
};

interface Props {
  isAr: boolean;
  fonts: Fonts;
  copy: CoachKingCopy;
  onStart?: () => void;
}

export default function CoachKingSection({ isAr, fonts, copy, onStart }: Props) {
  const pillars: Pillar[] = [
    { key: 'squad', title: copy.squad, hint: copy.squadHint, Icon: Shirt },
    { key: 'tactics', title: copy.tactics, hint: copy.tacticsHint, Icon: Target },
    { key: 'matches', title: copy.matches, hint: copy.matchesHint, Icon: CalendarDays },
  ];

  return (
    <View style={s.root} testID="coach-king-section">
      <View style={s.bg} pointerEvents="none">
        <Image
          source={require('../../assets/images/arena.jpg')}
          style={s.arena}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <LinearGradient colors={[MAROON, 'rgba(10,0,28,0.55)', '#0A0612']} style={StyleSheet.absoluteFill} />
      </View>

      <Text style={[s.sectionTitle, { fontFamily: fonts.semibold, writingDirection: isAr ? 'rtl' : 'ltr' }]}>
        {copy.title}
      </Text>

      <View style={s.hero}>
        <View style={s.crownBox}>
          <Crown size={22} color="#F5E9FF" fill="rgba(168,85,247,0.35)" />
        </View>
        <Text style={[s.heroTitle, { fontFamily: fonts.extrabold }]}>{copy.hero}</Text>
        <Text style={[s.heroSub, { fontFamily: fonts.medium }]}>{copy.subtitle}</Text>
      </View>

      <Text pointerEvents="none" style={[s.watermark, { fontFamily: fonts.bold }]}>
        {copy.brand}
      </Text>

      <View style={[s.cards, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
        {pillars.map(({ key, title, hint, Icon }) => (
          <View key={key} style={s.card}>
            <View style={s.cardIcon}>
              <Icon size={22} color="#E9D5FF" strokeWidth={2.1} />
            </View>
            <Text style={[s.cardTitle, { fontFamily: fonts.bold }]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={[s.cardHint, { fontFamily: fonts.medium }]} numberOfLines={1}>
              {hint}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onStart}
        disabled={!onStart}
        accessibilityRole="button"
        accessibilityLabel={copy.start}
        testID="coach-king-start"
        style={({ pressed }) => [s.ctaHit, pressed && { opacity: 0.9 }]}
      >
        <View style={s.cta}>
          <Play size={18} color="#FFF" fill="#FFF" />
          <Text style={[s.ctaTxt, { fontFamily: fonts.semibold }]}>{copy.start}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    marginTop: 8,
    paddingTop: 18,
    paddingBottom: 28,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
  },
  arena: {
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 18,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  crownBox: {
    width: 48,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(39,8,94,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    marginBottom: 10,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 34,
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
  },
  watermark: {
    color: WATERMARK,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  cards: {
    gap: 10,
    height: 130,
    marginBottom: 22,
  },
  card: {
    flex: 1,
    minWidth: 0,
    height: 130,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 8,
  },
  cardIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardHint: {
    color: CARD_HINT,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  ctaHit: {
    width: '100%',
    alignSelf: 'stretch',
  },
  cta: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    backgroundColor: CTA,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ctaTxt: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '600',
  },
});
