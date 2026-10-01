import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';

import {
  PredictionsService,
  type KingLeaderboard,
  type KingPeriod,
} from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ART, KING_ICON, KING_LEAGUE_BADGES } from './assets';
import {
  KING_BUTTON_GRADIENT,
  KING_PASSED_GRADIENT,
  KingBoardList,
  KingEmptyState,
  KingOrnament,
  KingPeriodTabs,
} from './KingBoardList';
import { GlassSurface } from './GlassSurface';
import { KingHeader } from './KingHeader';
import {
  KING_BG,
  KING_PURPLE,
  currentWeekDays,
  fetchKingMatches,
  fillTemplate,
  localDateKey,
  parseKingMode,
  toApiMode,
} from './shared';

const SIDE = 22;
const PRIZE_W = 404;
const PRIZE_H = 161;

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
  const { width: screenW } = useWindowDimensions();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { t } = useTranslation();
  const copy = t.kingPredictions;
  const fontExtra = useAppFont(800);
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const fontRegular = useAppFont(400);

  const days = useMemo(() => currentWeekDays(), []);
  const todayKey = localDateKey(new Date());
  const initialIndex = Math.max(0, days.findIndex((day) => localDateKey(day) === todayKey));
  const [dayIndex, setDayIndex] = useState(initialIndex);
  const [matchCount, setMatchCount] = useState(0);
  const [predictedIds, setPredictedIds] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<KingPeriod>('week');
  const [board, setBoard] = useState<KingLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const selectedKey = localDateKey(days[dayIndex] ?? days[0]);

  const load = useCallback(async () => {
    const [dayMatches, token] = await Promise.all([
      fetchKingMatches(selectedKey).catch(() => []),
      getTokenRef.current().catch(() => null),
    ]);
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
  }, [mode, period, selectedKey]);

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
  const dayPassed = dayIndex < initialIndex;
  const cta = dayPassed ? copy.viewDay : started ? copy.continueChallenge : copy.startChallenge;
  const openPlay = () => {
    router.push({
      pathname: '/king-of-predictions/play',
      params: { mode, date: selectedKey },
    } as never);
  };
  const openBoard = () => {
    router.push({ pathname: '/king-of-predictions/leaderboard', params: { mode } } as never);
  };

  const isResults = mode === 'results';
  const titleLead = isResults ? copy.resultsTitleLead : copy.gameTitleLead;
  const titleAccent = isResults ? copy.resultsTitleAccent : copy.gameTitleAccent;
  const sub = isResults ? copy.resultsSub : copy.gameSub;
  const boardTitle = isResults ? copy.boardResults : copy.boardGame;
  const dayName = copy.days[dayIndex] ?? '';
  const ordinal = copy.ordinals[dayIndex] ?? String(dayIndex + 1);
  const myRank = board?.me?.rank ?? null;
  const rankLabel = myRank == null ? '—' : (copy.ordinals[myRank - 1] ?? String(myRank));
  const myXp = board?.me?.xp ?? 0;
  const preview = previewEntries(board);

  const prizeScale = (screenW - SIDE * 2) / PRIZE_W;
  const s = (value: number) => value * prizeScale;

  return (
    <View style={styles.root}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={KING_PURPLE} />}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 150 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.stadium, { height: 309 + Math.max(0, insets.top - 47) }]} pointerEvents="none">
          <Image source={KING_ART.stadium} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={['rgba(20,3,52,0)', 'rgba(20,3,52,0.92)']}
            locations={[0.19, 0.6]}
            start={{ x: 1, y: 0.1 }}
            end={{ x: 0, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient colors={['rgba(3,3,3,0)', 'rgba(3,3,3,0.84)']} style={StyleSheet.absoluteFill} />
          <View style={styles.confetti}>
            <Image source={KING_ART.confetti} style={styles.confettiImage} contentFit="fill" />
            <LinearGradient colors={['rgba(3,3,3,0)', '#030303']} style={StyleSheet.absoluteFill} />
          </View>
        </View>

        <KingHeader />

        <View style={styles.hero}>
          <KingOrnament icon={isResults ? KING_ICON.trophy : KING_ICON.crown} lineWidth={35} size={14} />
          <Text style={[styles.heroTitle, { fontFamily: fontExtra }]}>
            <Text style={styles.heroLead}>{titleLead}</Text>
            {' '}
            <Text style={styles.heroAccent}>{titleAccent}</Text>
          </Text>
          <Text style={[styles.heroSub, { fontFamily: fontMedium }]}>{sub}</Text>
        </View>

        <LinearGradient colors={KING_BUTTON_GRADIENT} style={styles.leagueCard}>
          <Text style={[styles.leagueTitle, { fontFamily: fontBold }]}>{copy.majorLeagues}</Text>
          <Text style={[styles.leagueSub, { fontFamily: fontMedium }]}>{copy.weekRange}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { zIndex: KING_LEAGUE_BADGES.length + 1 }]}>
              <Text style={[styles.badgeMore, { fontFamily: fontBold }]}>+4</Text>
            </View>
            {[...KING_LEAGUE_BADGES].reverse().map((badge, index) => (
              <View
                key={badge.key}
                style={[
                  styles.badge,
                  styles.badgeOverlap,
                  { zIndex: KING_LEAGUE_BADGES.length - index },
                  'cover' in badge && styles.badgeCover,
                ]}
              >
                <Image
                  source={badge.source}
                  style={'cover' in badge ? StyleSheet.absoluteFill : { width: badge.width, height: badge.height }}
                  contentFit={'cover' in badge ? 'cover' : 'contain'}
                />
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.dayRow}>
          {[...days].reverse().map((day) => {
            const index = days.findIndex((item) => localDateKey(item) === localDateKey(day));
            const selected = index === dayIndex;
            const past = !selected && index < initialIndex;
            const dayFont = selected ? fontBold : past ? fontMedium : fontRegular;
            const tone = selected ? styles.dayOn : past && styles.dayPast;
            const label = (
              <>
                <Text
                  style={[styles.dayName, { fontFamily: dayFont }, tone]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {copy.days[index]}
                </Text>
                <Text style={[styles.dayNum, { fontFamily: dayFont }, tone]}>{index + 1}</Text>
              </>
            );
            return (
              <Pressable key={localDateKey(day)} onPress={() => setDayIndex(index)} style={styles.dayCell}>
                <GlassSurface radius={8} tone={selected ? 'purple' : past ? 'muted' : 'neutral'} style={styles.dayChip}>
                  {label}
                </GlassSurface>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.prize, { height: s(PRIZE_H), borderRadius: s(20) }]}>
          <Image
            source={KING_ART.prizeBg}
            style={{ position: 'absolute', left: 0, right: 0, top: s(-85.4), height: s(303.3) }}
            contentFit="fill"
          />
          <LinearGradient
            colors={['rgba(20,3,52,0)', 'rgba(20,3,52,0.9)']}
            locations={[0.19, 0.6]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image
            source={KING_ART.confettiPrize}
            style={{ position: 'absolute', left: 0, right: 0, top: s(-33), height: s(227), opacity: 0.26 }}
            contentFit="fill"
          />
          <Image
            source={KING_ART.prizeGlow1}
            style={{ position: 'absolute', left: s(222), top: s(-23), width: s(213), height: s(217) }}
            contentFit="fill"
          />
          <Image
            source={KING_ART.prizeGlow2}
            style={{ position: 'absolute', right: 0, top: 0, width: s(276), height: s(161) }}
            contentFit="fill"
          />
          <Image
            source={KING_ART.shirtShadow}
            style={{ position: 'absolute', left: s(252), top: s(130), width: s(76), height: s(23) }}
            contentFit="fill"
          />
          <Image
            source={KING_ART.shirtShadow}
            style={{ position: 'absolute', left: s(303), top: s(124), width: s(78), height: s(23) }}
            contentFit="fill"
          />
          <Image
            source={KING_ART.shirt1}
            style={{ position: 'absolute', left: s(274), top: s(9), width: s(139), height: s(139) }}
            contentFit="cover"
          />
          <Image
            source={KING_ART.shirt2}
            style={{ position: 'absolute', left: s(228), top: s(27), width: s(127), height: s(126) }}
            contentFit="cover"
          />
          <View style={{ position: 'absolute', left: s(22), top: s(27), width: s(195), gap: s(17) }}>
            <View style={{ gap: s(2) }}>
              <Text
                style={[styles.prizeTitle, { fontFamily: fontBold, fontSize: s(36) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {copy.prizeTitle}
              </Text>
              <Text style={[styles.prizeSub, { fontFamily: fontMedium, fontSize: s(11) }]} numberOfLines={1} adjustsFontSizeToFit>
                {copy.prizeSub}
              </Text>
            </View>
            <View style={[styles.statRow, { gap: s(4) }]}>
              <LinearGradient
                colors={['rgba(139,92,246,0.2)', 'rgba(81,54,144,0.2)']}
                style={[styles.stat, { height: s(34), borderRadius: s(7), gap: s(6), paddingHorizontal: s(6) }]}
              >
                <View style={styles.statText}>
                  <Text style={[styles.statLabel, { fontFamily: fontRegular, fontSize: s(7) }]}>{copy.yourRank}</Text>
                  <Text style={[styles.statValue, { fontFamily: fontBold, fontSize: s(14) }]} numberOfLines={1}>
                    {rankLabel}
                  </Text>
                </View>
                <Image source={KING_ICON.ranking} style={{ width: s(24), height: s(24) }} contentFit="contain" />
              </LinearGradient>
              <LinearGradient
                colors={['rgba(139,92,246,0.2)', 'rgba(81,54,144,0.2)']}
                style={[styles.stat, { height: s(34), borderRadius: s(7), gap: s(6), paddingHorizontal: s(6) }]}
              >
                <View style={[styles.statText, { flex: 1 }]}>
                  <Text style={[styles.statLabel, { fontFamily: fontRegular, fontSize: s(7) }]}>{copy.yourPoints}</Text>
                  <Text style={[styles.statValue, { fontFamily: fontBold, fontSize: s(14) }]} numberOfLines={1}>
                    {myXp}
                  </Text>
                </View>
                <Image source={KING_ICON.energy} style={{ width: s(24), height: s(24) }} contentFit="contain" />
              </LinearGradient>
            </View>
          </View>
        </View>

        <LinearGradient colors={['rgba(45,25,85,0.5)', 'rgba(20,12,35,0.5)']} style={styles.challenge}>
          <View style={styles.challengeCopy}>
            <Text style={[styles.challengeEyebrow, { fontFamily: fontMedium }]}>
              {fillTemplate(copy.dayLine, { day: dayName, index: ordinal })}
            </Text>
            <Text style={styles.challengeLine}>
              <Text style={[styles.challengeCount, { fontFamily: fontBold }]}>{loading ? '—' : matchCount}</Text>
              <Text style={[styles.challengeLabel, { fontFamily: fontSemi }]}>{` ${copy.matchCountLabel}`}</Text>
            </Text>
          </View>
          <Pressable onPress={openPlay} style={styles.challengeBtnWrap}>
            <GlassSurface radius={36} tone={dayPassed ? 'muted' : 'purple'} style={styles.challengeBtn}>
              <Text
                style={[styles.challengeBtnText, dayPassed && styles.passedText, { fontFamily: fontSemi }]}
                numberOfLines={1}
              >
                {cta}
              </Text>
              <Image
                source={KING_ICON.arrowLeft}
                style={[styles.arrowIcon, dayPassed && styles.passedIcon]}
                contentFit="contain"
              />
            </GlassSurface>
          </Pressable>
        </LinearGradient>

        <View style={styles.boardCard}>
          <View style={styles.boardHead}>
            <Text style={[styles.boardTitle, { fontFamily: fontBold }]} numberOfLines={1} adjustsFontSizeToFit>
              {boardTitle}
            </Text>
            <Image
              source={isResults ? KING_ICON.trophyBoard : KING_ICON.crown}
              style={styles.boardIcon}
              contentFit="contain"
            />
          </View>
          <KingPeriodTabs period={period} allLabel={copy.allTime} weekLabel={copy.thisWeek} onChange={setPeriod} />
          <View style={styles.boardBody}>
            {loading && !board ? (
              <ActivityIndicator color={KING_PURPLE} style={{ marginVertical: 24 }} />
            ) : preview.length === 0 ? (
              <KingEmptyState title={copy.emptyTitle} actionLabel={copy.predictNow} onAction={openPlay} scale={0.62} />
            ) : (
              <KingBoardList entries={preview} meId={board?.me?.userId} youLabel={copy.you} xpLabel={copy.xp} preview />
            )}
          </View>
          <Pressable style={styles.fullBtn} onPress={openBoard}>
            <Text style={[styles.fullBtnText, { fontFamily: fontSemi }]}>{copy.viewFull}</Text>
            <Image source={KING_ICON.chevron} style={styles.chevron} contentFit="contain" />
          </Pressable>
        </View>
      </ScrollView>

      <LinearGradient
        colors={['rgba(18,5,48,0)', '#180544']}
        pointerEvents="box-none"
        style={[styles.footer, { height: 130 + Math.max(insets.bottom, 12), paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
      >
        <Pressable onPress={openPlay}>
          <LinearGradient colors={dayPassed ? KING_PASSED_GRADIENT : KING_BUTTON_GRADIENT} style={styles.footerBtn}>
            <Text style={[styles.footerText, dayPassed && styles.passedText, { fontFamily: fontSemi }]}>{cta}</Text>
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KING_BG },
  stadium: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 356,
    opacity: 0.26,
    overflow: 'hidden',
  },
  confettiImage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -73,
    height: 502,
  },
  hero: { alignItems: 'center', gap: 4, marginTop: 28, paddingHorizontal: 24 },
  heroTitle: { fontSize: 36, textAlign: 'center' },
  heroLead: { color: '#F2F2F2' },
  heroAccent: { color: KING_PURPLE },
  heroSub: { color: '#BCBCBC', fontSize: 14, textAlign: 'center', marginTop: 4 },
  leagueCard: {
    marginTop: 38,
    marginHorizontal: SIDE,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 23,
    alignItems: 'flex-end',
  },
  leagueTitle: { color: '#fff', fontSize: 26, textAlign: 'right', alignSelf: 'stretch' },
  leagueSub: { color: '#B2B2B2', fontSize: 16, textAlign: 'right', alignSelf: 'stretch', marginTop: 9 },
  badgeRow: { flexDirection: 'row', marginTop: 12 },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#6A42C4',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeOverlap: { marginLeft: -7 },
  badgeCover: { backgroundColor: '#23272A' },
  badgeMore: { color: '#5712F3', fontSize: 17 },
  dayRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 24,
    marginHorizontal: SIDE,
  },
  dayCell: { flex: 1 },
  dayChip: {
    height: 69,
    paddingVertical: 14,
    paddingHorizontal: 2,
    alignItems: 'center',
    gap: 10,
  },
  dayName: { color: '#C2C2C2', fontSize: 13, textAlign: 'center' },
  dayNum: { color: '#C2C2C2', fontSize: 12, textAlign: 'center' },
  dayOn: { color: '#fff' },
  dayPast: { color: '#494949' },
  prize: {
    marginTop: 24,
    marginHorizontal: SIDE,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(27,15,57,0.49)',
  },
  prizeTitle: { color: '#9A73F4', textAlign: 'right' },
  prizeSub: { color: '#BCBCBC', textAlign: 'right' },
  statRow: { flexDirection: 'row' },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  statText: { alignItems: 'flex-end' },
  statLabel: { color: '#fff', textAlign: 'right' },
  statValue: { color: '#fff', textAlign: 'right' },
  challenge: {
    marginTop: 24,
    marginHorizontal: SIDE,
    height: 152,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#100C18',
    paddingHorizontal: 20,
    justifyContent: 'center',
    gap: 21,
  },
  challengeCopy: { alignItems: 'flex-end', gap: 2 },
  challengeEyebrow: { color: '#927EBF', fontSize: 12, textAlign: 'right' },
  challengeLine: { textAlign: 'right' },
  challengeCount: { color: KING_PURPLE, fontSize: 32 },
  challengeLabel: { color: '#fff', fontSize: 22 },
  challengeBtnWrap: { alignSelf: 'flex-start' },
  challengeBtn: {
    height: 37,
    minWidth: 122,
    paddingHorizontal: 12,
    borderRadius: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  arrowIcon: { width: 16, height: 16 },
  challengeBtnText: { color: '#fff', fontSize: 14 },
  passedText: { color: '#8A8794' },
  passedIcon: { opacity: 0.5 },
  boardCard: {
    marginTop: 24,
    marginHorizontal: SIDE,
    backgroundColor: '#080613',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(223,192,252,0.11)',
    paddingHorizontal: 19,
    paddingVertical: 29,
  },
  boardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 25,
  },
  boardTitle: { flex: 1, color: '#fff', fontSize: 28, textAlign: 'right' },
  boardIcon: { width: 34, height: 34 },
  boardBody: { marginTop: 19 },
  fullBtn: {
    marginTop: 18,
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(24,14,48,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  fullBtnText: { color: '#fff', fontSize: 14 },
  chevron: { width: 24, height: 24 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: SIDE,
  },
  footerBtn: {
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: { color: '#fff', fontSize: 19 },
});
