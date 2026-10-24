/**
 * Top Scorers Five hub — entered from Rank.
 *
 * Two cinematic challenge cards (Europe / Egypt). The whole card is the tap
 * target; a refined CTA label reinforces affordance without nested pressables.
 */

import { useCallback } from 'react';
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
const CARD_GAP = 14;
const CARD_RADIUS = 22;

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
  minHeight: number;
  fontHeavy: string | undefined;
  fontSemi: string | undefined;
  fontMedium: string | undefined;
  contentTopPad?: number;
  contentBottomPad?: number;
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
  minHeight,
  fontHeavy,
  fontSemi,
  fontMedium,
  contentTopPad = 0,
  contentBottomPad = 0,
  onPress,
}: ChallengeCardProps) {
  const logoSize = s(72);
  const badgeBorder =
    accent === 'egypt' ? 'rgba(212,175,105,0.45)' : 'rgba(167,139,250,0.45)';
  const badgeText = accent === 'egypt' ? GOLD : 'rgba(232,214,255,0.95)';
  const ctaColor = accent === 'egypt' ? GOLD : CTA_PURPLE;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${exploreCta}`}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        {
          minHeight,
          borderRadius: s(CARD_RADIUS),
          opacity: pressed ? 0.94 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      {/* Art — faces kept bright; only the lower band darkens for copy. */}
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
        {/* Soft top vignette only — keep player faces lit. */}
        <LinearGradient
          colors={['rgba(3,3,3,0.28)', 'rgba(3,3,3,0)', 'rgba(3,3,3,0)']}
          locations={[0, 0.22, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Bottom scrim for hierarchy — starts late so faces stay clear. */}
        <LinearGradient
          colors={['rgba(3,3,3,0)', 'rgba(3,3,3,0.45)', 'rgba(3,3,3,0.92)']}
          locations={[0.42, 0.68, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        style={[
          styles.content,
          {
            paddingTop: contentTopPad,
            paddingBottom: contentBottomPad + s(16),
            paddingHorizontal: s(20),
          },
        ]}
      >
        <View style={styles.spacer} />

        {/* Crest — balanced size so it never covers faces. */}
        <View
          style={[
            styles.logoWrap,
            {
              width: logoSize + s(16),
              height: logoSize + s(16),
              borderRadius: (logoSize + s(16)) / 2,
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
              marginTop: s(12),
              gap: s(8),
              flexDirection: isAr ? 'row-reverse' : 'row',
            },
          ]}
        >
          <View style={[styles.badge, { borderColor: badgeBorder, paddingHorizontal: s(10), paddingVertical: s(4) }]}>
            <Text
              style={[styles.badgeText, { color: badgeText, fontFamily: fontSemi, fontSize: s(10) }]}
              maxFontSizeMultiplier={1.1}
            >
              {badgeGoal}
            </Text>
          </View>
          <View style={[styles.badge, { borderColor: badgeBorder, paddingHorizontal: s(10), paddingVertical: s(4) }]}>
            <Text
              style={[styles.badgeText, { color: badgeText, fontFamily: fontSemi, fontSize: s(10) }]}
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
              fontSize: s(26),
              marginTop: s(10),
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
              lineHeight: s(19),
              marginTop: s(6),
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
              marginTop: s(14),
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

  /**
   * Keep cards cinematic on tall phones; on short screens ScrollView lets the
   * second challenge stay reachable without crushing either face crop.
   */
  const headerReserve = insets.top + s(52);
  const available = height - headerReserve - insets.bottom - CARD_GAP - s(20);
  const cardMinH = Math.max(available / 2, s(300));

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

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerReserve,
            paddingBottom: Math.max(insets.bottom, 12) + s(8),
            paddingHorizontal: s(12),
            gap: CARD_GAP,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces
      >
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
          minHeight={cardMinH}
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
          minHeight={cardMinH}
          fontHeavy={fontHeavy}
          fontSemi={fontSemi}
          fontMedium={fontMedium}
          onPress={openEgypt}
        />
      </ScrollView>

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
          style={[
            styles.backButton,
            {
              width: s(40),
              height: s(40),
              borderRadius: s(20),
            },
          ]}
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
  scrollContent: { flexGrow: 1 },
  card: {
    overflow: 'hidden',
    backgroundColor: '#0A0614',
  },
  art: { ...StyleSheet.absoluteFillObject },
  content: {
    flex: 1,
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
