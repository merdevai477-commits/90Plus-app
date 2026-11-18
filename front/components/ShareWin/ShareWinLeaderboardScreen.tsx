/**
 * =============================================================================
 * FULL WEEKLY RANKING — الترتيب الأسبوعي
 * =============================================================================
 *
 * Destination of "عرض الترتيب الكامل" on the Share & Win screen
 * (Figma Frame123 list 2022:6332 / row 2021:151). Rows match the preview card
 * via <LeaderboardRow/> and surface elite titles (لقب) when the API sends them.
 *
 * ── STRUCTURE ────────────────────────────────────────────────────────────────
 *   header      title, cycle week + total competitor count, close button
 *   list        paged FlatList of ranked rows
 *   pinned bar  the signed-in user's own position, always visible
 *
 * ── PERFORMANCE ──────────────────────────────────────────────────────────────
 * This list can hold thousands of users, so:
 *   • 25 rows per request, server-side paged (never the whole board)
 *   • rows are a memoised component fed only primitives — no object or closure
 *     props, no Intl work during scroll (scores are pre-formatted per page)
 *   • getItemLayout: rows are a fixed height, so scrolling never measures
 *   • stable userId keys, de-duplicated in the hook
 *   • windowing tuned down from the defaults for low-end Android
 *
 * Rank is server-computed from confirmed share count; this screen only
 * paginates and formats. Rows show invited friends, never empty shares or XP.
 * =============================================================================
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShareWinLeaderboard } from '../../hooks/useShareWinLeaderboard';
import type { ShareWinLeaderboardEntry } from '../../services/shareWin.service';
import { useTranslation } from '../../src/i18n';
import { useScreenFont } from '../../utils/fontSetup';
import { displayNameOf, formatNumber } from './data';
import LeaderboardRow from './components/LeaderboardRow';
import ShareWinPageHeader from './components/ShareWinPageHeader';
import { useShareWinStyles } from './styles';

/** Row height (~68) + gap (8) in Figma units — drives getItemLayout. */
const ROW_STRIDE = 76;

interface Row {
  key: string;
  entry: ShareWinLeaderboardEntry;
  name: string;
  scoreLabel: string;
  pointsLine: string;
  isMe: boolean;
}

export default function ShareWinLeaderboardScreen() {
  useScreenFont();

  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { sw, metrics, theme } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const { s } = metrics;

  const {
    entries,
    me,
    cycle,
    total,
    isLoading,
    isError,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
    refetch,
  } = useShareWinLeaderboard();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/auth');
    }
  }, [isLoaded, isSignedIn, router]);

  /**
   * Names and scores are formatted once per data change, not per render pass,
   * so `renderItem` stays allocation-free while scrolling.
   */
  const rows = useMemo<Row[]>(
    () =>
      entries.map((entry) => ({
        key: entry.userId,
        entry,
        name: displayNameOf(entry),
        scoreLabel: formatNumber(entry.participants, language),
        pointsLine: `${formatNumber(entry.score, language)} ${copy.pointsLabel}`,
        isMe: entry.userId === me?.userId,
      })),
    [copy.pointsLabel, entries, language, me?.userId],
  );

  const handleOpenProfile = useCallback(
    (username: string) => {
      router.push({ pathname: '/user/[username]', params: { username } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => (
      <LeaderboardRow
        rank={item.entry.rank}
        userId={item.entry.userId}
        username={item.entry.username}
        name={item.name}
        avatar={item.entry.avatar}
        isVerified={item.entry.isVerified || item.entry.identity?.isVerified}
        isDeveloper={item.entry.isDeveloper || item.entry.identity?.isDeveloper}
        badgeKey={item.entry.identity?.badge?.key}
        badgeTitle={item.entry.identity?.badge?.title}
        badgeAccent={item.entry.identity?.badge?.accent}
        scoreLabel={item.scoreLabel}
        scoreUnit={copy.boardUnit}
        pointsLine={item.pointsLine}
        isCurrentUser={item.isMe}
        onPress={handleOpenProfile}
      />
    ),
    [copy.boardUnit, handleOpenProfile],
  );

  const keyExtractor = useCallback((item: Row) => item.key, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<Row> | null | undefined, index: number) => ({
      length: s(ROW_STRIDE),
      offset: s(ROW_STRIDE) * index,
      index,
    }),
    [s],
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

  const header = (
    <ShareWinPageHeader
      title={copy.weeklyTitle}
      subtitle={
        cycle
          ? copy.leaderboardCompetitors.replace('{count}', formatNumber(total, language))
          : null
      }
      onBack={() => router.back()}
      backLabel={copy.close}
      testID="share-win-leaderboard-back"
    />
  );

  const listFooter = useMemo(() => {
    if (isFetchingNextPage) {
      return (
        <View style={sw.lbFooter}>
          <ActivityIndicator color={theme.refresh} />
        </View>
      );
    }
    if (!hasNextPage && rows.length > 0) {
      return (
        <View style={sw.lbFooter}>
          <Text style={sw.lbFooterText}>{copy.leaderboardEnd}</Text>
        </View>
      );
    }
    return <View style={{ height: s(12) }} />;
  }, [copy.leaderboardEnd, hasNextPage, isFetchingNextPage, rows.length, s, sw]);

  // ── Initial load ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={sw.root}>
        {header}
        <View style={sw.lbSkeletonList}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={`sk-${i}`} style={[sw.skeleton, sw.lbSkeletonRow]} />
          ))}
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (isError && rows.length === 0) {
    return (
      <View style={sw.root}>
        {header}
        <View style={sw.stateWrap}>
          <Text style={sw.stateTitle}>{copy.errorTitle}</Text>
          <Text style={sw.stateBody}>{copy.errorBody}</Text>
          <Pressable style={sw.stateButton} onPress={() => void refetch()} accessibilityRole="button">
            <Text style={sw.stateButtonText}>{copy.retry}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={sw.root}>
      {header}

      <FlatList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        contentContainerStyle={[
          sw.lbListContent,
          { paddingBottom: insets.bottom + s(me ? 108 : 24) },
        ]}
        ItemSeparatorComponent={ItemSeparator}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          <View style={sw.stateWrap}>
            <Text style={sw.stateBody}>{copy.leaderboardEmpty}</Text>
          </View>
        }
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        // Windowing tuned for long boards on low-end Android.
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={9}
        removeClippedSubviews
      />

      {/* Pinned "your position" — always answers "where am I?" without paging. */}
      {me ? (
        <View style={[sw.lbMineBar, { paddingBottom: insets.bottom + s(12) }]}>
          <Text style={sw.lbMineLabel}>{copy.statsRankThisWeek}</Text>
          <LeaderboardRow
            rank={me.rank}
            userId={me.userId}
            username={me.username}
            name={displayNameOf(me)}
            avatar={me.avatar}
            isVerified={me.isVerified || me.identity?.isVerified}
            isDeveloper={me.isDeveloper || me.identity?.isDeveloper}
            badgeKey={me.identity?.badge?.key}
            badgeTitle={me.identity?.badge?.title}
            badgeAccent={me.identity?.badge?.accent}
            scoreLabel={formatNumber(me.participants, language)}
            scoreUnit={copy.boardUnit}
            pointsLine={`${formatNumber(me.score, language)} ${copy.pointsLabel}`}
            isCurrentUser
          />
        </View>
      ) : null}
    </View>
  );
}

/** Hoisted so FlatList doesn't see a new component type each render. */
function ItemSeparator() {
  const { metrics } = useShareWinStyles();
  return <View style={{ height: metrics.s(8) }} />;
}
