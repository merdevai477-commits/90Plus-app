/**
 * Top Scorers Five hub — entered from Rank.
 *
 * Two equal stacked halves:
 *   top    → Top Five Europe
 *   bottom → Top Five Egyptian League
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
const EUROPE_TITLE = '#B896FC';
const EGYPT_WASH = 'rgba(128, 59, 69, 0.55)';
const DIVIDER = 'rgba(255,255,255,0.12)';

type HalfProps = {
  testID: string;
  title: string;
  subtitle: string;
  enter: string;
  titleColor: string;
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
  title,
  subtitle,
  enter,
  titleColor,
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
        colors={['rgba(3,3,3,0.05)', 'rgba(3,3,3,0.45)', 'rgba(3,3,3,0.88)']}
        locations={[0.2, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[
          styles.copy,
          {
            paddingHorizontal: s(28),
            paddingBottom: bottomPad + s(22),
          },
        ]}
      >
        <Text style={[styles.ball, { fontSize: s(34), lineHeight: s(42) }]}>⚽</Text>
        <Text
          style={[styles.title, { color: titleColor, fontFamily: fontHeavy, fontSize: s(26) }]}
          maxFontSizeMultiplier={1.15}
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
            },
          ]}
          maxFontSizeMultiplier={1.15}
        >
          {subtitle}
        </Text>
        <View
          style={[
            styles.enterRow,
            {
              marginTop: s(12),
              gap: s(6),
              flexDirection: isAr ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Text style={[styles.enterText, { fontFamily: fontSemi, fontSize: s(15) }]}>{enter}</Text>
          <Ionicons
            name={isAr ? 'chevron-back' : 'chevron-forward'}
            size={s(18)}
            color="#FFFFFF"
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
    router.push('/top-scorers-five/europe' as never);
  }, [router]);

  const openEgypt = useCallback(() => {
    router.push('/top-scorers-five/egypt' as never);
  }, [router]);

  return (
    <View style={styles.root}>
      <CompetitionHalf
        testID="top-scorers-five-hub-europe"
        title={hub.europeTitle}
        subtitle={hub.europeSubtitle}
        enter={hub.enter}
        titleColor={EUROPE_TITLE}
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
        title={hub.egyptTitle}
        subtitle={hub.egyptSubtitle}
        enter={hub.enter}
        titleColor="#FFFFFF"
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
  title: { textAlign: 'center', marginTop: 4 },
  subtitle: { color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  enterRow: { alignItems: 'center', justifyContent: 'center' },
  enterText: { color: '#FFFFFF' },
});
