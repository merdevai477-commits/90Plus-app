/**
 * Top Scorers Five hub — entered from Rank.
 *
 * Two equal stacked halves. Each keeps the hero art readable (light bottom
 * scrim only) and routes straight into that competition's pitch/pick.
 */

import { useCallback } from 'react';
import {
  Pressable,
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

import { TSF_ART, TSF_DESIGN_WIDTH } from './assets';

const BG = '#030303';
const CTA_BG = '#8C5CF5';
/** Soft Egypt tint — full 50% wash buried the art. */
const EGYPT_WASH = 'rgba(128, 59, 69, 0.28)';
const EUROPE_TITLE = '#B896FC';
const DIVIDER = 'rgba(255,255,255,0.14)';

type HalfProps = {
  testID: string;
  ctaTestID: string;
  title: string;
  subtitle: string;
  cta: string;
  titleColor: string;
  image: number | null;
  fallbackColors: readonly [string, string, string, string];
  wash?: string;
  /** expo-image contentPosition — keeps faces / pitch framed per half. */
  contentPosition: 'top' | 'center' | 'bottom';
  isAr: boolean;
  s: (n: number) => number;
  fontHeavy: string | undefined;
  fontMedium: string | undefined;
  fontSemi: string | undefined;
  topPad?: number;
  bottomPad?: number;
  onPress: () => void;
};

function CompetitionHalf({
  testID,
  ctaTestID,
  title,
  subtitle,
  cta,
  titleColor,
  image,
  fallbackColors,
  wash,
  contentPosition,
  isAr,
  s,
  fontHeavy,
  fontMedium,
  fontSemi,
  topPad = 0,
  bottomPad = 0,
  onPress,
}: HalfProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={styles.half}
    >
      {/* Art fills the half; copy sits in a bottom band so players stay visible. */}
      <View style={styles.art} pointerEvents="none">
        {image != null ? (
          <Image
            source={image as ImageSourcePropType}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition={contentPosition}
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
          />
        ) : (
          <LinearGradient colors={[...fallbackColors]} style={StyleSheet.absoluteFill} />
        )}
        {wash ? <View style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} /> : null}
        {/* Bottom-only scrim — keeps the upper art clean and readable. */}
        <LinearGradient
          colors={['rgba(3,3,3,0)', 'rgba(3,3,3,0.55)', 'rgba(3,3,3,0.94)']}
          locations={[0, 0.55, 1]}
          style={styles.scrim}
        />
      </View>

      <View
        style={[
          styles.copy,
          {
            paddingTop: topPad,
            paddingBottom: bottomPad + s(16),
            paddingHorizontal: s(24),
          },
        ]}
      >
        <Text style={[styles.ball, { fontSize: s(36), lineHeight: s(44) }]}>⚽</Text>
        <Text
          style={[
            styles.title,
            {
              color: titleColor,
              fontFamily: fontHeavy,
              fontSize: s(26),
              marginTop: s(4),
            },
          ]}
          maxFontSizeMultiplier={1.1}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.subtitle,
            {
              fontFamily: fontMedium,
              fontSize: s(14),
              lineHeight: s(20),
              marginTop: s(6),
              maxWidth: s(360),
            },
          ]}
          maxFontSizeMultiplier={1.1}
        >
          {subtitle}
        </Text>

        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={cta}
          testID={ctaTestID}
          style={[
            styles.cta,
            {
              width: s(360),
              height: s(50),
              borderRadius: s(14),
              marginTop: s(14),
              gap: s(10),
              paddingHorizontal: s(20),
              flexDirection: isAr ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Text
            style={[styles.ctaText, { fontFamily: fontSemi, fontSize: s(16) }]}
            maxFontSizeMultiplier={1.1}
          >
            {cta}
          </Text>
          <Ionicons
            name={isAr ? 'chevron-back' : 'chevron-forward'}
            size={s(20)}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

export default function TopScorersFiveHubScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const copy = t.topScorersFive;
  const hub = copy.hub;
  const isAr = language === 'ar';

  const fontHeavy = useAppFont(800);
  const fontMedium = useAppFont(500);
  const fontSemi = useAppFont(600);

  const scale = width / TSF_DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);

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
      <CompetitionHalf
        testID="top-scorers-five-hub-europe"
        ctaTestID="top-scorers-five-hub-europe-cta"
        title={hub.europeTitle}
        subtitle={hub.europeSubtitle}
        cta={copy.cta}
        titleColor={EUROPE_TITLE}
        image={TSF_ART.hero}
        fallbackColors={['#5B21B6', '#3B0F7A', '#14052E', BG]}
        contentPosition="top"
        isAr={isAr}
        s={s}
        fontHeavy={fontHeavy}
        fontMedium={fontMedium}
        fontSemi={fontSemi}
        topPad={insets.top + s(44)}
        onPress={openEurope}
      />

      <View style={styles.divider} />

      <CompetitionHalf
        testID="top-scorers-five-hub-egypt"
        ctaTestID="top-scorers-five-hub-egypt-cta"
        title={hub.egyptTitle}
        subtitle={hub.egyptSubtitle}
        cta={copy.cta}
        titleColor="#FFFFFF"
        // Distinct art from Europe until an Egypt players hero ships.
        image={TSF_ART.egyptHub}
        fallbackColors={['#5A1F2A', '#3A1520', '#1A0A0E', BG]}
        wash={EGYPT_WASH}
        contentPosition="center"
        isAr={isAr}
        s={s}
        fontHeavy={fontHeavy}
        fontMedium={fontMedium}
        fontSemi={fontSemi}
        bottomPad={Math.max(insets.bottom, 10)}
        onPress={openEgypt}
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
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={12}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          testID="top-scorers-five-hub-back"
          style={[styles.backButton, { width: s(38), height: s(38) }]}
        >
          <Ionicons name="arrow-back" size={s(28)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  half: { flex: 1, overflow: 'hidden', backgroundColor: BG },
  art: { ...StyleSheet.absoluteFillObject },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
  },
  divider: { height: 1, backgroundColor: DIVIDER },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'flex-start',
  },
  backButton: { alignItems: 'center', justifyContent: 'center' },
  copy: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  ball: { textAlign: 'center' },
  title: { textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.82)', textAlign: 'center' },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CTA_BG,
  },
  ctaText: { color: '#FFFFFF' },
});
