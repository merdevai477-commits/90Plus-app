/**
 * توقع واربح — Predict & Win hub. Figma `597:2152` (448×985 artboard), the
 * frame the section labels "Design For User".
 *
 * Vertical rhythm below the 128-tall header block (status bar 62 + bar 66):
 *   tabs   y156 (h67)  → 28 below the header
 *   tiles  y237 (h112) → 14 below the tabs
 *   sort   y373 (h34)  → 24 below the tiles
 *   cards  y431        → 24 below the sort row, 24 between cards
 *
 * The sibling frame `624:4349` ("Design For Sponser") is the same screen with
 * the "أضف جائزتك" FAB and 10pt/14pt looser gaps; the user frame is the one
 * this route renders, so its measurements win. The FAB is kept because it is
 * the only entry point to the sponsor wizard, which the same section designs.
 *
 * **Why `FlatList` and not `FlashList`.** The hub shipped on FlashList and
 * rendered the header block (tabs, tiles, sort row) with nothing under it —
 * no cards, and not the empty/error placeholder either, even though the API
 * was returning rows. Those two facts together locate the fault precisely:
 * `ListEmptyComponent` is *always* something visible here (a spinner while
 * loading, copy otherwise), so "nothing at all" can only mean the list had
 * data and did not paint it.
 *
 * FlashList v2 paints a cell only after a measurement pre-pass agrees with
 * itself: cells live in an absolutely-positioned container held at
 * `opacity: 0` until layout commits, and every cell's width is forced to the
 * `boundedSize` it derives from a zero-height probe view measured inside the
 * scroller. When either measurement comes back 0 the rows are still in the
 * tree, just unpainted — exactly what the screen showed. This list is at most
 * one 20-row page of fixed-height cards behind a heavy header, so that
 * machinery buys nothing and was the only thing between the data and the
 * screen. `FlatList` lays the same cells out in ordinary flex flow, with no
 * pre-pass, no forced width and no opacity gate.
 *
 * Every list prop below is a stable reference (module scope or `useMemo`).
 * Inline arrows/elements re-type the cells on every render — the same rule
 * `matches.tsx` documents at its `ITEM_SEPARATOR_*` constants.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddPrizeFab } from '../components/predictAndWin/AddPrizeFab';
import { CompetitionCard } from '../components/predictAndWin/CompetitionCard';
import { InfoTiles } from '../components/predictAndWin/InfoTiles';
import { PWHeader } from '../components/predictAndWin/PWHeader';
import { SortFilterRow } from '../components/predictAndWin/SortFilterRow';
import { PredictAndWinTabBar } from '../components/predictAndWin/TabBar';
import { IconGiftFilled } from '../components/predictAndWin/icons';
import { PW, usePWFonts, usePWScale } from '../components/predictAndWin/theme';
import { useCompetitions } from '../hooks/useCompetitions';
import { useTranslation } from '../src/i18n';
import { useScreenFont } from '../utils/fontSetup';
import type { CompetitionInfo, CompetitionTab } from '../services/competitions.service';

/**
 * A load in flight renders the spinner instead of the previous page, and the
 * empty array has to keep its identity across renders — a fresh `[]` makes the
 * list treat every render as a data change.
 */
const keyExtractor = (item: CompetitionInfo) => item.id;

/**
 * Module scope on purpose: a separator declared inline is a new component
 * *type* on every render, which re-types every cell. It still scales with the
 * viewport because it reads the scale itself rather than closing over it.
 */
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
      <View style={{ backgroundColor: '#ff0000', minHeight: 70, paddingVertical: 6 }}>
        <Text style={{ color: '#ffffff', fontSize: 15 }}>
          DBG {item.sponsor?.name} | {item.prizeName}
        </Text>
        <CompetitionCard
          competition={item}
          onPress={() => router.push(`/predict-and-win/${item.id}`)}
        />
      </View>
    ),
    [router],
  );

  /**
   * `usePWScale()` hands back a fresh `s` closure on every render, so the memos
   * below key off the resolved *numbers* instead — those only change when the
   * viewport does. Depending on `s` would recompute all of them every render
   * and put the identity churn straight back.
   */
  const gap28 = s(28);
  const gap14 = s(14);
  const gap24 = s(24);
  const emptyPadTop = s(60);
  const bottomPad = insets.bottom + s(140);

  /* The tabs, tiles and sort row stay mounted while a tab loads. Swapping the
     whole list for a full-screen spinner unmounted them, so the controls
     flickered away on every tab tap and could not be tapped again until the
     request landed. */
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
      <PWHeader title={t.predictAndWin.title} onBack={() => router.back()} />

      <View style={{ backgroundColor: '#ff0000', padding: 8 }}>
        <Text style={{ color: '#ffffff', fontSize: 16 }}>
          DBG items={Array.isArray(items) ? items.length : `NOT_ARRAY:${typeof items}`} loading=
          {String(loading)} err={String(error)} tab={tab}
        </Text>
      </View>

      <FlatList
        // Explicit rather than leaning on ScrollView's default `flexGrow: 1`:
        // a list that sizes to its content would show the header and clip
        // everything under it, which is the failure this screen just had.
        style={{ flex: 1 }}
        // Always pass the fetched rows through. Gating on `loading` hid cards
        // whenever `setItems` landed before `setLoading(false)` — the list
        // held data but painted nothing, which is the void in the screenshot.
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
        // One page is 20 fixed-height cards, so the whole page can mount at
        // once: nothing here is expensive enough to justify windowing it away
        // and re-mounting it on every scroll.
        initialNumToRender={20}
        removeClippedSubviews={false}
      />

      {/* Figma's sponsor hub (`624:4349`) instantiates the icon-only variant
          of `Component 13`; the labelled pill this used to expand into is a
          second variant the screen does not use. The button places itself from
          the design's own 33/46 margins and the safe-area insets. */}
      <AddPrizeFab onPress={() => router.push('/predict-and-win/create')} />
    </View>
  );
}

/**
 * Empty / error / sign-in states. A failed request is never rendered as
 * "no challenges" — the two are distinguishable and the error is retryable.
 */
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
