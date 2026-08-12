/**
 * =============================================================================
 * FULL WEEKLY RANKING — الترتيب الأسبوعي
 * =============================================================================
 *
 * Destination of "عرض الترتيب الكامل" on the Share & Win screen
 * (Figma node 147:295). Row styling is node 147:294's, reused verbatim through
 * <LeaderboardRow/> so the two surfaces cannot drift apart.
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
 * Rank and score are server-computed; this screen only paginates and formats.
 * =============================================================================
 */

import React, { useCallback, useMemo } from 'react';
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
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShareWinLeaderboard } from '../../hooks/useShareWinLeaderboard';
import type { ShareWinLeaderboardEntry } from '../../services/shareWin.service';
import { useTranslation } from '../../src/i18n';
import { useScreenFont } from '../../utils/fontSetup';
import { SW_ASSET } from './assets';
import { displayNameOf, formatNumber } from './data';
import LeaderboardRow from './components/LeaderboardRow';
import { useShareWinStyles } from './styles';

/** Row height (58) + gap (8) in Figma units — drives getItemLayout. */
const ROW_STRIDE = 66;

interface Row {
  key: string;
  entry: ShareWinLeaderboardEntry;
  name: string;
  scoreLabel: string;
  isMe: boolean;
}

export default function ShareWinLeaderboardScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sw, metrics } = useShareWinStyles();
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
        scoreLabel: formatNumber(entry.score, language),
        isMe: entry.userId === me?.userId,
      })),
    [entries, language, me?.userId],
  );

  const handleOpenProfile = useCallback(
    (username: string) => {
      router.push({ pathname: '/user/[username]', params: { username } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Row>) => (
      <LeaderboardRow
        rank={item.entry.rank}
        userId={item.entry.userId}
        username={item.entry.username}
        name={item.name}
        avatar={item.entry.avatar}
        scoreLabel={item.scoreLabel}
        tierIndex={index}
        isCurrentUser={item.isMe}
        onPress={handleOpenProfile}
      />
    ),
    [handleOpenProfile],
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
        tintColor="#B772F8"
        colors={['#B772F8']}
      />
    ),
    [isRefetching, refetch],
  );

  const header = (
    <View style={[sw.lbHeader, { paddingTop: insets.top + s(12) }]}>
      <View style={sw.lbHeaderTitles}>
        <Text style={sw.lbTitle} accessibilityRole="header">
          {copy.weeklyTitle}
        </Text>
        {cycle ? (
          <Text style={sw.lbSubtitle}>
            {copy.leaderboardCompetitors.replace('{count}', formatNumber(total, language))}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={copy.close}
        style={sw.lbCloseButton}
      >
        <Image
          source={SW_ASSET.chevronRight}
          style={{ width: s(24), height: s(24), transform: [{ scaleX: -1 }] }}
          contentFit="contain"
          transition={0}
        />
      </Pressable>
    </View>
  );

  const listFooter = useMemo(() => {
    if (isFetchingNextPage) {
      return (
        <View style={sw.lbFooter}>
          <ActivityIndicator color="#B772F8" />
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
            scoreLabel={formatNumber(me.score, language)}
            tierIndex={me.rank - 1}
            isCurrentUser
            solid
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
