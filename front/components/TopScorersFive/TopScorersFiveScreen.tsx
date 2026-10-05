/**
 * "خماسي الهدافين" intro screen — Figma `iPhone 14 Plus - 55` (node 1259:8321).
 *
 * Entered from the Rank page competition card. The layout is ported from the
 * 448×925 design frame: everything below the hero keeps its design spacing and
 * is scaled by the device width, while the gap above the title flexes so the
 * block stays anchored to the bottom on shorter screens.
 */

import { useCallback, useMemo } from 'react';
import {
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

import { TSF_ART, TSF_DESIGN_WIDTH, TSF_LEAGUE_BADGES } from './assets';

const BG = '#030303';
const CTA_BG = '#8C5CF5';
/** Hero art is 501×549 at (−27, −10) in the design frame, bleeding past both sides. */
const HERO_DESIGN = { width: 501, height: 549, left: -27, top: -10 };
/** The fade layer is 448×630 at y −55, so it ends below the hero art. */
const HERO_FADE_BOX = { top: -55, height: 630 };
const HERO_FADE = ['rgba(3,3,3,0)', 'rgba(3,3,3,0)', 'rgba(3,3,3,0.6)', BG] as const;
const HERO_FALLBACK = ['#5B21B6', '#3B0F7A', '#14052E', BG] as const;
/**
 * Frame 718 overflows 21pt above its own bounds, so the row is 402×138. Figma
 * places it 8pt right of center (x 31 in a 448 frame).
 */
const LEAGUE_ROW = { width: 402, height: 138, offsetX: 8 };

export default function TopScorersFiveScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const copy = t.topScorersFive;
  const isAr = language === 'ar';

  const fontHeavy = useAppFont(800);
  const fontMedium = useAppFont(500);
  const fontSemi = useAppFont(600);

  /** Design unit → device points. */
  const scale = width / TSF_DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);

  /**
   * Rank is the only way into this screen, so a missing history stack (cold
   * start from a deep link) still lands the user back there.
   */
  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/rank' as never);
  }, [router]);

  const handleStart = useCallback(() => {
    router.push('/top-scorers-five/pick' as never);
  }, [router]);

  const leagueRow = useMemo(
    () =>
      TSF_LEAGUE_BADGES.map((badge) => (
        <View
          key={badge.key}
          style={[
            styles.leagueCard,
            {
              left: s(badge.card.left),
              top: s(badge.card.top),
              width: s(badge.card.width),
              height: s(badge.card.height),
              borderRadius: s(badge.radius),
              backgroundColor: badge.background,
            },
            badge.stroke ? { borderWidth: 1, borderColor: badge.stroke } : null,
            badge.shadow
              ? { boxShadow: `0px 0px ${s(badge.shadow.blur)}px ${badge.shadow.color}` }
              : null,
          ]}
        >
          <Image
            source={badge.source}
            style={{ width: s(badge.logo.width), height: s(badge.logo.height) }}
            contentFit="contain"
            transition={0}
          />
        </View>
      )),
    [s],
  );

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.hero,
          {
            left: s(HERO_DESIGN.left),
            top: s(HERO_DESIGN.top),
            width: s(HERO_DESIGN.width),
            height: s(HERO_DESIGN.height),
          },
        ]}
        pointerEvents="none"
      >
        {TSF_ART.hero != null ? (
          <Image
            source={TSF_ART.hero}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // Source art is far taller than the hero box; a centred crop cuts the
            // back two players off at the screen edge, so anchor to the top.
            contentPosition="top"
            transition={0}
          />
        ) : (
          <LinearGradient
            colors={HERO_FALLBACK}
            locations={[0, 0.35, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>
      <LinearGradient
        colors={HERO_FADE}
        locations={[0, 0.55, 0.9, 1]}
        style={[styles.heroFade, { top: s(HERO_FADE_BOX.top), height: s(HERO_FADE_BOX.height) }]}
        pointerEvents="none"
      />

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + s(10),
            paddingLeft: Math.max(insets.left, s(24)),
            paddingRight: Math.max(insets.right, s(24)),
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={12}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          testID="top-scorers-five-back"
          style={[styles.backButton, { width: s(38), height: s(38) }]}
        >
          <Ionicons name="arrow-back" size={s(28)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} pointerEvents="none" />

      <View style={[styles.intro, { width: s(387) }]}>
        <Text style={[styles.ball, { fontSize: s(48), lineHeight: s(60) }]}>⚽</Text>
        <Text
          style={[styles.title, { fontFamily: fontHeavy, fontSize: s(40), marginTop: s(8) }]}
          maxFontSizeMultiplier={1.15}
        >
          {copy.title}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { fontFamily: fontMedium, fontSize: s(20), lineHeight: s(30), marginTop: s(12) },
          ]}
          maxFontSizeMultiplier={1.15}
        >
          {copy.subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.leagueRow,
          {
            width: s(LEAGUE_ROW.width),
            height: s(LEAGUE_ROW.height),
            marginTop: s(33),
            left: s(LEAGUE_ROW.offsetX),
          },
        ]}
        pointerEvents="none"
      >
        {leagueRow}
      </View>

      <TouchableOpacity
        onPress={handleStart}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={copy.cta}
        testID="top-scorers-five-cta"
        style={[
          styles.ctaPress,
          {
            width: s(402),
            height: s(58),
            borderRadius: s(16),
            marginTop: s(34),
            marginBottom: Math.max(insets.bottom, 16) + s(65),
          },
        ]}
      >
        <View
          style={[
            styles.cta,
            {
              width: s(402),
              height: s(58),
              borderRadius: s(16),
              gap: s(12),
              paddingHorizontal: s(23),
              flexDirection: isAr ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Text
            style={[styles.ctaText, { fontFamily: fontSemi, fontSize: s(19) }]}
            maxFontSizeMultiplier={1.15}
          >
            {copy.cta}
          </Text>
          <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={s(24)} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  hero: { position: 'absolute', overflow: 'hidden' },
  heroFade: { position: 'absolute', left: 0, right: 0 },
  header: { alignSelf: 'stretch', alignItems: 'center' },
  backButton: { alignItems: 'center', justifyContent: 'center' },
  spacer: { flex: 1 },
  intro: { alignItems: 'center' },
  ball: { textAlign: 'center' },
  title: { color: '#FFFFFF', textAlign: 'center' },
  subtitle: { color: '#9E9E9E', textAlign: 'center' },
  leagueRow: { position: 'relative' },
  leagueCard: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaPress: { alignSelf: 'center' },
  cta: { alignItems: 'center', justifyContent: 'center', backgroundColor: CTA_BG },
  ctaText: { color: '#FFFFFF' },
});
