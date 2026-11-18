/**
 * =============================================================================
 * SHARE & WIN SCREEN — شارك واربح
 * =============================================================================
 *
 * Figma Frame123 (1997:5301) — light tokens + dark adaptation.
 *
 * Composition:
 *   Header → Stats → Prizes → Share → Monthly ranking (countdown + podium + list)
 * =============================================================================
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShareWin, type ShareChannel } from '../../hooks/useShareWin';
import { useTranslation } from '../../src/i18n';
import { useScreenFont } from '../../utils/fontSetup';

import { SW_ASSET } from './assets';
import LuckyWheelCard from './components/LuckyWheelCard';
import ShareCard from './components/ShareCard';
import ShareWinSkeleton from './components/ShareWinSkeleton';
import StatsBar from './components/StatsBar';
import WeeklyPrizes from './components/WeeklyPrizes';
import WeeklyRankingCard from './components/WeeklyRankingCard';
import { useShareWinStyles } from './styles';

const PAGE_END_GAP = 24;

export default function ShareWinScreen() {
  useScreenFont();

  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { sw, metrics, theme } = useShareWinStyles();
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

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/auth');
    }
  }, [isLoaded, isSignedIn, router]);

  const scrollBottomPadding = insets.bottom + s(PAGE_END_GAP);
  const scrollTopPadding = s(12);

  const handleViewFullRanking = useCallback(() => {
    router.push('/share-win/leaderboard');
  }, [router]);

  const handleLeave = useCallback(() => {
    if (!isSignedIn) {
      router.replace('/auth');
      return;
    }
    router.replace('/(tabs)/rank');
  }, [isSignedIn, router]);

  const pageHeader = (
    <View
      style={[
        sw.pageHeader,
        {
          paddingTop: insets.top + s(10),
          paddingBottom: s(10),
          paddingLeft: Math.max(insets.left, s(20)),
          paddingRight: Math.max(insets.right, s(20)),
          flexDirection: 'row',
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
          source={SW_ASSET.backV2}
          style={{
            width: s(24),
            height: s(24),
            tintColor: theme.headerIcon,
            transform: [{ scaleX: -1 }],
          }}
          contentFit="contain"
          transition={0}
        />
      </Pressable>

      <Text style={sw.pageHeaderTitle} numberOfLines={1}>
        {`${copy.titleHighlight}${copy.titleRest}`}
      </Text>

      <View style={sw.pageBackButton} pointerEvents="none" />
    </View>
  );

  const handleChannelShared = useCallback(
    (channel: ShareChannel) => {
      void trackShare(channel);
    },
    [trackShare],
  );

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
        tintColor={theme.refresh}
        colors={[theme.refresh]}
      />
    ),
    [isRefetching, refetch, theme.refresh],
  );

  if (!isLoaded || !isSignedIn) {
    return <View style={sw.root} />;
  }

  if (isLoading && !overview) {
    return (
      <View style={sw.root}>
        <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />
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

  if (isError && !overview) {
    return (
      <View style={sw.root}>
        <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />
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

  if (!overview) {
    return (
      <View style={sw.root}>
        <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />
        {pageHeader}
      </View>
    );
  }

  return (
    <View style={sw.root}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />
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
        {/* Fast Refresh keeps this binding; never mount. */}
        {false ? <LuckyWheelCard onSpinSettled={() => undefined} /> : null}

        <StatsBar
          score={overview.score}
          shareCount={overview.shareCount}
          rank={overview.rank}
        />

        <WeeklyPrizes prizes={overview.prizes} />

        <ShareCard
          referralCode={overview.referralCode}
          referralLink={overview.referralLink}
          onCopyLink={() => void copyReferralLink()}
          onShared={handleChannelShared}
          onFallbackShare={handleFallbackShare}
        />

        <WeeklyRankingCard
          entries={overview.leaderboard}
          cycleEndAt={overview.cycle.endAt}
          onViewFullRanking={handleViewFullRanking}
        />
      </ScrollView>
    </View>
  );
}
