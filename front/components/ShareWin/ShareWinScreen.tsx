/**
 * =============================================================================
 * SHARE & WIN SCREEN — شارك واربح
 * =============================================================================
 *
 * A 1:1 port of Figma node 109:470 ("iPhone 14 Plus - 2", 448pt artboard,
 * 22pt gutters ⇒ 404pt content column).
 *
 * ── COMPOSITION MAP ──────────────────────────────────────────────────────────
 *   <View>                            screen shell (safe area via insets —
 *                                     RN's SafeAreaView is a no-op on Android)
 *     <ScrollView>
 *       <HeroHeader/>                 "شارك واربح" + ranking-by-shares line
 *       <WeeklyRankingCard/>          countdown + top 5 + full-ranking pill
 *       <WeeklyPrizes/>               cycle prize carousel
 *       <ShareCard/>                  referral link, copy, channels, hint
 *       <LastWinnerCard/>             rank 1 of the last closed cycle
 *       <StatsBar/>                   LAST SECTION of the page content —
 *                                     friends · confirmed shares · rank. In normal flow,
 *                                     not a footer and not pinned.
 *
 * ── WHERE THE NUMBERS COME FROM ──────────────────────────────────────────────
 *   Everything statistical — shares, participants, score, rank, the cycle
 *   window, the leaderboard, the prizes and the last winner — is served by
 *   GET /api/share-win/me. This screen formats; it never derives.
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   COLOURS / SIZES / RADII ......... ./styles.ts → SW_COLOR, SW_GRADIENT
 *   COPY (all strings) .............. locales/ar.ts + locales/en.ts → shareWin
 *   SHARE BEHAVIOUR ................. hooks/useShareWin.ts
 *   WHERE "full ranking" GOES ....... handleViewFullRanking() below
 * =============================================================================
 */

import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShareWin, type ShareChannel } from '../../hooks/useShareWin';
import { useTranslation } from '../../src/i18n';
import { useScreenFont } from '../../utils/fontSetup';
import type { ShareWinLastWinner } from '../../services/shareWin.service';

import { SW_ASSET } from './assets';
import HeroHeader from './components/HeroHeader';
import LastWinnerCard from './components/LastWinnerCard';
import LuckyWheelCard from './components/LuckyWheelCard';
import ShareCard from './components/ShareCard';
import ShareWinSkeleton from './components/ShareWinSkeleton';
import StatsBar from './components/StatsBar';
import WeeklyPrizes from './components/WeeklyPrizes';
import WeeklyRankingCard from './components/WeeklyRankingCard';
import { useShareWinStyles } from './styles';

/**
 * Trailing space after the last content section (the stats bar). Figma leaves
 * 16pt between it and the frame's tab bar; this route is a root Stack screen
 * with no tab bar, so the safe-area inset is added to that on device.
 */
const PAGE_END_GAP = 16;

