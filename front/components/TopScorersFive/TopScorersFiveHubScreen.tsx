/**
 * Top Scorers Five hub — entered from Rank.
 *
 * Card structure (keeps images painting on Android):
 *   View[height] → Image absolute + gradients absolute → Pressable flex:1
 *     (in-flow column, justify flex-end — no absolute text layer)
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
const GOLD = '#D4AF69';
const CARD_GAP = 12;
const CARD_RADIUS = 20;
const CARD_MIN_READABLE = 300;

type Accent = 'europe' | 'egypt';

type ChallengeCardProps = {
  testID: string;
  title: string;
  subtitle: string;
  titleColor: string;
  image: number;
  logo: number;
  logoTint?: string;
  accent: Accent;
  badgeGoal: string;
  badgePlayers: string;
  exploreCta: string;
  isAr: boolean;
  s: (n: number) => number;
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
  const logoSize = s(72);
  const badgeBorder =
    accent === 'egypt' ? 'rgba(212,175,105,0.55)' : 'rgba(167,139,250,0.55)';
  const badgeText = accent === 'egypt' ? GOLD : '#E8D6FF';
  const ctaColor = accent === 'egypt' ? GOLD : CTA_PURPLE;

  return (
    <View style={[styles.card, { height, borderRadius: s(CARD_RADIUS) }]}>
      {/* Hero sits behind — same pattern as TopScorersFiveScreen (works). */}
      <Image
        source={image}
        style={styles.hero}
        contentFit="cover"
        contentPosition="top"
        cachePolicy="memory-disk"
        priority="high"
        transition={0}
      />
      <LinearGradient
        colors={['rgba(3,3,3,0.15)', 'transparent', 'transparent']}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(3,3,3,0.55)', 'rgba(3,3,3,0.96)']}
        locations={[0.4, 0.7, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${exploreCta}`}
        testID={testID}
        style={({ pressed }) => [styles.press, { opacity: pressed ? 0.92 : 1 }]}
      >
        <View
          style={[
            styles.logoWrap,
            {
              width: logoSize + s(16),
              height: logoSize + s(16),
              borderRadius: (logoSize + s(16)) / 2,
              marginBottom: s(10),
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
            { gap: s(8), marginBottom: s(10), flexDirection: isAr ? 'row-reverse' : 'row' },
          ]}
        >
          <View
            style={[
              styles.badge,
              { borderColor: badgeBorder, paddingHorizontal: s(10), paddingVertical: s(5) },
            ]}
          >
            <Text
              style={{ color: badgeText, fontFamily: fontSemi, fontSize: s(10), letterSpacing: 0.4 }}
              maxFontSizeMultiplier={1.15}
            >
              {badgeGoal}
            </Text>
          </View>
          <View
            style={[
              styles.badge,
              { borderColor: badgeBorder, paddingHorizontal: s(10), paddingVertical: s(5) },
            ]}
          >
            <Text
              style={{ color: badgeText, fontFamily: fontSemi, fontSize: s(10), letterSpacing: 0.4 }}
              maxFontSizeMultiplier={1.15}
            >
              {badgePlayers}
            </Text>
          </View>
        </View>

        <Text
          style={{
            color: titleColor,
            fontFamily: fontHeavy,
            fontSize: s(24),
            textAlign: 'center',
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 6,
          }}
          maxFontSizeMultiplier={1.15}
        >
          {title}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontFamily: fontMedium,
            fontSize: s(13),
            lineHeight: s(19),
            textAlign: 'center',
            marginTop: s(6),
            maxWidth: s(340),
            paddingHorizontal: s(8),
            textShadowColor: 'rgba(0,0,0,0.85)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 5,
          }}
          maxFontSizeMultiplier={1.15}
        >
          {subtitle}
        </Text>

        <View
          style={[
            styles.ctaRow,
            {
              marginTop: s(14),
              gap: s(6),
              flexDirection: isAr ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Text
            style={{ color: ctaColor, fontFamily: fontSemi, fontSize: s(15) }}
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

  const europeImage = TSF_ART.hero ?? 0;
  const egyptImage = TSF_ART.egyptHub ?? TSF_ART.hero ?? 0;

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
        image={europeImage}
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
        image={egyptImage}
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
  card: {
    overflow: 'hidden',
    backgroundColor: '#14052E',
  },
  hero: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  press: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  badgeRow: {
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  ctaRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
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
