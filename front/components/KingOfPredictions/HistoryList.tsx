import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PWGradientText } from '../predictAndWin/GradientText';
import {
  PredictionsService,
  type KingHistoryItem,
  type KingHistoryStatus,
} from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { GlassSurface, type GlassTone } from './GlassSurface';
import { KING_PURPLE, toApiMode, type KingRouteMode } from './shared';

const SIDE = 22;
const CARD_BG = ['#0C051A', '#07040D'] as const;
const VS_GRADIENT = ['#A855F7', '#633291'] as const;
const FILTERS: KingHistoryStatus[] = ['all', 'correct', 'wrong', 'pending'];

type Verdict = 'correct' | 'wrong' | 'pending';

const VERDICT_LOOK: Record<
  Verdict,
  { tone: GlassTone; icon: React.ComponentProps<typeof Ionicons>['name']; text: string }
> = {
  pending: { tone: 'yellow', icon: 'time', text: '#FEF3C7' },
  correct: { tone: 'green', icon: 'checkmark-circle', text: '#DCFCE7' },
  wrong: { tone: 'red', icon: 'close-circle', text: '#FEE2E2' },
};

function verdictOf(item: KingHistoryItem): Verdict {
  if (item.isCorrect === true) return 'correct';
  if (item.isCorrect === false) return 'wrong';
  return 'pending';
}

function shortDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return date.getFullYear() === new Date().getFullYear()
    ? `${dd}/${mm}`
    : `${dd}/${mm}/${date.getFullYear()}`;
}

