/**
 * توقع واربح — Predict & Win hub, now the Sponsors tab.
 *
 * Figma `597:2152` (448×985 artboard). Lives under `(tabs)` so the liquid
 * bottom nav stays visible; detail (`/predict-and-win/[id]`) and create
 * (`/predict-and-win/create`) remain stack routes and hide the bar.
 *
 * **Why `FlatList` and not `FlashList`.** The hub shipped on FlashList and
 * rendered the header block with nothing under it — no cards, and not the
 * empty/error placeholder either, even though the API was returning rows.
 * FlashList v2 paints a cell only after a measurement pre-pass; when that
 * comes back 0 the rows stay in the tree unpainted. This list is at most one
 * 20-row page of fixed-height cards, so `FlatList` is the right tool.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddPrizeFab } from '../../components/predictAndWin/AddPrizeFab';
import { CompetitionCard } from '../../components/predictAndWin/CompetitionCard';
import { InfoTiles } from '../../components/predictAndWin/InfoTiles';
import { PWHeader } from '../../components/predictAndWin/PWHeader';
import { SortFilterRow } from '../../components/predictAndWin/SortFilterRow';
import { PredictAndWinTabBar } from '../../components/predictAndWin/TabBar';
import { IconGiftFilled } from '../../components/predictAndWin/icons';
import { PW, usePWFonts, usePWScale } from '../../components/predictAndWin/theme';
import { TAB_BAR_HEIGHT } from '../../components/navigation/liquidGlassTabBar.constants';
import { useCompetitions } from '../../hooks/useCompetitions';
import { useTranslation } from '../../src/i18n';
import { useScreenFont } from '../../utils/fontSetup';
import type { CompetitionInfo, CompetitionTab } from '../../services/competitions.service';

const keyExtractor = (item: CompetitionInfo) => item.id;

function CardSeparator() {
  const { s } = usePWScale();
  return <View style={{ height: s(24) }} />;
}

export default function PredictAndWinScreen() {
  useScreenFont();
  const { s } = usePWScale();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const {
    tab,
    filter,
    sort,
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    changeTab,
    changeFilter,
    changeSort,
    refresh,
    loadMore,
  } = useCompetitions();

  const renderItem = useCallback(
    ({ item }: { item: CompetitionInfo }) => (
      <CompetitionCard
        competition={item}
        onPress={() => router.push(`/predict-and-win/${item.id}`)}
      />
    ),
    [router],
  );

  const gap28 = s(28);
  const gap14 = s(14);
  const gap24 = s(24);
  const emptyPadTop = s(60);
  const bottomPad = insets.bottom + TAB_BAR_HEIGHT + s(140);
  const fabBottom = insets.bottom + TAB_BAR_HEIGHT + s(16);

  const listHeader = useMemo(
    () => (
      <View>
        <View style={{ height: gap28 }} />
        <PredictAndWinTabBar active={tab} onChange={changeTab} />
        <View style={{ height: gap14 }} />
        <InfoTiles active={filter} onChange={changeFilter} />
        <View style={{ height: gap24 }} />
        <SortFilterRow
          sort={sort}
          onSortChange={changeSort}
          filter={filter}
          onFilterChange={changeFilter}
        />
        <View style={{ height: gap24 }} />
      </View>
    ),
    [gap28, gap14, gap24, tab, changeTab, filter, changeFilter, sort, changeSort],
  );

  const listEmpty = useMemo(
    () =>
      loading && items.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: emptyPadTop }}>
          <ActivityIndicator color={PW.ctaTop} size="large" />
        </View>
      ) : items.length === 0 ? (
        <HubPlaceholder error={error} tab={tab} onRetry={refresh} />
      ) : null,
    [loading, items.length, emptyPadTop, error, tab, refresh],
  );

  const listFooter = useMemo(
    () =>
      loadingMore ? (
        <ActivityIndicator color={PW.ctaTop} style={{ marginTop: gap24 }} />
      ) : null,
    [loadingMore, gap24],
  );

  const listRefreshControl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={PW.vsTop} />,
    [refreshing, refresh],
  );

  const contentContainerStyle = useMemo(
    () => ({ paddingBottom: bottomPad }),
    [bottomPad],
  );

  return (
    <View style={{ flex: 1, backgroundColor: PW.screen }}>
      <PWHeader
        title={t.predictAndWin.title}
        onBell={() => router.push('/notifications')}
      />

      <FlatList
        style={{ flex: 1 }}
        data={items}
        extraData={`${tab}:${filter ?? ''}:${sort}:${items.length}`}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={CardSeparator}
        contentContainerStyle={contentContainerStyle}
        ListHeaderComponent={listHeader}
        refreshControl={listRefreshControl}
        onEndReachedThreshold={0.4}
        onEndReached={hasMore ? loadMore : undefined}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        removeClippedSubviews={false}
      />

      <AddPrizeFab
        onPress={() => router.push('/predict-and-win/create')}
        bottom={fabBottom}
      />
    </View>
  );
}

function HubPlaceholder({
  error,
  tab,
  onRetry,
}: {
  error: string | null;
  tab: CompetitionTab;
  onRetry: () => void;
}) {
  const { s, f } = usePWScale();
  const { bold, regular, semibold } = usePWFonts();
  const { t } = useTranslation();
  const pw = t.predictAndWin;

  const needsSignIn = error === 'AUTH_REQUIRED' || (error && tab === 'mine');
  const copy = needsSignIn ? pw.signInState : error ? pw.errorState : pw.empty;

  return (
    <View style={{ alignItems: 'center', gap: s(10), paddingHorizontal: s(40) }}>
      <IconGiftFilled width={s(40)} height={s(40)} />
      <Text style={{ fontFamily: bold, fontSize: f(16), color: PW.text, textAlign: 'center' }}>
        {copy.title}
      </Text>
      <Text
        style={{
          fontFamily: regular,
          fontSize: f(12),
          color: PW.textTileSub,
          textAlign: 'center',
        }}
      >
        {copy.subtitle}
      </Text>

      {error && !needsSignIn ? (
        <Pressable onPress={onRetry} hitSlop={8} style={{ marginTop: s(6) }}>
          <Text style={{ fontFamily: semibold, fontSize: f(13), color: PW.vsTop }}>
            {pw.errorState.retry}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
