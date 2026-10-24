/**
 * Top Scorers Five hub — entered from Rank.
 *
 * Layout note: never put `flex:1` on a Pressable whose children are all
 * absolutely positioned — RN collapses it (tiny overlapping junk at the top,
 * huge black void below). Flex lives on a View wrapper; Pressable fills it.
 */

import { useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { useAppFont, useScreenFont } from '../../utils/fontSetup';

import { TSF_ART, TSF_DESIGN_WIDTH, TSF_HUB_LOGO } from './assets';

const BG = '#030303';
const EUROPE_TITLE = '#E8D6FF';
const EGYPT_TITLE = '#FFF8EC';
const CTA_PURPLE = '#A78BFA';
const GOLD = 'rgba(212, 175, 105, 0.9)';
const CARD_GAP = 12;
const CARD_RADIUS = 20;
const CARD_MIN_READABLE = 300;

type Accent = 'europe' | 'egypt';

type ChallengeCardProps = {
  testID: string;
  title: string;
  subtitle: string;
  titleColor: string;
  image: number | null;
  logo: number;
  logoTint?: string;
  accent: Accent;
  badgeGoal: string;
  badgePlayers: string;
  exploreCta: string;
  isAr: boolean;
  s: (n: number) => number;
  /** Explicit pixel height — always set so layout never depends on Pressable flex. */
  height: number;
  fontHeavy: string | undefined;
  fontSemi: string | undefined;
  fontMedium: string | undefined;
  onPress: () => void;
};

function ChallengeCard({
  testID,
  title,
  subtitle,
  titleColor,
  image,
  logo,
  logoTint,
  accent,
  badgeGoal,
  badgePlayers,
  exploreCta,
  isAr,
  s,
  height,
  fontHeavy,
  fontSemi,
  fontMedium,
  onPress,
}: ChallengeCardProps) {
  const logoSize = s(64);
  const badgeBorder =
    accent === 'egypt' ? 'rgba(212,175,105,0.45)' : 'rgba(167,139,250,0.45)';
  const badgeText = accent === 'egypt' ? GOLD : 'rgba(232,214,255,0.95)';
  const ctaColor = accent === 'egypt' ? GOLD : CTA_PURPLE;

  return (
    <View style={[styles.cardShell, { height, borderRadius: s(CARD_RADIUS) }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${exploreCta}`}
        testID={testID}
        style={({ pressed }) => [
          StyleSheet.absoluteFillObject,
          { opacity: pressed ? 0.94 : 1, transform: [{ scale: pressed ? 0.988 : 1 }] },
        ]}
      >
        <View style={styles.art} pointerEvents="none">
          {image != null ? (
            <Image
              source={image as ImageSourcePropType}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="top"
              cachePolicy="memory-disk"
              priority="high"
              transition={0}
            />
          ) : (
            <LinearGradient
              colors={
                accent === 'egypt'
                  ? ['#5A1F2A', '#3A1520', '#1A0A0E', BG]
                  : ['#5B21B6', '#3B0F7A', '#14052E', BG]
              }
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            colors={['rgba(3,3,3,0.22)', 'rgba(3,3,3,0)', 'rgba(3,3,3,0)']}
            locations={[0, 0.18, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(3,3,3,0)', 'rgba(3,3,3,0.4)', 'rgba(3,3,3,0.94)']}
            locations={[0.48, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={[styles.content, { paddingHorizontal: s(20), paddingBottom: s(18) }]}>
          <View style={styles.spacer} />

          <View
            style={[
              styles.logoWrap,
              {
                width: logoSize + s(14),
                height: logoSize + s(14),
                borderRadius: (logoSize + s(14)) / 2,
              },
            ]}
          >
            <Image
              source={logo}
              style={{
                width: logoSize,
                height: logoSize,
                ...(logoTint ? { tintColor: logoTint } : null),
              }}
              contentFit="contain"
              transition={0}
            />
          </View>

          <View
            style={[
              styles.badgeRow,
              {
                marginTop: s(10),
                gap: s(8),
                flexDirection: isAr ? 'row-reverse' : 'row',
              },
            ]}
          >
            <View
              style={[
                styles.badge,
                { borderColor: badgeBorder, paddingHorizontal: s(10), paddingVertical: s(4) },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: badgeText, fontFamily: fontSemi, fontSize: s(10) },
                ]}
                maxFontSizeMultiplier={1.1}
              >
                {badgeGoal}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                { borderColor: badgeBorder, paddingHorizontal: s(10), paddingVertical: s(4) },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: badgeText, fontFamily: fontSemi, fontSize: s(10) },
                ]}
                maxFontSizeMultiplier={1.1}
              >
                {badgePlayers}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.title,
              {
                color: titleColor,
                fontFamily: fontHeavy,
                fontSize: s(24),
                marginTop: s(8),
                textShadowColor: 'rgba(0,0,0,0.75)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
              },
            ]}
            maxFontSizeMultiplier={1.12}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                fontFamily: fontMedium,
                fontSize: s(13),
                lineHeight: s(18),
                marginTop: s(5),
                maxWidth: s(340),
                textShadowColor: 'rgba(0,0,0,0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 5,
              },
            ]}
            maxFontSizeMultiplier={1.12}
          >
            {subtitle}
          </Text>

          <View
            style={[
              styles.ctaRow,
              {
                marginTop: s(12),
                gap: s(6),
                flexDirection: isAr ? 'row-reverse' : 'row',
              },
            ]}
          >
            <Text
              style={[styles.ctaText, { color: ctaColor, fontFamily: fontSemi, fontSize: s(15) }]}
              maxFontSizeMultiplier={1.1}
            >
              {exploreCta}
            </Text>
            <Ionicons
              name={isAr ? 'arrow-back' : 'arrow-forward'}
              size={s(16)}
              color={ctaColor}
            />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export default function TopScorersFiveHubScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { t, language } = useTranslation();
  const copy = t.topScorersFive;
  const hub = copy.hub;
  const isAr = language === 'ar';

  const fontHeavy = useAppFont(800);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);

  const scale = width / TSF_DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);

  const layout = useMemo(() => {
    const padX = s(12);
    const headerH = insets.top + s(48);
    const bottomPad = Math.max(insets.bottom, 10) + s(8);
    const bodyH = Math.max(height - headerH - bottomPad - CARD_GAP, CARD_MIN_READABLE * 2);
    const half = bodyH / 2;
    const needsScroll = half < CARD_MIN_READABLE;
    const cardH = needsScroll ? CARD_MIN_READABLE : half;
    return { padX, headerH, bottomPad, needsScroll, cardH };
  }, [height, insets.bottom, insets.top, s]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/rank' as never);
  }, [router]);

  const openEurope = useCallback(() => {
    router.push('/top-scorers-five/pick' as never);
  }, [router]);

  const openEgypt = useCallback(() => {
    router.push({ pathname: '/top-scorers-five/pick', params: { mode: 'egypt' } } as never);
  }, [router]);

  const cards = (
    <>
      <ChallengeCard
        testID="top-scorers-five-hub-europe"
        title={hub.europeTitle}
        subtitle={hub.europeSubtitle}
        titleColor={EUROPE_TITLE}
        image={TSF_ART.hero}
        logo={TSF_HUB_LOGO.europe}
        logoTint="#FFFFFF"
        accent="europe"
        badgeGoal={hub.badgeGoal}
        badgePlayers={hub.badgePlayers}
        exploreCta={hub.exploreCta}
        isAr={isAr}
        s={s}
        height={layout.cardH}
        fontHeavy={fontHeavy}
        fontSemi={fontSemi}
        fontMedium={fontMedium}
        onPress={openEurope}
      />
      <ChallengeCard
        testID="top-scorers-five-hub-egypt"
        title={hub.egyptTitle}
        subtitle={hub.egyptSubtitle}
        titleColor={EGYPT_TITLE}
        image={TSF_ART.egyptHub}
        logo={TSF_HUB_LOGO.egypt}
        logoTint="#FFFFFF"
        accent="egypt"
        badgeGoal={hub.badgeGoal}
        badgePlayers={hub.badgePlayers}
        exploreCta={hub.exploreCta}
        isAr={isAr}
        s={s}
        height={layout.cardH}
        fontHeavy={fontHeavy}
        fontSemi={fontSemi}
        fontMedium={fontMedium}
        onPress={openEgypt}
      />
    </>
  );

  return (
    <View style={styles.root}>
      {layout.needsScroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingTop: layout.headerH,
            paddingBottom: layout.bottomPad,
            paddingHorizontal: layout.padX,
            gap: CARD_GAP,
          }}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {cards}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.fillColumn,
            {
              paddingTop: layout.headerH,
              paddingBottom: layout.bottomPad,
              paddingHorizontal: layout.padX,
              gap: CARD_GAP,
            },
          ]}
        >
          {cards}
        </View>
      )}

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + s(8),
            paddingLeft: Math.max(insets.left, s(16)),
            paddingRight: Math.max(insets.right, s(16)),
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={12}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          testID="top-scorers-five-hub-back"
          style={[styles.backButton, { width: s(40), height: s(40), borderRadius: s(20) }]}
        >
          <Ionicons name="arrow-back" size={s(22)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  fillColumn: { flex: 1 },
  cardShell: {
    overflow: 'hidden',
    backgroundColor: '#0A0614',
  },
  art: { ...StyleSheet.absoluteFillObject },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  spacer: { flex: 1 },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  badgeRow: {
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  badgeText: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { textAlign: 'center' },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    alignSelf: 'center',
  },
  ctaRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {},
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'flex-start',
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
