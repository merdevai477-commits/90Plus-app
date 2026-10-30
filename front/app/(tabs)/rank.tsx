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
            contentFit="contain"
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['#030008', '#030008', 'rgba(3,0,8,0.0)', 'transparent']}
            style={s.heroBgGradLeft}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <LinearGradient
            colors={['transparent', 'rgba(10,6,18,0.55)', '#0A0612']}
            style={s.heroBgGradBottom}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          <View style={s.heroText}>
            <View style={s.titleRow}>
              <View style={s.trophyIconBox}>
                <Trophy size={20} color="#fff" />
              </View>
              <Text style={[s.pageTitle, { fontFamily: fonts.extrabold }]}>{t.rank.competitions.title}</Text>
            </View>
            <Text style={s.pageSub1}>{t.rank.competitions.tagline}</Text>
            <Text style={s.pageSub2}>{t.rank.competitions.subtitle}</Text>
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

  heroBlock: { overflow: 'hidden', paddingBottom: 20 },
  heroBgTrophy: {
    position: 'absolute',
    top: 0,
    end: 0,
    width: '90%',
    height: '100%',
    opacity: 0.95,
  },
  heroBgGradLeft: {
    position: 'absolute',
    top: 0,
    start: 0,
    bottom: 0,
    width: '62%',
  },
  heroBgGradBottom: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    height: 100,
  },
  heroText: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, zIndex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  trophyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(39, 8, 94, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  pageTitle: { color: '#fff', fontSize: 34, fontWeight: '900' },
  pageSub1: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  pageSub2: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },

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
