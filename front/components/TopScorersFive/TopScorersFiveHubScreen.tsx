/**
 * Top Scorers Five hub — Figma Frame 1294 (1550:6492).
 * Two stacked challenge cards: Europe and Egyptian league.
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
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { useAppFont, useScreenFont } from '../../utils/fontSetup';

import { TSF_ART, TSF_DESIGN_WIDTH, TSF_HUB_BADGE, TSF_HUB_CARD } from './assets';

const BG = '#030303';
const CARD_WASH = 'rgba(46,6,165,0.2)';
const SUBTITLE = '#B1B1B1';
const CARD_GAP = 14;
const CARD_PAD = 22;
const CARD_RADIUS = 24;
const IMAGE_RADIUS = 16;
const IMAGE_H = 238;
const BADGE_W = 78;
const BADGE_H = 72;
const CTA_H = 48;

type ChallengeCardProps = {
  testID: string;
  title: string;
  subtitle: string;
  image: number;
  startCta: string;
  isAr: boolean;
  s: (n: number) => number;
  fontBold: string | undefined;
  fontSemi: string | undefined;
  fontRegular: string | undefined;
  onPress: () => void;
};

function ChallengeCard({
  testID,
  title,
  subtitle,
  image,
  startCta,
  isAr,
  s,
  fontBold,
  fontSemi,
  fontRegular,
  onPress,
}: ChallengeCardProps) {
  const badgeW = s(BADGE_W);
  const badgeH = s(BADGE_H);
  const imageH = s(IMAGE_H);
  const ctaH = s(CTA_H);
  const pad = s(CARD_PAD);
  const radius = s(CARD_RADIUS);
  const imgRadius = s(IMAGE_RADIUS);

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius,
          padding: pad,
          gap: s(14),
          boxShadow: 'inset 0px 0px 27.7px rgba(139,92,246,0.39)',
        },
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: CARD_WASH, borderRadius: radius }]} pointerEvents="none" />

      <View
        style={[
          styles.headerRow,
          {
            gap: s(6),
            flexDirection: isAr ? 'row' : 'row-reverse',
          },
        ]}
      >
        <Image
          source={TSF_HUB_BADGE}
          style={{ width: badgeW, height: badgeH }}
          contentFit="contain"
          transition={0}
        />
        <View
          style={[
            styles.headerCopy,
            {
              gap: s(6),
              alignItems: isAr ? 'flex-end' : 'flex-start',
            },
          ]}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: fontBold,
              fontSize: s(24),
              textAlign: isAr ? 'right' : 'left',
              writingDirection: isAr ? 'rtl' : 'ltr',
            }}
            maxFontSizeMultiplier={1.15}
          >
            {title}
          </Text>
          <Text
            style={{
              color: SUBTITLE,
              fontFamily: fontRegular,
              fontSize: s(14),
              lineHeight: s(20),
              textAlign: isAr ? 'right' : 'left',
              writingDirection: isAr ? 'rtl' : 'ltr',
            }}
            maxFontSizeMultiplier={1.2}
          >
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={[styles.imageWrap, { height: imageH, borderRadius: imgRadius }]}>
        <Image
          source={image}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          cachePolicy="memory-disk"
          priority="high"
          transition={0}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0)', '#000000']}
          locations={[0, 0.36, 1]}
          style={[StyleSheet.absoluteFill, { borderRadius: imgRadius }]}
          pointerEvents="none"
        />
      </View>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${startCta}`}
        testID={testID}
        style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      >
        <View style={[styles.ctaClip, { height: ctaH, borderRadius: imgRadius }]}>
          <LinearGradient
            colors={['#8B5CF6', '#2E146A']}
            locations={[0.12, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: fontSemi,
              fontSize: s(16),
              textAlign: 'center',
            }}
            maxFontSizeMultiplier={1.1}
          >
            {startCta}
          </Text>
        </View>
      </Pressable>
    </View>
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

  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontRegular = useAppFont(400);

  const scale = width / TSF_DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);

  const europeImage = TSF_HUB_CARD.europe ?? TSF_ART.hero ?? 0;
  const egyptImage = TSF_HUB_CARD.egypt ?? TSF_ART.egyptHub ?? TSF_ART.hero ?? 0;

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/rank' as never);
  }, [router]);

  const openEurope = useCallback(() => {
    router.push({ pathname: '/top-scorers-five/pick', params: { mode: 'europe' } } as never);
  }, [router]);

  const openEgypt = useCallback(() => {
    router.push({ pathname: '/top-scorers-five/pick', params: { mode: 'egypt' } } as never);
  }, [router]);

  const padX = s(22);
  const backSize = s(40);
  const headerH = insets.top + s(56);
  const bottomPad = Math.max(insets.bottom, 10) + s(16);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: headerH,
          paddingBottom: bottomPad,
          paddingHorizontal: padX,
          gap: s(CARD_GAP),
        }}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <ChallengeCard
          testID="top-scorers-five-hub-europe"
          title={hub.europeTitle}
          subtitle={hub.europeSubtitle}
          image={europeImage}
          startCta={hub.startCta}
          isAr={isAr}
          s={s}
          fontBold={fontBold}
          fontSemi={fontSemi}
          fontRegular={fontRegular}
          onPress={openEurope}
        />
        <ChallengeCard
          testID="top-scorers-five-hub-egypt"
          title={hub.egyptTitle}
          subtitle={hub.egyptSubtitle}
          image={egyptImage}
          startCta={hub.startCta}
          isAr={isAr}
          s={s}
          fontBold={fontBold}
          fontSemi={fontSemi}
          fontRegular={fontRegular}
          onPress={openEgypt}
        />
      </ScrollView>

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + s(8),
            paddingBottom: s(8),
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
          style={[styles.backButton, { width: backSize, height: backSize, borderRadius: backSize / 2 }]}
        >
          <Ionicons name="arrow-back" size={s(22)} color="#FFFFFF" />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { fontFamily: fontSemi, fontSize: s(20) }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.1}
          testID="top-scorers-five-hub-title"
        >
          {copy.title}
        </Text>
        <View style={{ width: backSize }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  card: {
    overflow: 'hidden',
    backgroundColor: '#09001D',
  },
  headerRow: {
    width: '100%',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  imageWrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#14052E',
  },
  ctaClip: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
