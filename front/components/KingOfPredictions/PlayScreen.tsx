import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  I18nManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';

import type { Match, TeamInfo } from '../Matches/matchCardUtils';
import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import { PredictionApiError, PredictionsService } from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { getTeamDisplayName } from '../../utils/i18nHelpers';
import { KING_ART } from './assets';
import { kingCardButton, matchHasStarted } from './kingMatchButton';
import {
  isDefiniteRejection,
  kingPickKey,
  settleUncertainSave,
  useBindKingPicksUser,
  useKingPicksStore,
  type KingApiMode,
  type KingPick,
} from './kingPicksStore';
import { PlayMatchCard, type CardPhase, type CardPick } from './PlayMatchCard';
import { getKingPlayTheme } from './playTheme';
import {
  cairoTodayKey,
  fetchKingMatches,
  parseKingMode,
  type KingRouteMode,
} from './shared';
import { KingToast, type KingToastState } from './KingToast';

const SIDE = 20;
const NAV_HEIGHT = 51;
const DAILY_LIMIT = 10;

function started(match: Match, now = Date.now()): boolean {
  const kickoff = match.fixtureDate ? new Date(match.fixtureDate).getTime() : null;
  return matchHasStarted(match.status, Number.isFinite(kickoff) ? kickoff : null, now);
}

function parseScore(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  return Math.min(20, Number.parseInt(digits, 10));
}

type ScoreDraft = { home: string; away: string };

