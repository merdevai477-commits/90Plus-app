/**
 * Rank tab screen
 *
 * - profile strip (real user data via ProfileCard)
 * - competitions 2×2 grid
 * - King of Coaches landing (replaces the old Top Players podium)
 */

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
import { APP_BG } from '../../constants/ui';
import { useAppShareReward } from '../../hooks/useAppShareReward';
import { useLevelUpCelebrationOnFocus } from '../../hooks/useLevelUpCelebrationOnFocus';
import { useTranslation } from '../../src/i18n';
import { useAppFeaturesStore } from '../../src/stores/appFeaturesStore';
import { useLanguageStore } from '../../src/i18n/store';
import { useScreenFont, useAppFont } from '../../utils/fontSetup';

const ACCENT = '#A855F7';
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
  const fonts = {
    medium: useAppFont(500),
    semibold: useAppFont(600),
    bold: useAppFont(700),
    extrabold: useAppFont(800),
  };
  const [refreshing, setRefreshing] = useState(false);
  const hydrateFeatures = useAppFeaturesStore((s) => s.hydrate);

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
      paddingTop: insets.top + 60,
      paddingBottom: Math.max(insets.bottom, 16) + 88,
    }),
    [insets.top, insets.bottom],
  );

  const competitions = useMemo(
    () => [
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

  const competitionRows = useMemo(
    () => [competitions.slice(0, 2), competitions.slice(2, 4)],
    [competitions],
  );

  return (
    <View style={s.root}>
      <RankHeader topInset={insets.top} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
        contentContainerStyle={scrollContentStyle}
      >
        <View style={s.heroBlock}>
          <Image
            source={require('../../assets/images/90Plus world cup.jpg')}
            style={s.heroBgTrophy}
            contentFit="cover"
            contentPosition="left center"
            cachePolicy="memory-disk"
          />
          {/* Figma: linear-gradient(71deg, transparent 6.8%, black 0.64 at 56.9%) — a touch stronger for title legibility */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.78)']}
            locations={[0.05, 0.42, 0.78]}
            style={s.heroBgGradDiag}
            start={{ x: 0.05, y: 0.95 }}
            end={{ x: 0.95, y: 0.05 }}
          />
          <LinearGradient
            colors={['transparent', 'rgba(3,3,3,0.55)', APP_BG]}
            style={s.heroBgGradBottom}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          <View style={s.heroText}>
            <View style={s.titleRow}>
              <Text
                style={[s.pageTitle, { fontFamily: fonts.extrabold }]}
                numberOfLines={1}
              >
                {t.rank.competitions.title}
              </Text>
              <View style={s.trophyIconBox}>
                <Trophy size={22} color="#fff" />
              </View>
            </View>
            <View style={s.heroSubs}>
              <Text style={[s.pageSub1, { fontFamily: fonts.semibold }]}>
                {t.rank.competitions.tagline}
              </Text>
              <Text style={[s.pageSub2, { fontFamily: fonts.medium }]}>
                {t.rank.competitions.subtitle}
              </Text>
            </View>
          </View>

          <ProfileCard />
        </View>

        <View style={s.compGrid}>
          {competitionRows.map((row, rowIndex) => (
            <View key={`comp-row-${rowIndex}`} style={s.compRow}>
              {row.map((c) => (
                <View key={c.id} style={s.compCardSlot}>
                  <CompCard {...c} onPress={() => handleCompetitionPress(c.id)} />
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
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_BG },

  heroBlock: {
    overflow: 'hidden',
    paddingBottom: 8,
    // Pull art up under the floating header like Figma (image y=0).
    marginTop: -44,
  },
  heroBgTrophy: {
    position: 'absolute',
    top: -32,
    left: 0,
    right: 0,
    width: '100%',
    height: HERO_IMG_H + 32,
  },
  heroBgGradDiag: {
    position: 'absolute',
    top: -32,
    left: 0,
    right: 0,
    height: HERO_IMG_H + 32,
  },
  heroBgGradBottom: {
    position: 'absolute',
    top: HERO_IMG_H - 110,
    left: 0,
    right: 0,
    height: 110,
  },
  // Figma: title block at ~top 185 / 415, trailing edge, items-end.
  heroText: {
    paddingHorizontal: 18,
    paddingTop: Math.round(HERO_IMG_H * 0.22),
    paddingBottom: 10,
    zIndex: 1,
    alignItems: 'flex-end',
    maxWidth: '72%',
    alignSelf: 'flex-end',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
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
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'right',
    lineHeight: 42,
    includeFontPadding: false,
  },
  heroSubs: {
    width: '100%',
    gap: 8,
    alignItems: 'flex-end',
  },
  pageSub1: {
    color: '#d4d4d4',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'right',
    width: '100%',
    lineHeight: 24,
    includeFontPadding: false,
  },
  pageSub2: {
    color: '#a49bad',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
    width: '100%',
    lineHeight: 18,
    includeFontPadding: false,
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
});
