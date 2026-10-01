import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';

import { PredictionsService, type KingLeaderboard, type KingPeriod } from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KingBoardList } from './KingBoardList';
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
  const fontSemi = useAppFont(600);

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

  return (
    <View style={styles.root}>
      <KingHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { fontFamily: fontBold }]}>{title}</Text>
        <View style={styles.periodRow}>
          <Pressable onPress={() => setPeriod('all')} style={[styles.period, period === 'all' && styles.periodOn]}>
            <Text style={[styles.periodText, { fontFamily: fontSemi }]}>{copy.allTime}</Text>
          </Pressable>
          <Pressable onPress={() => setPeriod('week')} style={[styles.period, period === 'week' && styles.periodOn]}>
            <Text style={[styles.periodText, { fontFamily: fontSemi }]}>{copy.thisWeek}</Text>
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator color={KING_PURPLE} style={{ marginTop: 32 }} />
        ) : (
          <KingBoardList
            entries={board?.entries ?? []}
            meId={board?.me?.userId}
            youLabel={copy.you}
            xpLabel={copy.xp}
            emptyTitle={copy.emptyTitle}
            emptyActionLabel={copy.predictNow}
            onEmptyAction={() => {
              if (router.canGoBack()) router.back();
              else router.push({ pathname: '/king-of-predictions/week', params: { mode } } as never);
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KING_BG },
  title: { color: '#fff', fontSize: 26, textAlign: 'center', marginTop: 12, marginBottom: 16 },
  periodRow: {
    flexDirection: 'row',
    marginHorizontal: 22,
    backgroundColor: '#241433',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  period: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  periodOn: { backgroundColor: KING_PURPLE },
  periodText: { color: '#fff', fontSize: 14 },
});