export function KingPlayScreen({
  mode: modeParam,
  date,
}: {
  mode: string | string[] | undefined;
  date?: string | string[];
}) {
  const mode = parseKingMode(Array.isArray(modeParam) ? modeParam[0] : modeParam);
  const isGame = mode === 'game';
  const apiMode: KingApiMode = isGame ? 'winner' : 'exact';
  const dateKey = (Array.isArray(date) ? date[0] : date) || '';
  const [todayKey, setTodayKey] = useState(() => cairoTodayKey());
  const dayPassed = dateKey !== '' && dateKey < todayKey;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  useBindKingPicksUser();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { t, language } = useTranslation();
  const copy = t.kingPredictions;
  const teamName = useCallback((team: TeamInfo) => getTeamDisplayName(team.name, language), [language]);
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const fontRegular = useAppFont(400);
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getKingPlayTheme(isDark), [isDark]);

  const [matches, setMatches] = useState<Match[]>([]);
  const serverPicks = useKingPicksStore((state) => state.server);
  const localPicks = useKingPicksStore((state) => state.local);
  const saved = useMemo<Record<string, KingPick>>(
    () => ({ ...serverPicks, ...localPicks }),
    [serverPicks, localPicks],
  );
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, ScoreDraft>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<KingToastState | null>(null);
  const navBottom = Math.max(insets.bottom, 12) + 8;
  const listBottom = navBottom + NAV_HEIGHT + 72;

  const loadGenRef = useRef(0);
  const hasRows = useRef(false);

  useEffect(() => {
    hasRows.current = false;
    setMatches([]);
    setError(false);
    setLoading(true);
    setScoreDrafts({});
  }, [dateKey, apiMode]);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const { matches: dayMatches, calendar } = await fetchKingMatches(dateKey || cairoTodayKey());
    if (gen !== loadGenRef.current) return;
    if (calendar) setTodayKey(calendar.today);
    setMatches(dayMatches);
    setError(false);
    hasRows.current = true;

    const hasToken = !!(await getTokenRef.current().catch(() => null));
    if (gen !== loadGenRef.current || !hasToken) return;
    const ids = dayMatches.map((match) => match.id);
    const picks = await PredictionsService.getPredictionsForMatches(getTokenRef.current, ids, apiMode).catch(() => null);
    if (gen !== loadGenRef.current) return;
    if (picks) useKingPicksStore.getState().hydrate(picks, ids, apiMode);
  }, [apiMode, dateKey]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!hasRows.current) setLoading(true);
      void load()
        .catch(() => {
          if (active && !hasRows.current) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
        loadGenRef.current += 1;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch {
      if (!hasRows.current) setError(true);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [load]);

  const showError = useCallback((title: string) => setToast({ variant: 'error', title }), []);

  const explain = useCallback((err: unknown) => {
    const api = err instanceof PredictionApiError ? err : null;
    const reason = String(api?.details?.reason ?? '');
    if (api?.code === 'E006' || reason === 'DAILY_LIMIT_REACHED') {
      showError(copy.limit);
      return;
    }
    if (reason === 'MATCH_STARTED' || reason === 'ALREADY_RESOLVED') {
      showError(copy.started);
      return;
    }
    if (api?.code === 'E002') {
      showError(copy.signIn);
      return;
    }
    showError(copy.loadError);
  }, [copy, showError]);

  const pickFor = useCallback(
    (matchId: string | number) => saved[kingPickKey(apiMode, matchId)],
    [apiMode, saved],
  );

  const submitPick = useCallback(
    async (
      match: Match,
      predictionType: CardPick,
      home: number | null,
      away: number | null,
    ) => {
      if (!isSignedIn) {
        showError(copy.signIn);
        return;
      }
      const meta = {
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeTeamLogo: match.homeTeam.logo,
        awayTeamLogo: match.awayTeam.logo,
        matchDate: match.fixtureDate || new Date().toISOString(),
        leagueName: match.league?.name,
      };
      const picks = useKingPicksStore.getState();
      const matchId = String(match.id);
      const seq = picks.begin(
        matchId,
        { type: predictionType, home, away, correct: null },
        meta,
        apiMode,
      );

      try {
        await PredictionsService.submitPrediction(getTokenRef.current, {
          apiMatchId: match.id,
          predictionType,
          ...meta,
          predictedHomeScore: home ?? undefined,
          predictedAwayScore: away ?? undefined,
        });
        picks.confirm(matchId, seq, apiMode);
      } catch (err) {
        if (isDefiniteRejection(err)) {
          picks.revert(matchId, seq, apiMode);
          explain(err);
          return;
        }
        const outcome = await settleUncertainSave(getTokenRef.current, matchId, seq, apiMode);
        if (outcome !== 'confirmed') explain(err);
      }
    },
    [apiMode, copy.signIn, explain, isSignedIn, showError],
  );

  const onGamePick = useCallback(
    (match: Match, next: CardPick) => {
      if (started(match) || dayPassed) return;
      void submitPick(match, next, null, null);
    },
    [dayPassed, submitPick],
  );

  const setScore = useCallback((matchId: string, side: 'home' | 'away', value: string) => {
    setScoreDrafts((prev) => {
      const current = prev[matchId] ?? { home: '', away: '' };
      return { ...prev, [matchId]: { ...current, [side]: value } };
    });
  }, []);

  const scoreFor = useCallback(
    (match: Match): ScoreDraft => {
      const id = String(match.id);
      if (scoreDrafts[id]) return scoreDrafts[id];
      const prev = pickFor(match.id);
      return {
        home: prev?.home != null ? String(prev.home) : '',
        away: prev?.away != null ? String(prev.away) : '',
      };
    },
    [pickFor, scoreDrafts],
  );

  const completedCount = useMemo(() => {
    return matches.reduce((count, match) => {
      const prev = pickFor(match.id);
      if (!prev) return count;
      if (isGame) return prev.type ? count + 1 : count;
      return prev.home != null && prev.away != null ? count + 1 : count;
    }, 0);
  }, [isGame, matches, pickFor]);

  const confirmAll = useCallback(async () => {
    if (!isSignedIn) {
      showError(copy.signIn);
      return;
    }
    if (isGame) {
      setToast({
        variant: 'success',
        title: completedCount > 0 ? copy.saved : copy.predictNow,
      });
      return;
    }

    const pending = matches.filter((match) => {
      if (started(match) || dayPassed) return false;
      const draft = scoreFor(match);
      const home = parseScore(draft.home);
      const away = parseScore(draft.away);
      if (home == null || away == null) return false;
      const prev = pickFor(match.id);
      return !prev || prev.home !== home || prev.away !== away;
    });

    if (pending.length === 0) {
      setToast({
        variant: 'success',
        title: completedCount > 0 ? copy.saved : copy.predictNow,
      });
      return;
    }

    setSaving(true);
    try {
      for (const match of pending) {
        const draft = scoreFor(match);
        const home = parseScore(draft.home)!;
        const away = parseScore(draft.away)!;
        const type: CardPick = home > away ? 'home' : away > home ? 'away' : 'draw';
        await submitPick(match, type, home, away);
      }
      setToast({ variant: 'success', title: copy.saved });
    } finally {
      setSaving(false);
    }
  }, [
    completedCount,
    copy.predictNow,
    copy.saved,
    copy.signIn,
    dayPassed,
    isGame,
    isSignedIn,
    matches,
    pickFor,
    scoreFor,
    showError,
    submitPick,
  ]);

  const phaseOf = useCallback(
    (match: Match): CardPhase => {
      const prev = pickFor(match.id);
      const hasPick = isGame
        ? !!prev?.type
        : prev?.home != null && prev?.away != null;
      const isStarted = started(match) || dayPassed;
      const live = match.status === 'live';
      const finished = match.status === 'finished' || (dayPassed && !live);

      if (hasPick && prev) {
        if (prev.correct === true) return 'correct';
        if (prev.correct === false) return 'wrong';
        if (isStarted || live) return 'waiting';
        return 'predicted';
      }

      if (finished) return 'none';
      if (isStarted) return 'missed';
      return 'open';
    },
    [dayPassed, isGame, pickFor],
  );

  const pickLabelOf = useCallback(
    (match: Match): string | null => {
      const prev = pickFor(match.id);
      if (!prev) return null;
      if (!isGame && prev.home != null && prev.away != null) {
        return `${prev.home} - ${prev.away}`;
      }
      if (prev.type === 'home') return copy.winOf.replace('{team}', teamName(match.homeTeam));
      if (prev.type === 'away') return copy.winOf.replace('{team}', teamName(match.awayTeam));
      if (prev.type === 'draw') return copy.draw;
      return null;
    },
    [copy.draw, copy.winOf, isGame, pickFor, teamName],
  );

  const switchMode = (next: KingRouteMode) => {
    if (next === mode) return;
    router.setParams({ mode: next, date: dateKey || undefined } as never);
  };

  const openBoard = () => {
    router.push({ pathname: '/king-of-predictions/leaderboard', params: { mode } } as never);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/rank' as never);
  };

  const title = isGame ? copy.playModePredictions : copy.hubResultsTitle;
  const cardCopy = {
    predictNow: copy.predictNow,
    predicted: copy.predicted,
    waitingEnd: copy.waitingEnd,
    predictionEnded: copy.predictionEnded,
    notPredicted: copy.notPredicted,
    matchStarts: copy.matchStarts,
    matchStarted: copy.matchStarted,
    matchEnded: copy.matchEnded,
    yourPick: copy.yourPick,
    draw: copy.draw,
    winOf: copy.winOf,
    predictedWin: copy.predictedWin,
    predictedDraw: copy.predictedDraw,
    vs: copy.vs,
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.screen }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable onPress={goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={copy.back} style={styles.backBtn}>
          <Ionicons
            name={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'}
            size={24}
            color={theme.headerIcon}
          />
          <Text style={[styles.title, { color: theme.headerTitle, fontFamily: fontBold }]} numberOfLines={1}>
            {title}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: listBottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.refresh} />
        }
      >
        <Image source={KING_ART.promoBanner} style={styles.banner} contentFit="cover" />

        <View
          style={[
            styles.modeTrack,
            {
              backgroundColor: theme.modeTrackBg,
              borderColor: theme.modeTrackBorder,
            },
          ]}
        >
          <ModeTab
            label={copy.playModePredictions}
            active={mode === 'game'}
            theme={theme}
            font={fontSemi}
            onPress={() => switchMode('game')}
          />
          <ModeTab
            label={copy.hubResultsTitle}
            active={mode === 'results'}
            theme={theme}
            font={fontSemi}
            onPress={() => switchMode('results')}
          />
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.infoBg, direction: 'ltr' }]}>
          <Text style={[styles.infoText, { color: theme.infoText, fontFamily: fontMedium }]}>
            {copy.playHint}
          </Text>
          <Ionicons name="information-circle-outline" size={17} color={theme.infoIcon} />
        </View>

        <View style={styles.sectionHead}>
          <View style={[styles.progress, { backgroundColor: theme.progressBg }]}>
            <Text style={[styles.progressText, { color: theme.progressText, fontFamily: fontSemi }]}>
              {copy.progressDone
                .replace('{done}', String(completedCount))
                .replace('{total}', String(matches.length || DAILY_LIMIT))}
            </Text>
          </View>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: theme.sectionTitle, fontFamily: fontSemi }]}>
              {copy.matchesTitle}
            </Text>
            <Image source={KING_ART.courtIcon} style={styles.courtIcon} contentFit="contain" />
          </View>
        </View>

        {loading && matches.length === 0 ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : error && matches.length === 0 ? (
          <Pressable
            onPress={() => {
              setLoading(true);
              void load()
                .catch(() => setError(true))
                .finally(() => setLoading(false));
            }}
            style={styles.center}
          >
            <Text style={[{ color: theme.muted, fontFamily: fontMedium }, styles.centerText]}>{copy.loadError}</Text>
            <Text style={[{ color: theme.primary, fontFamily: fontSemi }, styles.retry]}>{copy.retry}</Text>
          </Pressable>
        ) : matches.length === 0 ? (
          <Text style={[{ color: theme.muted, fontFamily: fontMedium }, styles.centerText, styles.center]}>
            {copy.noMatches}
          </Text>
        ) : (
          matches.map((match, index) => {
            const phase = phaseOf(match);
            const prev = pickFor(match.id);
            const button = kingCardButton({
              dayPassed,
              started: started(match),
              live: match.status === 'live',
              verdict:
                prev?.correct === true
                  ? 'correct'
                  : prev?.correct === false
                    ? 'wrong'
                    : prev
                      ? 'pending'
                      : null,
            });
            const draft = scoreFor(match);
            return (
              <PlayMatchCard
                key={`${apiMode}-${match.id}`}
                match={match}
                index={index}
                isGame={isGame}
                theme={theme}
                phase={phase}
                pick={prev?.type ?? null}
                homeScore={draft.home}
                awayScore={draft.away}
                homeName={teamName(match.homeTeam)}
                awayName={teamName(match.awayTeam)}
                pickLabel={pickLabelOf(match)}
                fonts={{ bold: fontBold, semi: fontSemi, medium: fontMedium, regular: fontRegular }}
                copy={cardCopy}
                locked={button.locked}
                onPick={(next) => onGamePick(match, next)}
                onHomeScore={(value) => setScore(String(match.id), 'home', value)}
                onAwayScore={(value) => setScore(String(match.id), 'away', value)}
              />
            );
          })
        )}
      </ScrollView>

      <View pointerEvents="box-none" style={[styles.footer, { bottom: navBottom }]}>
        <Pressable
          onPress={() => void confirmAll()}
          disabled={saving}
          style={[styles.cta, { backgroundColor: theme.ctaBg, opacity: saving ? 0.7 : 1 }]}
        >
          <Text style={[styles.ctaText, { color: theme.ctaText, fontFamily: fontSemi }]}>
            {`${copy.confirm} (${completedCount}/${matches.length || DAILY_LIMIT})`}
          </Text>
        </Pressable>

        <View
          style={[
            styles.nav,
            {
              backgroundColor: theme.navBg,
              borderColor: theme.navBorder,
              shadowColor: theme.cardShadow,
            },
          ]}
        >
          <View style={[styles.navItem, styles.navActive, { backgroundColor: theme.navActiveBg }]}>
            <Text style={[styles.navText, { color: theme.navActiveText, fontFamily: fontSemi }]}>{copy.tabPredict}</Text>
          </View>
          <Pressable onPress={openBoard} style={styles.navItem}>
            <Text style={[styles.navText, { color: theme.navIdleText, fontFamily: fontSemi }]}>{copy.tabRanking}</Text>
          </Pressable>
        </View>
      </View>

      <KingToast toast={toast} onHide={() => setToast(null)} />
    </View>
  );
}

