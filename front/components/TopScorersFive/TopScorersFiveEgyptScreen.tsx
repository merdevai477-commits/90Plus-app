/**
 * "خماسي الهدافين" — Egyptian League intro.
 *
 * Same composition language as the Europe intro (Figma 1259:8321), with the
 * maroon wash from the Egypt design export and Egyptian-league copy.
 */

import { useCallback } from 'react';
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

import { TSF_ART, TSF_DESIGN_WIDTH } from './assets';

const BG = '#030303';
const CTA_BG = '#8C5CF5';
const TITLE = '#FFFFFF';
const EGYPT_WASH = 'rgba(128, 59, 69, 0.50)';
const HERO_DESIGN = { width: 501, height: 549, left: -27, top: -10 };
const HERO_FADE_BOX = { top: -55, height: 630 };
const HERO_FADE = ['rgba(3,3,3,0)', 'rgba(3,3,3,0)', 'rgba(3,3,3,0.35)', BG] as const;
const HERO_FADE_STOPS = [0, 0.7, 0.9, 0.97] as const;
const INTRO_TOP = 412;

export default function TopScorersFiveEgyptScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const copy = t.topScorersFive;
  const egypt = copy.egypt;
  const isAr = language === 'ar';

  const fontHeavy = useAppFont(800);
  const fontMedium = useAppFont(500);
  const fontSemi = useAppFont(600);

  const scale = width / TSF_DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);
  const introGap = Math.max(s(INTRO_TOP) - (insets.top + s(48)), s(16));

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/top-scorers-five' as never);
  }, [router]);

  const handleStart = useCallback(() => {
    // Egyptian player pool ships in a follow-up; reuse the pick shell for now.
    router.push({ pathname: '/top-scorers-five/pick', params: { mode: 'egypt' } } as never);
  }, [router]);

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
        {TSF_ART.egyptHub != null ? (
          <Image
            source={TSF_ART.egyptHub}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            transition={0}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#3A1520' }]} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: EGYPT_WASH }]} />
      </View>
      <LinearGradient
        colors={HERO_FADE}
        locations={HERO_FADE_STOPS}
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
          testID="top-scorers-five-egypt-back"
          style={[styles.backButton, { width: s(38), height: s(38) }]}
        >
          <Ionicons name="arrow-back" size={s(28)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={{ height: introGap }} pointerEvents="none" />

      <View style={[styles.intro, { width: s(387) }]}>
        <Text style={[styles.ball, { fontSize: s(48), lineHeight: s(60) }]}>⚽</Text>
        <Text
          style={[styles.title, { fontFamily: fontHeavy, fontSize: s(40), marginTop: s(8) }]}
          maxFontSizeMultiplier={1.15}
        >
          {egypt.title}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { fontFamily: fontMedium, fontSize: s(20), lineHeight: s(30), marginTop: s(12) },
          ]}
          maxFontSizeMultiplier={1.15}
        >
          {egypt.subtitle}
        </Text>
      </View>

      <View style={styles.spacer} pointerEvents="none" />

      <TouchableOpacity
        onPress={handleStart}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={egypt.cta}
        testID="top-scorers-five-egypt-cta"
        style={[
          styles.ctaPress,
          {
            width: s(402),
            height: s(58),
            borderRadius: s(16),
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
            {egypt.cta}
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
  header: { alignSelf: 'stretch', alignItems: 'flex-start' },
  backButton: { alignItems: 'center', justifyContent: 'center' },
  spacer: { flex: 1 },
  intro: { alignItems: 'center' },
  ball: { textAlign: 'center' },
  title: { color: TITLE, textAlign: 'center' },
  subtitle: { color: '#9E9E9E', textAlign: 'center' },
  ctaPress: { alignSelf: 'center' },
  cta: { alignItems: 'center', justifyContent: 'center', backgroundColor: CTA_BG },
  ctaText: { color: '#FFFFFF' },
});