export default function ShareWinScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sw, metrics } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const { s } = metrics;

  const {
    overview,
    isLoading,
    isError,
    isRefetching,
    refetch,
    shareReferral,
    copyReferralLink,
    trackShare,
  } = useShareWin();

  /** The page simply ends after the stats bar — nothing floats over it. */
  const scrollBottomPadding = insets.bottom + s(PAGE_END_GAP);
  /**
   * The header now owns the top safe-area, so this is 0. The name must still
   * appear in the ScrollView style objects: Fast Refresh / nativewind wrap-jsx
   * looks it up after a hot reload, and dropping it crashes with
   * `Property 'scrollTopPadding' doesn't exist`.
   */
  const scrollTopPadding = 0;

  const handleViewFullRanking = useCallback(() => {
    router.push('/share-win/leaderboard');
  }, [router]);

  /**
   * Always Rank. `router.back()` can land on Matches (tab history) or nowhere
   * at all after a cold-start invite link — this page is entered from Rank.
   */
  const handleLeave = useCallback(() => {
    router.replace('/(tabs)/rank');
  }, [router]);

  /** Same header on every state — loading, error and ready. */
  const pageHeader = (
    <View
      style={[
        sw.pageHeader,
        {
          paddingTop: insets.top + s(8),
          paddingLeft: Math.max(insets.left, s(16)),
          paddingRight: Math.max(insets.right, s(16)),
          flexDirection: language === 'ar' ? 'row-reverse' : 'row',
        },
      ]}
    >
      <Pressable
        onPress={handleLeave}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={copy.backToRank ?? copy.close}
        testID="share-win-back"
        style={({ pressed }) => [sw.pageBackButton, pressed && { opacity: 0.7 }]}
      >
        <Image
          source={SW_ASSET.chevronRight}
          style={{
            width: s(22),
            height: s(22),
            tintColor: '#FFFFFF',
            transform: [{ scaleX: language === 'ar' ? 1 : -1 }],
          }}
          contentFit="contain"
          transition={0}
        />
      </Pressable>
    </View>
  );

  const handleViewStory = useCallback(
    (winner: ShareWinLastWinner) => {
      router.push({ pathname: '/user/[username]', params: { username: winner.username } });
    },
    [router],
  );

  /** A channel tile that opened its native app still counts as a share. */
  const handleChannelShared = useCallback(
    (channel: ShareChannel) => {
      void trackShare(channel);
    },
    [trackShare],
  );

  /**
   * Channels without a text-share intent (Instagram, Snapchat) and any
   * uninstalled app fall through to the OS share sheet, which the hook owns.
   */
  const handleFallbackShare = useCallback(
    (channel: ShareChannel) => {
      void shareReferral(language === 'ar' ? 'ar' : 'en', channel);
    },
    [language, shareReferral],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        tintColor="#B772F8"
        colors={['#B772F8']}
      />
    ),
    [isRefetching, refetch],
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading && !overview) {
    return (
      <View style={sw.root}>
        {pageHeader}
        <ScrollView
          style={sw.scroll}
          contentContainerStyle={[
            sw.scrollContent,
            { paddingTop: scrollTopPadding, paddingBottom: scrollBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ShareWinSkeleton />
        </ScrollView>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (isError && !overview) {
    return (
      <View style={sw.root}>
        {pageHeader}
        <View style={sw.stateWrap}>
          <Text style={sw.stateTitle}>{copy.errorTitle}</Text>
          <Text style={sw.stateBody}>{copy.errorBody}</Text>
          <TouchableOpacity
            style={sw.stateButton}
            onPress={() => void refetch()}
            accessibilityRole="button"
          >
            <Text style={sw.stateButtonText}>{copy.retry}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // The brief gap between "loaded" and "has data". It gets the back control
  // too, so there is no frame of this screen without a way out.
  if (!overview) return <View style={sw.root}>{pageHeader}</View>;

  // ── Ready ─────────────────────────────────────────────────────────────────
  return (
    <View style={sw.root}>
      {pageHeader}
      <ScrollView
        style={sw.scroll}
        contentContainerStyle={[
          sw.scrollContent,
          { paddingTop: scrollTopPadding, paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <HeroHeader />

        {/*
         * Fast Refresh / nativewind wrap-jsx still looks up this tag after the
         * wheel left the page. Keep the binding; never mount it.
         */}
        {false ? <LuckyWheelCard onSpinSettled={() => undefined} /> : null}

        <WeeklyRankingCard
          entries={overview.leaderboard}
          cycleEndAt={overview.cycle.endAt}
          onViewFullRanking={handleViewFullRanking}
        />

        <WeeklyPrizes prizes={overview.prizes} />

        <ShareCard
          referralCode={overview.referralCode}
          referralLink={overview.referralLink}
          onCopyLink={() => void copyReferralLink()}
          onShared={handleChannelShared}
          onFallbackShare={handleFallbackShare}
        />

        <LastWinnerCard winner={overview.lastWinner} onViewStory={handleViewStory} />

        {/* Final content section — scrolls with the page, 44pt below the card
            above it (Figma 186:108 at y=2615, last winner ending at 2571). */}
        <StatsBar
          participants={overview.participants}
          shares={overview.shareCount}
          rank={overview.rank}
        />
      </ScrollView>
    </View>
  );
}