function ModeTab({
  label,
  active,
  theme,
  font,
  onPress,
}: {
  label: string;
  active: boolean;
  theme: ReturnType<typeof getKingPlayTheme>;
  font: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.modeTab,
        active && { backgroundColor: theme.modeActiveBg },
      ]}
    >
      <Text
        style={[
          styles.modeTabText,
          {
            color: active ? theme.modeActiveText : theme.modeIdleText,
            fontFamily: font,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: SIDE,
    paddingBottom: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    alignSelf: 'stretch',
  },
  title: { fontSize: 22, textAlign: 'right' },
  scroll: {
    paddingHorizontal: SIDE,
    gap: 14,
    paddingTop: 4,
  },
  banner: {
    width: '100%',
    height: 161,
    borderRadius: 17,
  },
  modeTrack: {
    height: 51,
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    flexDirection: 'row',
    gap: 4,
  },
  modeTab: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabText: { fontSize: 14 },
  infoBox: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    direction: 'ltr',
  },
  progress: {
    height: 28,
    borderRadius: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: { fontSize: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18 },
  courtIcon: { width: 22, height: 22 },
  center: { marginTop: 40, alignItems: 'center' },
  centerText: { fontSize: 15, textAlign: 'center' },
  retry: { marginTop: 8, fontSize: 15 },
  footer: {
    position: 'absolute',
    left: SIDE,
    right: SIDE,
    alignItems: 'center',
    gap: 12,
  },
  cta: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16 },
  nav: {
    width: 192,
    height: NAV_HEIGHT,
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    flexDirection: 'row',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  navItem: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navActive: {},
  navText: { fontSize: 14 },
});
