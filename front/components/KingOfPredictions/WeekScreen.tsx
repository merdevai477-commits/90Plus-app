import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronLeft, Crown, Trophy } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';

import { fetchMatchesByDate } from '../Matches/leagueApiUtils';
import {
  PredictionsService,
  type KingLeaderboard,
  type KingPeriod,
} from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KingBoardList } from './KingBoardList';
import { KingHeader } from './KingHeader';
import {
  KING_BG,
  KING_CARD,
  KING_LEAGUE_IDS,
  KING_PURPLE,
  currentWeekDays,
  fillTemplate,
  kingLeagueLogos,
  localDateKey,
  parseKingMode,
  toApiMode,
} from './shared';

function previewEntries(board: KingLeaderboard | null) {
  const entries = board?.entries ?? [];
  const top = entries.slice(0, 5);
  const meId = board?.me?.userId;
  if (!meId || top.some((row) => row.userId === meId)) return top;
  const mine = entries.find((row) => row.userId === meId);
  return mine ? [...top.slice(0, 4), mine] : top;
}

export function KingWeekScreen({ mode: modeParam }: { mode: string | string[] | undefined }) {
  const mode = parseKingMode(Array.isArray(modeParam) ? modeParam[0] : modeParam);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { t } = useTranslation();
  const copy = t.kingPredictions;
  const fontExtra = useAppFont(800);
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);

  const days = useMemo(() => currentWeekDays(), []);
  const todayKey = localDateKey(new Date());
  const initialIndex = Math.max(0, days.findIndex((day) => localDateKey(day) === todayKey));
  const [dayIndex, setDayIndex] = useState(initialIndex === -1 ? 0 : initialIndex);
  const [matchCount, setMatchCount] = useState(0);
  const [predictedIds, setPredictedIds] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<KingPeriod>('week');
  const [board, setBoard] = useState<KingLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const selectedKey = localDateKey(days[dayIndex] ?? days[0]);
  const logos = useMemo(() => kingLeagueLogos(), []);
  const visibleLogos = logos.slice(0, 8);
  const overflow = Math.max(0, logos.length - visibleLogos.length);

  const load = useCallback(async () => {
    const [matches, token] = await Promise.all([
      fetchMatchesByDate(days[dayIndex] ?? new Date()).catch(() => []),
      getToken().catch(() => null),
    ]);
    const leagueSet = new Set<number>(KING_LEAGUE_IDS);
    const dayMatches = matches
      .filter((match) => leagueSet.has(match.league?.id))
      .slice(0, 10);
    setMatchCount(dayMatches.length);

    if (!token) {
      setPredictedIds(new Set());
      setBoard(null);
      return;
    }

    const [preds, leaderboard] = await Promise.all([
      PredictionsService.getUserPredictions(token).catch(() => null),
      PredictionsService.getKingLeaderboard(token, toApiMode(mode), period).catch(() => null),
    ]);
    const ids = new Set<string>();
    const map = preds?.predictionsMap ?? {};
    for (const match of dayMatches) {
      const row = map[match.id] ?? map[String(match.id)];
      if (!row) continue;
      const scores = row as { predictedHomeScore?: number | null; predictedAwayScore?: number | null };
      const isExact = scores.predictedHomeScore != null && scores.predictedAwayScore != null;
      if (mode === 'results' ? isExact : !isExact) ids.add(String(match.id));
    }
    setPredictedIds(ids);
    setBoard(leaderboard);
  }, [dayIndex, days, getToken, mode, period]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const started = predictedIds.size > 0;
  const cta = started ? copy.continueChallenge : copy.startChallenge;
  const openPlay = () => {
    router.push({
      pathname: '/king-of-predictions/play',
      params: { mode, date: selectedKey },
    } as never);
  };

  const title = mode === 'results' ? copy.resultsTitle : copy.gameTitle;
  const sub = mode === 'results' ? copy.resultsSub : copy.gameSub;
  const boardTitle = mode === 'results' ? copy.boardResults : copy.boardGame;
  const dayName = copy.days[dayIndex] ?? '';
  const ordinal = copy.ordinals[dayIndex] ?? String(dayIndex + 1);

  return (
    <View style={styles.root}>
      <KingHeader />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={KING_PURPLE} />}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {mode === 'results' ? <Trophy size={16} color="#F6D36B" /> : <Crown size={16} color="#F6D36B" />}
          <Text style={[styles.heroTitle, { fontFamily: fontExtra }]}>{title}</Text>
          <Text style={[styles.heroSub, { fontFamily: fontMedium }]}>{sub}</Text>
        </View>

        <View style={styles.leagueCard}>
          <Text style={[styles.leagueTitle, { fontFamily: fontBold }]}>{copy.majorLeagues}</Text>
          <Text style={[styles.leagueSub, { fontFamily: fontMedium }]}>{copy.weekRange}</Text>
          <View style={styles.logoRow}>
            {overflow > 0 ? (
              <View style={styles.moreChip}>
                <Text style={[styles.moreText, { fontFamily: fontBold }]}>+{overflow}</Text>
              </View>
            ) : null}
            {visibleLogos.map((league) => (
              <Image key={league.id} source={{ uri: league.logo }} style={styles.logo} contentFit="contain" />
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
          {[...days].reverse().map((day) => {
            const index = days.findIndex((item) => localDateKey(item) === localDateKey(day));
            const selected = index === dayIndex;
            return (
              <Pressable
                key={localDateKey(day)}
                onPress={() => setDayIndex(index)}
                style={[styles.dayChip, selected && styles.dayChipOn]}
              >
                <Text style={[styles.dayName, selected && styles.dayNameOn, { fontFamily: fontMedium }]}>
                  {copy.days[index]}
                </Text>
                <Text style={[styles.dayNum, selected && styles.dayNameOn, { fontFamily: fontBold }]}>
                  {index + 1}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.prize}>
          <Text style={[styles.prizeTitle, { fontFamily: fontExtra }]}>{copy.prizeTitle}</Text>
          <Text style={[styles.prizeSub, { fontFamily: fontMedium }]}>{copy.prizeSub}</Text>
        </View>

        <View style={styles.challenge}>
          <Text style={[styles.challengeEyebrow, { fontFamily: fontMedium }]}>
            {fillTemplate(copy.dayLine, { day: dayName, index: ordinal })}
          </Text>
          <Text style={[styles.challengeCount, { fontFamily: fontExtra }]}>
            {fillTemplate(copy.matchCount, { count: loading ? '—' : matchCount })}
          </Text>
          <Pressable style={styles.challengeBtn} onPress={openPlay}>
            <ChevronLeft size={16} color="#fff" />
            <Text style={[styles.challengeBtnText, { fontFamily: fontSemi }]}>{cta}</Text>
          </Pressable>
        </View>

        <View style={styles.boardCard}>
          <Text style={[styles.boardTitle, { fontFamily: fontBold }]}>{boardTitle}</Text>
          <View style={styles.periodRow}>
            <PeriodChip
              label={copy.allTime}
              active={period === 'all'}
              font={fontSemi}
              onPress={() => setPeriod('all')}
            />
            <PeriodChip
              label={copy.thisWeek}
              active={period === 'week'}
              font={fontSemi}
              onPress={() => setPeriod('week')}
            />
          </View>
          {loading && !board ? (
            <ActivityIndicator color={KING_PURPLE} style={{ marginVertical: 24 }} />
          ) : (
            <KingBoardList
              entries={previewEntries(board)}
              meId={board?.me?.userId}
              youLabel={copy.you}
              xpLabel={copy.xp}
              emptyTitle={copy.emptyTitle}
              emptyActionLabel={copy.predictNow}
              onEmptyAction={openPlay}
            />
          )}
          <Pressable
            style={styles.fullBtn}
            onPress={() => {
              router.push({ pathname: '/king-of-predictions/leaderboard', params: { mode } } as never);
            }}
          >
            <Text style={[styles.fullBtnText, { fontFamily: fontSemi }]}>{copy.viewFull}</Text>
            <ChevronLeft size={16} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={styles.footerBtn} onPress={openPlay}>
          <Text style={[styles.footerText, { fontFamily: fontBold }]}>{cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PeriodChip({
  label,
  active,
  font,
  onPress,
}: {
  label: string;
  active: boolean;
  font: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.period, active && styles.periodOn]}>
      <Text style={[styles.periodText, active && styles.periodTextOn, { fontFamily: font }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KING_BG },
  hero: { alignItems: 'center', paddingHorizontal: 24, marginTop: 8, marginBottom: 16 },
  heroTitle: { color: '#fff', fontSize: 32, marginTop: 6, textAlign: 'center' },
  heroSub: { color: '#BCBCBC', fontSize: 13, marginTop: 4, textAlign: 'center' },
  leagueCard: {
    marginHorizontal: 23,
    backgroundColor: KING_PURPLE,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  leagueTitle: { color: '#fff', fontSize: 22, textAlign: 'center' },
  leagueSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', marginTop: 4 },
  logoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  logo: { width: 26, height: 26 },
  moreChip: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  moreText: { color: '#fff', fontSize: 11 },
  dayRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 23,
    paddingVertical: 16,
  },
  dayChip: {
    width: 54,
    height: 69,
    borderRadius: 14,
    backgroundColor: '#1A1028',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipOn: { backgroundColor: KING_PURPLE },
  dayName: { color: '#A1A1AA', fontSize: 11 },
  dayNum: { color: '#fff', fontSize: 16, marginTop: 4 },
  dayNameOn: { color: '#fff' },
  prize: {
    marginHorizontal: 23,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#2A1458',
    marginBottom: 14,
  },
  prizeTitle: { color: '#fff', fontSize: 26, textAlign: 'right' },
  prizeSub: { color: '#D4D4D8', fontSize: 13, textAlign: 'right', marginTop: 4 },
  challenge: {
    marginHorizontal: 23,
    backgroundColor: KING_CARD,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  challengeEyebrow: { color: '#A1A1AA', fontSize: 12, textAlign: 'right' },
  challengeCount: { color: '#fff', fontSize: 26, textAlign: 'right', marginTop: 4 },
  challengeBtn: {
    alignSelf: 'flex-start',
    marginTop: 14,
    height: 37,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#3A2468',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  challengeBtnText: { color: '#fff', fontSize: 14 },
  boardCard: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#12081F',
    borderRadius: 22,
    paddingTop: 16,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
  },
  boardTitle: { color: '#fff', fontSize: 20, textAlign: 'center', marginBottom: 12 },
  periodRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#241433',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  period: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  periodOn: { backgroundColor: KING_PURPLE },
  periodText: { color: '#A1A1AA', fontSize: 14 },
  periodTextOn: { color: '#fff' },
  fullBtn: {
    margin: 12,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fullBtnText: { color: '#fff', fontSize: 15 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 23,
    paddingTop: 10,
    backgroundColor: 'rgba(3,3,3,0.92)',
  },
  footerBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: KING_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: { color: '#fff', fontSize: 18 },
});
