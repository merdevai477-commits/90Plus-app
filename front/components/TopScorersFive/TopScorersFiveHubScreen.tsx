/**
 * Top Scorers Five hub — entered from Rank.
 *
 * Two equal stacked halves, each matching the intro language (hero, title,
 * subtitle, purple CTA). Tapping a half opens that competition's pitch/pick.
 */

import { useCallback } from 'react';
import {
  Pressable,
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
/** SwiftUI: Color(red: 0.50, green: 0.23, blue: 0.27).opacity(0.50) */
const EGYPT_WASH = 'rgba(128, 59, 69, 0.50)';
const EUROPE_TITLE = '#B896FC';
const DIVIDER = 'rgba(255,255,255,0.10)';

type HalfProps = {
  testID: string;
  ctaTestID: string;
  title: string;
  subtitle: string;
  cta: string;
  titleColor: string;
  subtitleColor: string;
  wash?: string;
  contentPosition: 'top' | 'bottom';
  isAr: boolean;
  s: (n: number) => number;
  fontHeavy: string | undefined;
  fontMedium: string | undefined;
  fontSemi: string | undefined;
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
  subtitleColor,
  wash,
  contentPosition,
  isAr,
  s,
  fontHeavy,
  fontMedium,
  fontSemi,
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
      {TSF_ART.hero != null ? (
        <Image
          source={TSF_ART.hero}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={contentPosition}
          transition={0}
        />
      ) : (
        <LinearGradient
          colors={
            wash
              ? ['#5A1F2A', '#3A1520', BG]
              : ['#5B21B6', '#3B0F7A', '#14052E', BG]
          }
          style={StyleSheet.absoluteFill}
        />
      )}
      {wash ? <View style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} /> : null}
      <LinearGradient
        colors={['rgba(3,3,3,0)', 'rgba(3,3,3,0.35)', 'rgba(3,3,3,0.92)']}
        locations={[0.15, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={[
          styles.copy,
          {
            paddingHorizontal: s(24),
            paddingBottom: bottomPad + s(18),
            width: s(387),
            alignSelf: 'center',
          },
        ]}
      >
        <Text style={[styles.ball, { fontSize: s(40), lineHeight: s(48) }]}>⚽</Text>
        <Text
          style={[
            styles.title,
            {
              color: titleColor,
              fontFamily: fontHeavy,
              fontSize: s(28),
              marginTop: s(6),
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
              color: subtitleColor,
              fontFamily: fontMedium,
              fontSize: s(15),
              lineHeight: s(22),
              marginTop: s(8),
            },
          ]}
          maxFontSizeMultiplier={1.12}
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
              width: s(320),
              height: s(48),
              borderRadius: s(14),
              marginTop: s(16),
              gap: s(10),
              paddingHorizontal: s(18),
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

  /** Europe → pitch / formation pick. */
  const openEurope = useCallback(() => {
    router.push('/top-scorers-five/pick' as never);
  }, [router]);

  /** Egypt → same pick shell with egypt mode (player pool follows). */
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
        subtitleColor="#9E9E9E"
        contentPosition="top"
        isAr={isAr}
        s={s}
        fontHeavy={fontHeavy}
        fontMedium={fontMedium}
        fontSemi={fontSemi}
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
        subtitleColor="#9E9E9E"
        wash={EGYPT_WASH}
        contentPosition="bottom"
        isAr={isAr}
        s={s}
        fontHeavy={fontHeavy}
        fontMedium={fontMedium}
        fontSemi={fontSemi}
        bottomPad={Math.max(insets.bottom, 8)}
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
  half: { flex: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER },
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
  subtitle: { textAlign: 'center' },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CTA_BG,
  },
  ctaText: { color: '#FFFFFF' },
});
