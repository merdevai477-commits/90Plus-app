/**
 * =============================================================================
 * QUESTIONS HUB SCREEN
 * =============================================================================
 *
 * The quiz tab's landing screen: coin pill → hero banner → "Choose Challenge
 * Type" grid → stats strip. A 1:1 port of Figma node 1:2 ("iPhone 14 Plus - 1",
 * 448pt artboard, 22pt gutters ⇒ 404pt content column).
 *
 * ── COMPOSITION MAP ──────────────────────────────────────────────────────────
 *   <SafeAreaView>                     screen shell + safe area
 *     <LinearGradient>                 page backdrop  → styles.ts HUB_SCREEN_GRADIENT
 *     <ScrollView>
 *       <HeroBanner/>                  back to Rank + coin pill + hero card
 *       <SectionHeader/>               "Choose Challenge Type" + rule
 *       <ChallengeGrid/>               the eight mode cards
 *       <StatsCard><BottomNavigation/> level, XP, answered, total XP
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   TOP / BOTTOM SAFE-AREA PADDING ... ./data.ts → getQuestionsHubContentStyle()
 *   PAGE BACKDROP .................... ./styles.ts → HUB_SCREEN_GRADIENT
 *   WHERE A CARD NAVIGATES ........... handleModePress() below
 *   COLUMN BREAKPOINTS ............... ./data.ts → getGridColumns()
 *   COPY (all strings) ............... ./data.ts → getQuestionsHubCopy()
 *   STATS SHOWN ...................... ./data.ts → buildSummaryStats()
 * =============================================================================
 */

import React, { useCallback, useMemo } from 'react';
import {
  I18nManager,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { goBackToRank } from '../quizNavigation';

import { useQuestionsModes } from '../../../hooks/useQuestionsModes';
import { useTranslation } from '../../../src/i18n';
import { useCoins } from '../../../contexts/CoinsContext';
import { useXp } from '../../../contexts/XpContext';
import type { QuestionModeId, QuestionModeSummary } from '../../../services/questionsModes';
import {
  buildChallengeItems,
  buildSummaryStats,
  chunkItems,
  getQuestionsHubContentStyle,
  getQuestionsHubCopy,
  getQuestionsHubLayout,
  mergeQuestionModes,
} from './data';
import { HUB_COLOR, HUB_SCREEN_GRADIENT, useQuestionsHubStyles } from './styles';
import HeroBanner from './components/HeroBanner';
import SectionHeader from './components/SectionHeader';
import ChallengeGrid from './components/ChallengeGrid';
import StatsCard from './components/StatsCard';
import BottomNavigation from './components/BottomNavigation';

export default function QuestionsHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { language } = useTranslation();
  const { coins } = useCoins();
  const { xp, level } = useXp();
  const { data, isFetching, refetch } = useQuestionsModes(language);
  const { hub, metrics } = useQuestionsHubStyles();

  const isArabic = language === 'ar' || I18nManager.isRTL;

  const layout = useMemo(() => getQuestionsHubLayout(screenWidth), [screenWidth]);
  const copy = useMemo(() => getQuestionsHubCopy(language), [language]);

  const mergedModes = useMemo<QuestionModeSummary[]>(() => mergeQuestionModes(data?.modes), [data?.modes]);

  /**
   * NAVIGATION — every card lands on /quiz/[mode].
   * That route (front/app/quiz/[mode].tsx) then picks the screen:
   *   'football-quiz'  → QuizHubScreen
   *   any other mode   → QuestionsModeScreen
   * The route's native header is hidden in front/app/_layout.tsx.
   */
  const handleModePress = useCallback(
    (modeId: QuestionModeId) => {
      router.push({ pathname: '/quiz/[mode]', params: { mode: modeId } });
    },
    [router],
  );

  const challengeRows = useMemo(
    () => chunkItems(buildChallengeItems(mergedModes, handleModePress), layout.columns),
    [handleModePress, layout.columns, mergedModes],
  );

  /*
   * Both counters come straight from the API's `summary` block, which the
   * backend computes from this user's own UserQuestionChallenge rows. They stay
   * null — rendered as "—" — until it arrives, rather than being back-filled
   * from a bundled bank or a per-mode XP table.
   */
  const summaryStats = useMemo(
    () =>
      buildSummaryStats({
        language,
        xp,
        answeredCount: data?.summary?.answeredCount ?? null,
        xpEarnedTotal: data?.summary?.xpEarnedTotal ?? null,
      }),
    [data?.summary?.answeredCount, data?.summary?.xpEarnedTotal, language, xp],
  );

  // Depends on `metrics.scale` (a number) rather than the metrics object, which
  // is rebuilt every render by useDesignScale().
  const contentContainerStyle = useMemo(
    () => getQuestionsHubContentStyle(layout, insets, metrics.s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insets.top, insets.bottom, layout, metrics.scale],
  );

  return (
    <SafeAreaView style={hub.root}>
      {/* Page backdrop — CUSTOMIZE in ./styles.ts → HUB_SCREEN_GRADIENT */}
      <LinearGradient colors={HUB_SCREEN_GRADIENT} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={hub.scroll}
        contentContainerStyle={[hub.content, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        // Pull-to-refresh re-fetches the modes list.
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={HUB_COLOR.textStatValue}
            colors={[HUB_COLOR.textStatValue]}
            progressBackgroundColor={HUB_COLOR.cardBg}
          />
        }
      >
        <HeroBanner coins={coins} copy={copy} onBack={goBackToRank} />

        <SectionHeader title={copy.sectionTitle} isRtl={isArabic} loading={isFetching} />

        <ChallengeGrid rows={challengeRows} columns={layout.columns} />

        <StatsCard isCompact={layout.isCompact}>
          <BottomNavigation
            level={level}
            stats={summaryStats.slice(0, 3)}
            isCompact={layout.isCompact}
          />
        </StatsCard>
      </ScrollView>
    </SafeAreaView>
  );
}
