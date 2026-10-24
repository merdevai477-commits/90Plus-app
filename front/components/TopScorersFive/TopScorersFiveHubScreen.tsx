/**
 * Top Scorers Five hub — entered from Rank.
 *
 * Two stacked halves with a slim gap. Each shows hero art, a clear league crest
 * (tap target), and crisp title copy — no CTA button.
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

import { TSF_ART, TSF_DESIGN_WIDTH, TSF_HUB_LOGO } from './assets';

const BG = '#030303';
const GAP = 10;
const EUROPE_TITLE = '#E8D6FF';

type HalfProps = {
  testID: string;
  logoTestID: string;
  title: string;
  subtitle: string;
  titleColor: string;
  image: number | null;
  logo: number;
  logoTint?: string;
  fallbackColors: readonly [string, string, string, string];
  contentPosition: 'top' | 'center' | 'bottom';
  s: (n: number) => number;
  fontHeavy: string | undefined;
  fontMedium: string | undefined;
  topPad?: number;
  bottomPad?: number;
  onPress: () => void;
};

function CompetitionHalf({
  testID,
  logoTestID,
  title,
  subtitle,
  titleColor,
  image,
  logo,
  logoTint,
  fallbackColors,
  contentPosition,
  s,
  fontHeavy,
  fontMedium,
  topPad = 0,
  bottomPad = 0,
  onPress,
}: HalfProps) {
  const logoSize = s(118);

  return (
    <View style={styles.half}>
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
        {/* Light shade + bottom fade for readable type — keep art visible. */}
        <View style={styles.photoShade} />
        <LinearGradient
          colors={['rgba(3,3,3,0.1)', 'rgba(3,3,3,0)', 'rgba(3,3,3,0.55)', 'rgba(3,3,3,0.92)']}
          locations={[0, 0.35, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        style={[
          styles.copy,
          {
            paddingTop: topPad,
            paddingBottom: bottomPad + s(18),
            paddingHorizontal: s(24),
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={title}
          testID={logoTestID}
          hitSlop={20}
          style={({ pressed }) => [
            styles.logoPress,
            {
              width: logoSize,
              height: logoSize,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          {/* Soft drop shadow disc behind the crest. */}
          <View
            style={[
              styles.logoGlow,
              {
                width: logoSize * 1.15,
                height: logoSize * 1.15,
                borderRadius: logoSize,
              },
            ]}
          />
          <Image
            source={logo}
            style={{
              width: logoSize,
              height: logoSize,
              opacity: 1,
              ...(logoTint ? { tintColor: logoTint } : null),
            }}
            contentFit="contain"
            transition={0}
          />
        </Pressable>

        <Pressable onPress={onPress} accessibilityRole="button" testID={testID}>
          <Text
            style={[
              styles.title,
              {
                color: titleColor,
                fontFamily: fontHeavy,
                fontSize: s(24),
                marginTop: s(12),
                textShadowColor: 'rgba(0,0,0,0.85)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 8,
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
                fontSize: s(13),
                lineHeight: s(19),
                marginTop: s(6),
                maxWidth: s(340),
                textShadowColor: 'rgba(0,0,0,0.9)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
              },
            ]}
            maxFontSizeMultiplier={1.1}
          >
            {subtitle}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TopScorersFiveHubScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const copy = t.topScorersFive;
  const hub = copy.hub;

  const fontHeavy = useAppFont(800);
  const fontMedium = useAppFont(500);

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
        logoTestID="top-scorers-five-hub-europe-logo"
        title={hub.europeTitle}
        subtitle={hub.europeSubtitle}
        titleColor={EUROPE_TITLE}
        image={TSF_ART.hero}
        logo={TSF_HUB_LOGO.europe}
        logoTint="#FFFFFF"
        fallbackColors={['#5B21B6', '#3B0F7A', '#14052E', BG]}
        contentPosition="top"
        s={s}
        fontHeavy={fontHeavy}
        fontMedium={fontMedium}
        topPad={insets.top + s(44)}
        onPress={openEurope}
      />

      <View style={{ height: GAP, backgroundColor: BG }} />

      <CompetitionHalf
        testID="top-scorers-five-hub-egypt"
        logoTestID="top-scorers-five-hub-egypt-logo"
        title={hub.egyptTitle}
        subtitle={hub.egyptSubtitle}
        titleColor="#FFFFFF"
        image={TSF_ART.egyptHub}
        logo={TSF_HUB_LOGO.egypt}
        logoTint="#FFFFFF"
        fallbackColors={['#5A1F2A', '#3A1520', '#1A0A0E', BG]}
        contentPosition="top"
        s={s}
        fontHeavy={fontHeavy}
        fontMedium={fontMedium}
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
  photoShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
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
  logoPress: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  title: { textAlign: 'center' },
  subtitle: {
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    alignSelf: 'center',
  },
});
