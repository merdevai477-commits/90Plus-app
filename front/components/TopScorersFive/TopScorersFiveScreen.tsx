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
import { KING_BUTTON_GRADIENT } from '../KingOfPredictions/KingBoardList';

import { TSF_ART, TSF_DESIGN_WIDTH, TSF_LEAGUE_BADGES } from './assets';

const BG = '#030303';
/** Hero art is 501×549 in the design and bleeds 26.5pt past each frame edge. */
const HERO_DESIGN = { width: 501, height: 549, overhang: 26.5 };
const HERO_FADE = ['rgba(3,3,3,0)', 'rgba(3,3,3,0.65)', BG] as const;
const HERO_FALLBACK = ['#5B21B6', '#3B0F7A', '#14052E', BG] as const;
/** Frame 718 overflows 21pt above its own bounds, so the row is 402×138. */
const LEAGUE_ROW = { width: 402, height: 138 };

export default function TopScorersFiveScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const copy = t.topScorersFive;

  const fontBold = useAppFont(700);
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
            badge.featured && styles.leagueCardFeatured,
            {
              left: s(badge.card.left),
              top: s(badge.card.top),
              width: s(badge.card.width),
              height: s(badge.card.height),
              borderRadius: s(badge.featured ? 20 : 16),
            },
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
      <View style={[styles.hero, { height: s(HERO_DESIGN.height) }]} pointerEvents="none">
        {TSF_ART.hero != null ? (
          <Image
            source={TSF_ART.hero}
            style={{
              width: s(HERO_DESIGN.width),
              height: s(HERO_DESIGN.height),
              marginLeft: -s(HERO_DESIGN.overhang),
            }}
            contentFit="cover"
            transition={0}
          />
        ) : (
          <LinearGradient
            colors={HERO_FALLBACK}
            locations={[0, 0.35, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={HERO_FADE}
          locations={[0, 0.62, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + s(14),
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
          <Ionicons name="arrow-back" size={s(26)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} pointerEvents="none" />

      <View style={[styles.intro, { width: s(387) }]}>
        <Text style={[styles.ball, { fontSize: s(46), lineHeight: s(60) }]}>⚽</Text>
        <Text
          style={[styles.title, { fontFamily: fontBold, fontSize: s(34), marginTop: s(8) }]}
          maxFontSizeMultiplier={1.15}
        >
          {copy.title}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { fontFamily: fontMedium, fontSize: s(15), lineHeight: s(24), marginTop: s(12) },
          ]}
          maxFontSizeMultiplier={1.15}
        >
          {copy.subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.leagueRow,
          { width: s(LEAGUE_ROW.width), height: s(LEAGUE_ROW.height), marginTop: s(33) },
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
            borderRadius: s(29),
            marginTop: s(54),
            marginBottom: Math.max(insets.bottom, 16) + s(65),
          },
        ]}
      >
        <LinearGradient
          colors={KING_BUTTON_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cta, { width: s(402), height: s(58), borderRadius: s(29), gap: s(12) }]}
        >
          <Text
            style={[styles.ctaText, { fontFamily: fontSemi, fontSize: s(17) }]}
            maxFontSizeMultiplier={1.15}
          >
            {copy.cta}
          </Text>
          <Ionicons name="chevron-forward" size={s(22)} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  header: { alignSelf: 'stretch', alignItems: 'center' },
  backButton: { alignItems: 'center', justifyContent: 'center' },
  spacer: { flex: 1 },
  intro: { alignItems: 'center' },
  ball: { textAlign: 'center' },
  title: { color: '#FFFFFF', textAlign: 'center' },
  subtitle: { color: '#BCBCBC', textAlign: 'center' },
  leagueRow: { position: 'relative' },
  leagueCard: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leagueCardFeatured: {
    borderWidth: 2,
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  ctaPress: { alignSelf: 'center' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF' },
});