export function KingHistoryList({ mode, bottomPadding }: { mode: KingRouteMode; bottomPadding: number }) {
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { t } = useTranslation();
  const copy = t.kingPredictions;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);

  const [status, setStatus] = useState<KingHistoryStatus>('all');
  const [items, setItems] = useState<KingHistoryItem[]>([]);
  const [counts, setCounts] = useState<Record<KingHistoryStatus, number> | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (nextPage: number) => {
      const token = await getTokenRef.current().catch(() => null);
      if (!token) return null;
      return PredictionsService.getKingHistory(token, toApiMode(mode), status, nextPage);
    },
    [mode, status],
  );

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const data = await fetchPage(0);
      if (id !== requestId.current) return;
      setItems(data?.items ?? []);
      setCounts(data?.counts ?? null);
      setHasMore(data?.hasMore ?? false);
      setPage(0);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const data = await fetchPage(page + 1);
      if (!data || id !== requestId.current) return;
      setItems((prev) => [...prev, ...data.items]);
      setCounts(data.counts);
      setHasMore(data.hasMore);
      setPage(page + 1);
    } catch {
      // A failed next page leaves the list as it is; scrolling again retries.
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, page]);

  const filterLabel: Record<KingHistoryStatus, string> = {
    all: copy.filterAll,
    correct: copy.filterCorrect,
    wrong: copy.filterWrong,
    pending: copy.filterPending,
  };

  const pickLabel = (item: KingHistoryItem): string => {
    if (mode === 'results' && item.predictedHomeScore != null && item.predictedAwayScore != null) {
      return `${item.predictedAwayScore} - ${item.predictedHomeScore}`;
    }
    if (item.predictionType === 'home') return item.homeTeam ?? copy.homeWin;
    if (item.predictionType === 'away') return item.awayTeam ?? copy.awayWin;
    return copy.draw;
  };

  const renderItem = ({ item }: { item: KingHistoryItem }) => {
    const verdict = verdictOf(item);
    const look = VERDICT_LOOK[verdict];
    const hasScore = item.finalHomeScore != null && item.finalAwayScore != null;
    return (
      <LinearGradient colors={CARD_BG} style={styles.card}>
        <HistoryTeam name={item.awayTeam ?? ''} logo={item.awayTeamLogo} font={fontBold} />
        <View style={styles.cardMid}>
          {hasScore ? (
            <Text style={[styles.score, { fontFamily: fontBold }]}>
              {`${item.finalAwayScore} - ${item.finalHomeScore}`}
            </Text>
          ) : (
            <PWGradientText colors={VS_GRADIENT} style={[styles.vs, { fontFamily: fontSemi }]}>
              {copy.vs}
            </PWGradientText>
          )}
          <Text style={[styles.date, { fontFamily: fontMedium }]}>{shortDate(item.matchDate)}</Text>
          <Text style={[styles.pickCaption, { fontFamily: fontMedium }]}>{copy.yourPick}</Text>
          <GlassSurface radius={12} tone={look.tone} style={styles.badge}>
            <Ionicons name={look.icon} size={13} color={look.text} />
            <Text
              style={[styles.badgeText, { color: look.text, fontFamily: fontBold }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {pickLabel(item)}
            </Text>
          </GlassSurface>
        </View>
        <HistoryTeam name={item.homeTeam ?? ''} logo={item.homeTeamLogo} font={fontBold} />
      </LinearGradient>
    );
  };

  const empty = loading ? (
    <ActivityIndicator color={KING_PURPLE} style={styles.center} />
  ) : error ? (
    <Pressable onPress={() => { void reload(); }} style={styles.center}>
      <Text style={[styles.muted, { fontFamily: fontMedium }]}>{copy.loadError}</Text>
      <Text style={[styles.retry, { fontFamily: fontSemi }]}>{copy.retry}</Text>
    </Pressable>
  ) : (
    <Text style={[styles.muted, styles.center, { fontFamily: fontMedium }]}>
      {isSignedIn ? copy.historyEmpty : copy.historySignIn}
    </Text>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filtersBar}
      >
        {FILTERS.map((key) => {
          const active = key === status;
          const count = counts?.[key];
          return (
            <Pressable
              key={key}
              onPress={() => setStatus(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              {active ? (
                <LinearGradient colors={['#8B5CF6', '#513690']} style={[styles.chip, styles.chipOn]}>
                  <Text style={[styles.chipText, styles.chipTextOn, { fontFamily: fontSemi }]}>
                    {filterLabel[key]}
                    {count != null ? ` ${count}` : ''}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={[styles.chip, styles.chipIdle]}>
                  <Text style={[styles.chipText, { fontFamily: fontMedium }]}>
                    {filterLabel[key]}
                    {count != null ? ` ${count}` : ''}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={loading ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={empty}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={KING_PURPLE} style={styles.footer} /> : null}
        onEndReached={() => { void loadMore(); }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function HistoryTeam({ name, logo, font }: { name: string; logo: string | null; font: string }) {
  const single = !/\s/.test(name.trim());
  return (
    <View style={styles.team}>
      {logo ? <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" /> : <View style={styles.logo} />}
      <Text
        style={[styles.teamName, { fontFamily: font }]}
        numberOfLines={single ? 1 : 2}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { marginTop: 48, alignItems: 'center' },
  muted: { color: '#A1A1AA', fontSize: 15, textAlign: 'center' },
  retry: { color: KING_PURPLE, marginTop: 8, fontSize: 15 },
  filtersBar: { flexGrow: 0 },
  filters: { paddingHorizontal: SIDE, paddingVertical: 10, gap: 8 },
  chip: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: { borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)', backgroundColor: 'rgba(22,8,46,0.6)' },
  chipOn: { borderWidth: 1, borderColor: '#B79BFF' },
  chipText: { color: '#A1A1AA', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  list: { paddingHorizontal: SIDE, paddingTop: 4, gap: 12 },
  footer: { marginVertical: 16 },
  card: {
    minHeight: 132,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#6D33F2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  team: { flex: 1, minWidth: 0, alignItems: 'center', gap: 9 },
  logo: { width: 43, height: 43 },
  teamName: { color: '#fff', fontSize: 13, textAlign: 'center' },
  cardMid: { width: '34%', maxWidth: 124, minWidth: 96, alignItems: 'stretch' },
  vs: { fontSize: 21, textAlign: 'center', alignSelf: 'center' },
  score: { color: '#fff', fontSize: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  date: { color: '#777', fontSize: 12, textAlign: 'center', marginTop: 2 },
  pickCaption: { color: '#9C9AA5', fontSize: 11, textAlign: 'center', marginTop: 6 },
  badge: {
    marginTop: 4,
    height: 32,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  badgeText: { flexShrink: 1, fontSize: 13 },
});
