/**
 * Rank tab screen
 *
 * Light (Figma 1957:131): pale page, liquid-glass level card, stacked competition cards.
 * Dark: existing hero art + 2×2 competition grid + Coach of the Week.
 * Search users stays in RankHeader (top-right in Arabic).
 */

import { BlurTargetView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Crown, Gift, Handshake, Share2, Target, Trophy, Zap } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  ImageSourcePropType,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CompCard from '../../components/rank/CompCard';
import CoachKingSection from '../../components/rank/CoachKingSection';
import {
  COMP_GRID_COLUMN_GAP,
  COMP_GRID_PADDING,
  COMP_GRID_ROW_GAP,
} from '../../components/rank/compCardMetrics';
import ProfileCard from '../../components/rank/ProfileCard';
import RankHeader from '../../components/rank/RankHeader';
import { getRankTheme } from '../../components/rank/rankTheme';
import { useResolvedAppScheme } from '@/hooks/useResolvedAppScheme';
import { useAppShareReward } from '../../hooks/useAppShareReward';
import { useLevelUpCelebrationOnFocus } from '../../hooks/useLevelUpCelebrationOnFocus';
import { useTranslation } from '../../src/i18n';
import { useAppFeaturesStore } from '../../src/stores/appFeaturesStore';
import { useLanguageStore } from '../../src/i18n/store';
import { useScreenFont, useAppFont } from '../../utils/fontSetup';

/** Figma iPhone 14 Plus frame: hero art node 998:2475 is 448×415, full-bleed cover. */
const FIGMA_FRAME_W = 448;
const FIGMA_HERO_H = 415;
const HERO_IMG_H = Math.round(
  Dimensions.get('window').width * (FIGMA_HERO_H / FIGMA_FRAME_W),
);

