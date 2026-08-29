/**
 * توقع واربح — Predict & Win hub, now the Sponsors tab.
 *
 * Figma `597:2152` (448×985 artboard). Lives under `(tabs)` so the liquid
 * bottom nav stays visible; detail (`/predict-and-win/[id]`) and create
 * (`/predict-and-win/create`) remain stack routes and hide the bar.
 *
 * The hub shipped on FlashList, then FlatList, and both could paint the
 * header with a blank void underneath — no cards and no empty placeholder —
 * while `GET /competitions` was returning rows. This list is one page of
 * fixed-height cards, so a `ScrollView` of mapped rows is the reliable tool.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HubPrizeCard } from '../../components/predictAndWin/CompetitionCard';
import { InfoTiles } from '../../components/predictAndWin/InfoTiles';
import { PWHeader, usePWHeaderOffset } from '../../components/predictAndWin/PWHeader';
import { PredictScoreModal } from '../../components/predictAndWin/PredictScoreModal';
import { SortFilterRow } from '../../components/predictAndWin/SortFilterRow';
import { PredictAndWinTabBar } from '../../components/predictAndWin/TabBar';
import { WinnerPickerModal } from '../../components/predictAndWin/WinnerPickerModal';
import { PW, usePWScale } from '../../components/predictAndWin/theme';
import { TAB_BAR_HEIGHT } from '../../components/navigation/liquidGlassTabBar.constants';
import { useCompetitions } from '../../hooks/useCompetitions';
import { ALWAYS_ADD_PRIZE_CTA, useSponsorPrizeCta } from '../../hooks/useSponsorPrizeCta';
import { useTranslation } from '../../src/i18n';
import { useScreenFont } from '../../utils/fontSetup';
import { isEntryOpen, type CompetitionInfo, type CompetitionTab } from '../../services/competitions.service';

export default function PredictAndWinScreen() {
  useScreenFont();
  const { s } = usePWScale();
  const insets = useSafeAreaInsets();
  const headerOffset = usePWHeaderOffset();
  const router = useRouter();
  const { t } = useTranslation();

  const {
    tab,
    sort,
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    changeTab,
    changeSort,
    refresh,
    loadMore,
    applyEntry,
    commitEntry,
    revertEntry,
  } = useCompetitions();

  const rows = Array.isArray(items) ? items : [];

  const { variant: addPrizeVariant, competitionId, loading: addPrizeLoading } =
    useSponsorPrizeCta();
  const [winnerOpen, setWinnerOpen] = useState(false);
  const [predictTarget, setPredictTarget] = useState<CompetitionInfo | null>(null);

  const goToCreate = useCallback(() => router.push('/predict-and-win/create'), [router]);

  const onAddPrizePress = useCallback(() => {
    if (ALWAYS_ADD_PRIZE_CTA || addPrizeVariant === 'add') {
      goToCreate();
      return;
    }
    if (addPrizeVariant === 'winner') {
      setWinnerOpen(true);
      return;
    }
    if (competitionId) {
      router.push(`/predict-and-win/${competitionId}`);
    }
  }, [addPrizeVariant, competitionId, goToCreate, router]);

  const gap28 = s(28);
  const gap14 = s(14);
  const emptyPadTop = s(60);
  const cardGap = s(24);
  const bottomPad = insets.bottom + TAB_BAR_HEIGHT + s(24);

  const listHeader = useMemo(
    () => (
      <View>
        <View style={{ height: gap28 }} />
        <PredictAndWinTabBar active={tab} onChange={changeTab} />
        <View style={{ height: gap14 }} />
        <InfoTiles />
        <View style={{ height: gap28 }} />
        <SortFilterRow
          sort={sort}
          onSortChange={changeSort}
          onAddPrize={onAddPrizePress}
          addPrizeVariant={addPrizeVariant}
          addPrizeLoading={addPrizeLoading}
        />
        <View style={{ height: gap28 }} />
      </View>
    ),
    [gap28, gap14, tab, changeTab, sort, changeSort, onAddPrizePress, addPrizeVariant, addPrizeLoading],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasMore || loadingMore) return;
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 240) {
        void loadMore();
      }
    },
    [hasMore, loadingMore, loadMore],
  );

  return (
    <View style={{ flex: 1, backgroundColor: PW.screen }}>
      <PWHeader
        title={t.predictAndWin.title}
        onBell={() => router.push('/notifications')}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: headerOffset, paddingBottom: bottomPad, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={PW.vsTop} />
        }
        onScroll={hasMore ? onScroll : undefined}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {listHeader}

        {loading && rows.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: emptyPadTop }}>
            <ActivityIndicator color={PW.ctaTop} size="large" />
          </View>
        ) : null}

        {!loading && rows.length === 0 ? (
          <HubPlaceholder error={error} tab={tab} onRetry={refresh} />
        ) : null}

        {rows.map((item: CompetitionInfo) => (
          <View key={item.id} style={{ marginBottom: cardGap }}>
            <HubPrizeCard
              competition={item}
              onPress={() => {
                if (isEntryOpen(item)) {
                  setPredictTarget(item);
                  return;
                }
                router.push(`/predict-and-win/${item.id}`);
              }}
            />
          </View>
        ))}

        {loadingMore ? (
          <ActivityIndicator color={PW.ctaTop} style={{ marginTop: gap28 }} />
        ) : null}
      </ScrollView>

      <PredictScoreModal
        visible={!!predictTarget}
        competition={predictTarget}
        onClose={() => setPredictTarget(null)}
        onSubmitted={(entry, id) => {
          applyEntry(id, entry);
          setPredictTarget(null);
        }}
        onSubmitSettled={(entry, id) => {
          applyEntry(id, entry);
          commitEntry(id);
        }}
        onSubmitFailed={(id) => revertEntry(id)}
      />

      <WinnerPickerModal
        visible={winnerOpen}
        competitionId={competitionId}
        onClose={() => setWinnerOpen(false)}
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
  const { t } = useTranslation();
  const pw = t.predictAndWin;

  const needsSignIn = error === 'AUTH_REQUIRED' || (error && tab === 'mine');
  const copy = needsSignIn ? pw.signInState : error ? pw.errorState : pw.empty;

  return (
    <View
      collapsable={false}
      style={{
        alignItems: 'center',
        minHeight: 180,
        paddingHorizontal: 32,
        paddingTop: 24,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
        {copy.title}
      </Text>
      <Text
        style={{
          color: '#CBCBCB',
          fontSize: 13,
          textAlign: 'center',
          marginTop: 8,
        }}
      >
        {copy.subtitle}
      </Text>

      {error && !needsSignIn ? (
        <Pressable onPress={onRetry} hitSlop={8} style={{ marginTop: 12 }}>
          <Text style={{ color: '#A44AF9', fontSize: 14, fontWeight: '600' }}>
            {pw.errorState.retry}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
