import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';

import { PredictionsService, type KingLeaderboard, type KingLeaderboardEntry, type KingPeriod } from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ICON } from './assets';
import { KingBoardRow, KingEmptyState, KingOrnament, KingPeriodTabs } from './KingBoardList';
import { KingHeader } from './KingHeader';
import { KING_BG, KING_PURPLE, parseKingMode, toApiMode } from './shared';
import { useKingPicksStore } from './kingPicksStore';

export function KingLeaderboardScreen({ mode: modeParam }: { mode: string | string[] | undefined }) {
  const mode = parseKingMode(Array.isArray(modeParam) ? modeParam[0] : modeParam);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { t } = useTranslation();
  const copy = t.kingPredictions;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const fontRegular = useAppFont(400);

  const [period, setPeriod] = useState<KingPeriod>('week');
  const results = useKingPicksStore((state) => state.results);
  const [board, setBoard] = useState<KingLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const hasToken = !!(await getTokenRef.current().catch(() => null));
    if (!hasToken) {
      setBoard(null);
      return;
    }
    const data = await PredictionsService.getKingLeaderboard(
      getTokenRef.current,
      toApiMode(mode),
      period,
    ).catch(() => null);
    setBoard(data);
    // `results` re-runs this when a PREDICTION_RESULT push lands (D9).
  }, [mode, period, results]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const title = mode === 'results' ? copy.boardResults : copy.boardGame;
  const entries = board?.entries ?? [];
  const fonts = useMemo(
    () => ({ bold: fontBold, semi: fontSemi, medium: fontMedium, regular: fontRegular }),
    [fontBold, fontMedium, fontRegular, fontSemi],
  );
  const meId = board?.me?.userId;

  const renderItem = useCallback(
    ({ item }: { item: KingLeaderboardEntry }) => (
      <KingBoardRow
        entry={item}
        mine={meId != null && item.userId === meId}
        youLabel={copy.you}
        xpLabel={copy.xp}
        fonts={fonts}
      />
    ),
    [copy.xp, copy.you, fonts, meId],
  );

  const header = (
    <View>
      <View style={styles.heading}>
        <KingOrnament icon={mode === 'results' ? KING_ICON.trophy : KING_ICON.crown} />
        <Text style={[styles.title, { fontFamily: fontBold }]}>{title}</Text>
      </View>
      <View style={styles.body}>
        <KingPeriodTabs
          period={period}
          allLabel={copy.allTime}
          weekLabel={copy.thisWeek}
          onChange={setPeriod}
        />
        <View style={styles.list} />
      </View>
    </View>
  );

  const empty = loading ? (
    <ActivityIndicator color={KING_PURPLE} style={{ marginTop: 32 }} />
  ) : (
    <KingEmptyState
      title={copy.emptyTitle}
      actionLabel={copy.predictNow}
      style={styles.empty}
      onAction={() => {
        if (router.canGoBack()) router.back();
        else router.push({ pathname: '/king-of-predictions/week', params: { mode } } as never);
      }}
    />
  );

  return (
    <View style={styles.root}>
      <KingHeader />
      <FlashList
        style={{ flex: 1 }}
        data={loading ? [] : entries}
        keyExtractor={(item) => item.userId}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={BoardGap}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function BoardGap() {
  return <View style={{ height: 8 }} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KING_BG },
  heading: { alignItems: 'center', gap: 8, marginTop: 20 },
  title: { color: '#fff', fontSize: 28, textAlign: 'center' },
  body: { marginTop: 42, marginHorizontal: 22 },
  list: { marginTop: 19 },
  empty: { marginTop: 120 },
});