export default function RankScreen() {
  useScreenFont();
  useLevelUpCelebrationOnFocus();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const appLanguage = useLanguageStore((s) => s.language);
  const isAr = appLanguage === 'ar';
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getRankTheme(isDark), [isDark]);
  const fonts = {
    medium: useAppFont(500),
    semibold: useAppFont(600),
    bold: useAppFont(700),
    extrabold: useAppFont(800),
  };
  const [refreshing, setRefreshing] = useState(false);
  const hydrateFeatures = useAppFeaturesStore((s) => s.hydrate);
  /** Android BlurTarget for the profile liquid-glass card over the hero art. */
  const heroBlurTargetRef = useRef<View | null>(null);

  const { loadShareStatus, shareRewardHint } = useAppShareReward();
  const loadShareStatusRef = useRef(loadShareStatus);
  loadShareStatusRef.current = loadShareStatus;
  const hydrateFeaturesRef = useRef(hydrateFeatures);
  hydrateFeaturesRef.current = hydrateFeatures;
  const lastRankFocusFetchAtRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRankFocusFetchAtRef.current >= 60_000) {
        lastRankFocusFetchAtRef.current = now;
        void loadShareStatusRef.current();
      }
      void hydrateFeaturesRef.current();
    }, []),
  );

  const handleCompetitionPress = useCallback(
    (id: string) => {
      if (id === '3') {
        router.push('/(tabs)/predict-and-win' as never);
      } else if (id === '4') {
        router.push('/top-scorers-five' as never);
      } else if (id === '2') {
        router.push('/share-win' as never);
      } else if (id === '1') {
        router.push('/king-of-predictions' as never);
      } else if (id === 'coach') {
        router.push('/coach-king' as never);
      }
    },
    [router],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadShareStatus(), hydrateFeatures()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadShareStatus, hydrateFeatures]);

  const scrollContentStyle = useMemo(
    () => ({
      paddingTop: insets.top + (isDark ? 60 : 56),
      paddingBottom: Math.max(insets.bottom, 16) + 88,
    }),
    [insets.top, insets.bottom, isDark],
  );

  const competitions = useMemo(
    () => [
      {
        id: '2',
        title: t.rank.competitionNames.shareAndEarn.title,
        sub: t.rank.competitionNames.shareAndEarn.sub,
        actionText: t.rank.competitionNames.shareAndEarn.action,
        rewardHint: shareRewardHint(),
        img: require('../../assets/images/rank/comp-share.webp') as ImageSourcePropType,
        titleIcon: Gift,
        ctaIcon: Share2,
      },
      {
        id: '4',
        title: t.rank.competitionNames.engagementHero.title,
        sub: t.rank.competitionNames.engagementHero.sub,
        actionText: t.rank.competitionNames.engagementHero.action,
        img: require('../../assets/images/rank/comp-top-scorers-five.jpg') as ImageSourcePropType,
        photoScrim: true,
        titleIcon: Zap,
        ctaIcon: Zap,
      },
      {
        id: '1',
        title: t.rank.competitionNames.kingOfPredictions.title,
        sub: t.rank.competitionNames.kingOfPredictions.sub,
        actionText: t.rank.competitionNames.kingOfPredictions.action,
        img: require('../../assets/images/rank/comp-predictions.webp') as ImageSourcePropType,
        titleIcon: Crown,
        ctaIcon: Crown,
      },
      {
        id: 'coach',
        title: t.rank.coachKing.title,
        sub: t.rank.coachKing.subtitle,
        actionText: t.rank.coachKing.start,
        img: require('../../assets/images/coach-king/banner/promo.png') as ImageSourcePropType,
        titleIcon: Target,
        ctaIcon: Target,
      },
      {
        id: '3',
        title: t.rank.competitionNames.sponsors.title,
        sub: t.rank.competitionNames.sponsors.sub,
        actionText: t.rank.competitionNames.sponsors.action,
        img: require('../../assets/images/rank/comp-sponsors.png') as ImageSourcePropType,
        titleIcon: Handshake,
        ctaIcon: Target,
      },
    ],
    [t, shareRewardHint],
  );

  /** Dark keeps the original 4-tile grid (coach lives in CoachKingSection). */
  const gridCompetitions = useMemo(
    () => competitions.filter((c) => c.id !== 'coach'),
    [competitions],
  );
  const competitionRows = useMemo(
    () => [gridCompetitions.slice(0, 2), gridCompetitions.slice(2, 4)],
    [gridCompetitions],
  );

  const dir = isAr ? ('rtl' as const) : ('ltr' as const);
  const alignEnd = isAr ? ('flex-end' as const) : ('flex-start' as const);
  const textAlign = isAr ? ('right' as const) : ('left' as const);

  return (
    <View style={[s.root, { backgroundColor: theme.screen }]}>
      <RankHeader topInset={insets.top} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.refresh}
            colors={[theme.refresh]}
            progressBackgroundColor={theme.screen}
          />
        }
        contentContainerStyle={scrollContentStyle}
      >
        {isDark ? (
          <View style={s.heroBlock}>
            <BlurTargetView ref={heroBlurTargetRef} style={s.heroBlurTarget} pointerEvents="none">
              <Image
                source={require('../../assets/images/90Plus world cup.jpg')}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition={isAr ? 'left center' : 'right center'}
                cachePolicy="memory-disk"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.78)']}
                locations={[0.05, 0.42, 0.78]}
                style={StyleSheet.absoluteFill}
                start={isAr ? { x: 0.05, y: 0.95 } : { x: 0.95, y: 0.95 }}
                end={isAr ? { x: 0.95, y: 0.05 } : { x: 0.05, y: 0.05 }}
              />
              <LinearGradient
                colors={['transparent', 'rgba(3,3,3,0.55)', theme.screen]}
                style={s.heroBgGradBottom}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />
            </BlurTargetView>

            <View style={[s.heroText, { alignItems: alignEnd, alignSelf: alignEnd }]}>
              <View
                style={[
                  s.titleRow,
                  { flexDirection: isAr ? 'row' : 'row-reverse' },
                ]}
              >
                <Text
                  style={[
                    s.pageTitle,
                    {
                      fontFamily: fonts.extrabold,
                      textAlign,
                      writingDirection: dir,
                      color: theme.heroTitle,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {t.rank.competitions.title}
                </Text>
                <View style={s.trophyIconBox}>
                  <Trophy size={22} color="#fff" />
                </View>
              </View>
              <View style={[s.heroSubs, { alignItems: alignEnd }]}>
                <Text
                  style={[
                    s.pageSub1,
                    {
                      fontFamily: fonts.semibold,
                      textAlign,
                      writingDirection: dir,
                      color: theme.heroSub1,
                    },
                  ]}
                >
                  {t.rank.competitions.tagline}
                </Text>
                <Text
                  style={[
                    s.pageSub2,
                    {
                      fontFamily: fonts.medium,
                      textAlign,
                      writingDirection: dir,
                      color: theme.heroSub2,
                    },
                  ]}
                >
                  {t.rank.competitions.subtitle}
                </Text>
              </View>
            </View>

            <ProfileCard blurTarget={heroBlurTargetRef} />
          </View>
        ) : (
          <View style={s.lightHero}>
            <Text
              style={[
                s.lightPageTitle,
                {
                  fontFamily: fonts.extrabold,
                  textAlign,
                  writingDirection: dir,
                  color: theme.heroTitle,
                  alignSelf: alignEnd,
                },
              ]}
            >
              {t.rank.competitions.title}
            </Text>
            <ProfileCard />
          </View>
        )}

        {isDark ? (
          <>
            <View style={s.compGrid}>
              {competitionRows.map((row, rowIndex) => (
                <View key={`comp-row-${rowIndex}`} style={s.compRow}>
                  {row.map((c) => (
                    <View key={c.id} style={s.compCardSlot}>
                      <CompCard
                        {...c}
                        variant="overlay"
                        onPress={() => handleCompetitionPress(c.id)}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>

            <CoachKingSection
              isAr={isAr}
              fonts={fonts}
              copy={t.rank.coachKing}
              onStart={() => router.push('/coach-king' as never)}
            />
          </>
        ) : (
          <View style={s.stackList}>
            {competitions.map((c) => (
              <CompCard
                key={c.id}
                {...c}
                variant="stack"
                onPress={() => handleCompetitionPress(c.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  heroBlock: {
    overflow: 'hidden',
    paddingBottom: 8,
    marginTop: -44,
  },
  heroBlurTarget: {
    position: 'absolute',
    top: -32,
    left: 0,
    right: 0,
    width: '100%',
    height: HERO_IMG_H + 32,
  },
  heroBgGradBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  heroText: {
    paddingHorizontal: 18,
    paddingTop: Math.round(HERO_IMG_H * 0.22),
    paddingBottom: 10,
    zIndex: 1,
    maxWidth: '72%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 15,
  },
  trophyIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(86, 12, 157, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#5f4292',
    shadowColor: '#713BEE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 10,
    elevation: 8,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 42,
    includeFontPadding: false,
  },
  heroSubs: {
    width: '100%',
    gap: 8,
  },
  pageSub1: {
    fontSize: 18,
    fontWeight: '600',
    width: '100%',
    lineHeight: 24,
    includeFontPadding: false,
  },
  pageSub2: {
    fontSize: 13,
    fontWeight: '500',
    width: '100%',
    lineHeight: 18,
    includeFontPadding: false,
  },

  lightHero: {
    paddingHorizontal: 8,
    paddingTop: 4,
    gap: 8,
    marginBottom: 8,
  },
  lightPageTitle: {
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 12,
    marginBottom: 4,
  },

  compGrid: {
    paddingHorizontal: COMP_GRID_PADDING,
    gap: COMP_GRID_ROW_GAP,
    marginTop: 4,
    marginBottom: 20,
  },
  compRow: {
    flexDirection: 'row',
    gap: COMP_GRID_COLUMN_GAP,
  },
  compCardSlot: {
    flex: 1,
    minWidth: 0,
  },
  stackList: {
    paddingHorizontal: 20,
    gap: 20,
    marginTop: 8,
    marginBottom: 24,
  },
});
