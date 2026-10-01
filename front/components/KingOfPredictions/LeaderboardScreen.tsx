import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';

import { PredictionsService, type KingLeaderboard, type KingPeriod } from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ICON } from './assets';
import { KingBoardList, KingEmptyState, KingOrnament, KingPeriodTabs } from './KingBoardList';
import { KingHeader } from './KingHeader';
import { KING_BG, KING_PURPLE, parseKingMode, toApiMode } from './shared';

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

  const [period, setPeriod] = useState<KingPeriod>('week');
  const [board, setBoard] = useState<KingLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = await getTokenRef.current().catch(() => null);
    if (!token) {
      setBoard(null);
      return;
    }
    const data = await PredictionsService.getKingLeaderboard(token, toApiMode(mode), period).catch(() => null);
    setBoard(data);
  }, [mode, period]);

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

  return (
    <View style={styles.root}>
      <KingHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        showsVerticalScrollIndicator={false}
      >
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
          {loading ? (
            <ActivityIndicator color={KING_PURPLE} style={{ marginTop: 32 }} />
          ) : entries.length === 0 ? (
            <KingEmptyState
              title={copy.emptyTitle}
              actionLabel={copy.predictNow}
              style={styles.empty}
              onAction={() => {
                if (router.canGoBack()) router.back();
                else router.push({ pathname: '/king-of-predictions/week', params: { mode } } as never);
              }}
            />
          ) : (
            <View style={styles.list}>
              <KingBoardList entries={entries} meId={board?.me?.userId} youLabel={copy.you} xpLabel={copy.xp} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KING_BG },
  heading: { alignItems: 'center', gap: 8, marginTop: 20 },
  title: { color: '#fff', fontSize: 28, textAlign: 'center' },
  body: { marginTop: 42, marginHorizontal: 22 },
  list: { marginTop: 19 },
  empty: { marginTop: 120 },
});
