/**
 * Rank tab screen — competitions hub.
 *
 * Light + dark share the same Figma 1957:131 structure:
 * title → profile card → stacked competition cards.
 * Only the palette changes via getRankTheme(isDark).
 */

import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Crown, Gift, Handshake, Share2, Target, Zap } from 'lucide-react-native';
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
      paddingTop: insets.top + 56,
      paddingBottom: Math.max(insets.bottom, 16) + 88,
    }),
    [insets.top, insets.bottom],
  );

  /** Stack art from Figma — same cards in light and dark. */
  const stackArt = useMemo(
    () => ({
      share: require('../../assets/images/rank/figma-light/comp-share.png') as ImageSourcePropType,
      scorers: require('../../assets/images/rank/figma-light/comp-scorers.png') as ImageSourcePropType,
      predictions: require('../../assets/images/rank/figma-light/comp-predictions.png') as ImageSourcePropType,
      coach: require('../../assets/images/rank/figma-light/comp-coach.png') as ImageSourcePropType,
      sponsors: require('../../assets/images/rank/figma-light/comp-sponsors.png') as ImageSourcePropType,
    }),
    [],
  );

  const competitions = useMemo(
    () => [
      {
        id: '2',
        title: t.rank.competitionNames.shareAndEarn.title,
        sub: t.rank.competitionNames.shareAndEarn.sub,
        actionText: t.rank.competitionNames.shareAndEarn.action,
        rewardHint: shareRewardHint(),
        img: stackArt.share,
        titleIcon: Gift,
        ctaIcon: Share2,
      },
      {
        id: '4',
        title: t.rank.competitionNames.engagementHero.title,
        sub: t.rank.competitionNames.engagementHero.sub,
        actionText: t.rank.competitionNames.engagementHero.action,
        img: stackArt.scorers,
        titleIcon: Zap,
        ctaIcon: Zap,
      },
      {
        id: '1',
        title: t.rank.competitionNames.kingOfPredictions.title,
        sub: t.rank.competitionNames.kingOfPredictions.sub,
        actionText: t.rank.competitionNames.kingOfPredictions.action,
        img: stackArt.predictions,
        titleIcon: Crown,
        ctaIcon: Crown,
      },
      {
        id: 'coach',
        title: t.rank.coachKing.title,
        sub: t.rank.coachKing.subtitle,
        actionText: t.rank.coachKing.start,
        img: stackArt.coach,
        titleIcon: Target,
        ctaIcon: Target,
      },
      {
        id: '3',
        title: t.rank.competitionNames.sponsors.title,
        sub: t.rank.competitionNames.sponsors.sub,
        actionText: t.rank.competitionNames.sponsors.action,
        img: stackArt.sponsors,
        titleIcon: Handshake,
        ctaIcon: Target,
      },
    ],
    [t, shareRewardHint, stackArt],
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
        <View style={s.hero}>
          <Text
            style={[
              s.pageTitle,
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
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingHorizontal: 8,
    paddingTop: 4,
    gap: 8,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  /** Figma list: left 20, width 390, gap 20 between cards. */
  stackList: {
    paddingHorizontal: 20,
    gap: 20,
    marginTop: 12,
    marginBottom: 24,
  },
});
