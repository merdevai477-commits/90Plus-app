/**
 * Top Scorers Five hub — entered from Rank.
 *
 * Two interlocking halves of the same intro language:
 *   top    → Top Five Europe (purple hero)
 *   bottom → Top Five Egyptian League (maroon wash)
 * A shared diagonal cut makes the images overlap instead of stacking flat.
 */

import { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';

import { useTranslation } from '../../src/i18n';
import { useAppFont, useScreenFont } from '../../utils/fontSetup';

import { TSF_ART, TSF_DESIGN_WIDTH } from './assets';

const BG = '#030303';
const EUROPE_TITLE = '#B896FC';
const EGYPT_WASH = 'rgba(128, 59, 69, 0.55)';
/** Shared overlap band as a fraction of screen height. */
const OVERLAP_FRAC = 0.2;

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
  const fontMedium = useAppFont(500);
  const fontSemi = useAppFont(600);

  const scale = width / TSF_DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);

  const overlap = height * OVERLAP_FRAC;
  const europeH = height * 0.5 + overlap / 2;
  const egyptH = height * 0.5 + overlap / 2;
  const slant = overlap;

  const europeMask = useMemo(
    () => (
      <Svg width={width} height={europeH}>
        <Polygon
          points={`0,0 ${width},0 ${width},${europeH - slant} 0,${europeH}`}
          fill="#000"
        />
      </Svg>
    ),
    [europeH, slant, width],
  );

  const egyptMask = useMemo(
    () => (
      <Svg width={width} height={egyptH}>
        <Polygon
          points={`0,${slant} ${width},0 ${width},${egyptH} 0,${egyptH}`}
          fill="#000"
        />
      </Svg>
    ),
    [egyptH, slant, width],
  );

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
      {/* Egypt sits underneath so Europe's diagonal reveals it in the overlap. */}
      <MaskedView
        style={[styles.panel, { bottom: 0, height: egyptH }]}
        maskElement={egyptMask}
      >
        <Pressable
          onPress={openEgypt}
          accessibilityRole="button"
          accessibilityLabel={hub.egyptTitle}
          testID="top-scorers-five-hub-egypt"
          style={styles.panelPress}
        >
          {TSF_ART.hero != null ? (
            <Image
              source={TSF_ART.hero}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="bottom"
              transition={0}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#3A1520' }]} />
          )}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: EGYPT_WASH }]} />
          <LinearGradient
            colors={['rgba(3,3,3,0.15)', 'rgba(3,3,3,0.55)', BG]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View
            style={[
              styles.egyptCopy,
              {
                paddingBottom: Math.max(insets.bottom, 16) + s(28),
                paddingHorizontal: s(28),
              },
            ]}
          >
            <Text style={[styles.ball, { fontSize: s(36), lineHeight: s(44) }]}>⚽</Text>
            <Text
              style={[
                styles.egyptTitle,
                { fontFamily: fontHeavy, fontSize: s(28), marginTop: s(6) },
              ]}
              maxFontSizeMultiplier={1.15}
            >
              {hub.egyptTitle}
            </Text>
            <Text
              style={[
                styles.egyptSub,
                {
                  fontFamily: fontMedium,
                  fontSize: s(15),
                  lineHeight: s(22),
                  marginTop: s(8),
                },
              ]}
              maxFontSizeMultiplier={1.15}
            >
              {hub.egyptSubtitle}
            </Text>
            <View
              style={[
                styles.enterRow,
                {
                  marginTop: s(14),
                  gap: s(8),
                  flexDirection: isAr ? 'row-reverse' : 'row',
                },
              ]}
            >
              <Text style={[styles.enterText, { fontFamily: fontSemi, fontSize: s(16) }]}>
                {hub.enter}
              </Text>
              <Ionicons
                name={isAr ? 'chevron-back' : 'chevron-forward'}
                size={s(20)}
                color="#FFFFFF"
              />
            </View>
          </View>
        </Pressable>
      </MaskedView>

      <MaskedView
        style={[styles.panel, { top: 0, height: europeH }]}
        maskElement={europeMask}
      >
        <Pressable
          onPress={openEurope}
          accessibilityRole="button"
          accessibilityLabel={hub.europeTitle}
          testID="top-scorers-five-hub-europe"
          style={styles.panelPress}
        >
          {TSF_ART.hero != null ? (
            <Image
              source={TSF_ART.hero}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="top"
              transition={0}
            />
          ) : (
            <LinearGradient
              colors={['#5B21B6', '#3B0F7A', '#14052E', BG]}
              locations={[0, 0.35, 0.7, 1]}
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            colors={['rgba(3,3,3,0)', 'rgba(3,3,3,0.25)', 'rgba(3,3,3,0.75)']}
            locations={[0.35, 0.7, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View
            style={[
              styles.europeCopy,
              {
                paddingBottom: s(36),
                paddingHorizontal: s(28),
              },
            ]}
          >
            <Text style={[styles.ball, { fontSize: s(36), lineHeight: s(44) }]}>⚽</Text>
            <Text
              style={[
                styles.europeTitle,
                { fontFamily: fontHeavy, fontSize: s(28), marginTop: s(6) },
              ]}
              maxFontSizeMultiplier={1.15}
            >
              {hub.europeTitle}
            </Text>
            <Text
              style={[
                styles.europeSub,
                {
                  fontFamily: fontMedium,
                  fontSize: s(15),
                  lineHeight: s(22),
                  marginTop: s(8),
                },
              ]}
              maxFontSizeMultiplier={1.15}
            >
              {hub.europeSubtitle}
            </Text>
            <View
              style={[
                styles.enterRow,
                {
                  marginTop: s(14),
                  gap: s(8),
                  flexDirection: isAr ? 'row-reverse' : 'row',
                },
              ]}
            >
              <Text style={[styles.enterText, { fontFamily: fontSemi, fontSize: s(16) }]}>
                {hub.enter}
              </Text>
              <Ionicons
                name={isAr ? 'chevron-back' : 'chevron-forward'}
                size={s(20)}
                color="#FFFFFF"
              />
            </View>
          </View>
        </Pressable>
      </MaskedView>

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
  panel: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  panelPress: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'flex-start',
  },
  backButton: { alignItems: 'center', justifyContent: 'center' },
  europeCopy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  egyptCopy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  ball: { textAlign: 'center' },
  europeTitle: { color: EUROPE_TITLE, textAlign: 'center' },
  europeSub: { color: 'rgba(255,255,255,0.78)', textAlign: 'center' },
  egyptTitle: { color: '#FFFFFF', textAlign: 'center' },
  egyptSub: { color: 'rgba(255,255,255,0.72)', textAlign: 'center' },
  enterRow: { alignItems: 'center', justifyContent: 'center' },
  enterText: { color: '#FFFFFF' },
});
