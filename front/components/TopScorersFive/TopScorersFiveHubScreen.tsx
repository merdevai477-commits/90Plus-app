/**
 * Top Scorers Five hub — entered from Rank.
 *
 * Two equal stacked halves. Each shows hero art with a large league-logo
 * watermark (the tap target). No CTA button — press the crest to enter.
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
const EGYPT_WASH = 'rgba(128, 59, 69, 0.22)';
const EUROPE_TITLE = '#B896FC';
const DIVIDER = 'rgba(255,255,255,0.14)';

type HalfProps = {
  testID: string;
  logoTestID: string;
  title: string;
  subtitle: string;
  titleColor: string;
  image: number | null;
  logo: number;
  /** White tint helps dark-on-transparent crests read as a shadow on photos. */
  logoTint?: string;
  fallbackColors: readonly [string, string, string, string];
  wash?: string;
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
  wash,
  contentPosition,
  s,
  fontHeavy,
  fontMedium,
  topPad = 0,
  bottomPad = 0,
  onPress,
}: HalfProps) {
  const logoSize = s(132);

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
        {wash ? <View style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} /> : null}
        {/* Soft full-frame shade so the crest reads as a shadow on the photo. */}
        <View style={styles.photoShade} />
        <LinearGradient
          colors={['rgba(3,3,3,0.15)', 'rgba(3,3,3,0)', 'rgba(3,3,3,0.72)', 'rgba(3,3,3,0.96)']}
          locations={[0, 0.28, 0.68, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        style={[
          styles.copy,
          {
            paddingTop: topPad,
            paddingBottom: bottomPad + s(20),
            paddingHorizontal: s(24),
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Crest watermark — primary tap target. */}
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={title}
          testID={logoTestID}
          hitSlop={16}
          style={({ pressed }) => [
            styles.logoPress,
            {
              width: logoSize,
              height: logoSize,
              opacity: pressed ? 0.75 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <Image
            source={logo}
            style={[
              styles.logo,
              {
                width: logoSize,
                height: logoSize,
                opacity: 0.42,
                ...(logoTint ? { tintColor: logoTint } : null),
              },
            ]}
            contentFit="contain"
            transition={0}
          />
          {/* Soft duplicate underneath for a cast-shadow feel. */}
          <Image
            source={logo}
            style={[
              styles.logoShadow,
              {
                width: logoSize,
                height: logoSize,
                opacity: 0.22,
                tintColor: '#000000',
              },
            ]}
            contentFit="contain"
            transition={0}
            pointerEvents="none"
          />
        </Pressable>

        <Pressable onPress={onPress} accessibilityRole="button" testID={testID}>
          <Text
            style={[
              styles.title,
              {
                color: titleColor,
                fontFamily: fontHeavy,
                fontSize: s(26),
                marginTop: s(10),
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
        topPad={insets.top + s(48)}
        onPress={openEurope}
      />

      <View style={styles.divider} />

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
        wash={EGYPT_WASH}
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
    backgroundColor: 'rgba(0,0,0,0.22)',
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
  logoPress: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    zIndex: 2,
  },
  logoShadow: {
    position: 'absolute',
    top: 6,
    left: 4,
    zIndex: 1,
  },
  title: { textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.82)', textAlign: 'center', alignSelf: 'center' },
});
