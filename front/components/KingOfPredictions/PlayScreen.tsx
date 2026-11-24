import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
import { KING_ART, KING_ICON } from './assets';
import { KING_BUTTON_GRADIENT } from './KingBoardList';
import { KingPlayHeader } from './KingPlayHeader';
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
  peekKingMatches,
  type KingRouteMode,
} from './shared';
import { KingHistoryList } from './HistoryList';
import { KingNav, KING_NAV_HEIGHT, kingNavBottom, parseKingTab, type KingTabKey } from './KingNav';
import { KingToast, type KingToastState } from './KingToast';

const SIDE = 20;
const DAILY_LIMIT = 10;
/** Finished football scores above this are almost never real — drop bad/non-soccer rows. */
const MAX_FOOTBALL_GOALS = 20;

function started(match: Match, now = Date.now()): boolean {
  const kickoff = match.fixtureDate ? new Date(match.fixtureDate).getTime() : null;
  return matchHasStarted(match.status, Number.isFinite(kickoff) ? kickoff : null, now);
}

function isPostponed(match: Match): boolean {
  const short = String(match.statusShort ?? '').toUpperCase();
  return short === 'PST' || match.status === 'PST';
}

/** Keep soccer-looking rows only (reject basketball-style 68–73 scores). */
function isPlausibleFootballMatch(match: Match): boolean {
  if (match.status !== 'finished' && match.status !== 'live') return true;
  const home = match.score?.home ?? 0;
  const away = match.score?.away ?? 0;
  return home <= MAX_FOOTBALL_GOALS && away <= MAX_FOOTBALL_GOALS;
}

function parseScore(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  return Math.min(20, Number.parseInt(digits, 10));
}

export function KingPlayScreen({
  mode: modeParam,
  date,
  tab: tabParam,
}: {
  mode: string | string[] | undefined;
  date?: string | string[];
  tab?: string | string[];
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

  const openingTab = parseKingTab(tabParam) ?? 'matches';
  const [tab, setTab] = useState<Exclude<KingTabKey, 'ranking'>>(
    openingTab === 'ranking' ? 'matches' : openingTab,
  );

  useEffect(() => {
    const next = parseKingTab(tabParam);
    if (next === 'matches' || next === 'history') setTab(next);
  }, [tabParam]);

  const openingDate = dateKey || cairoTodayKey();
  const openingMatches = (peekKingMatches(openingDate)?.matches ?? []).filter(isPlausibleFootballMatch);
  const [matches, setMatches] = useState<Match[]>(openingMatches);
  const serverPicks = useKingPicksStore((state) => state.server);
  const localPicks = useKingPicksStore((state) => state.local);
  const saved = useMemo<Record<string, KingPick>>(
    () => ({ ...serverPicks, ...localPicks }),
    [serverPicks, localPicks],
  );
  const [loading, setLoading] = useState(openingMatches.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<KingToastState | null>(null);
  const [sheetMatch, setSheetMatch] = useState<Match | null>(null);
  const [sheetPick, setSheetPick] = useState<CardPick | null>(null);
  const [homeText, setHomeText] = useState('');
  const [awayText, setAwayText] = useState('');
  const navBottom = kingNavBottom(insets.bottom);
  const listBottom = navBottom + KING_NAV_HEIGHT + 24;

  const loadGenRef = useRef(0);
  const hasRows = useRef(openingMatches.length > 0);

  useEffect(() => {
    const seeded = (peekKingMatches(dateKey || cairoTodayKey())?.matches ?? []).filter(isPlausibleFootballMatch);
    hasRows.current = seeded.length > 0;
    setMatches(seeded);
    setError(false);
    setLoading(seeded.length === 0);
    setSheetMatch(null);
  }, [dateKey]);

  const load = useCallback(async (force = false) => {
    const gen = ++loadGenRef.current;
    const { matches: dayMatches, calendar } = await fetchKingMatches(dateKey || cairoTodayKey(), { force });
    if (gen !== loadGenRef.current) return;
    if (calendar) setTodayKey(calendar.today);
    setMatches(dayMatches.filter(isPlausibleFootballMatch));
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
      await load(true);
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

  const openSheet = (match: Match) => {
    if (isPostponed(match) || started(match) || dayPassed) return;
    const prev = pickFor(match.id);
    setHomeText(prev?.home != null ? String(prev.home) : '');
    setAwayText(prev?.away != null ? String(prev.away) : '');
    setSheetPick(prev?.type ?? null);
    setSheetMatch(match);
  };

  const closeSheet = () => setSheetMatch(null);

  const confirmSheet = useCallback(() => {
    const match = sheetMatch;
    if (!match) return;
    const home = parseScore(homeText);
    const away = parseScore(awayText);
    if (isGame ? sheetPick == null : home == null || away == null) return;
    if (!isSignedIn) {
      showError(copy.signIn);
      return;
    }
    const predictionType: CardPick = isGame
      ? (sheetPick as CardPick)
      : home! > away! ? 'home' : away! > home! ? 'away' : 'draw';
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
      { type: predictionType, home: isGame ? null : home, away: isGame ? null : away, correct: null },
      meta,
      apiMode,
    );

    setSheetMatch(null);
    const pickName =
      predictionType === 'home'
        ? teamName(match.homeTeam)
        : predictionType === 'away'
          ? teamName(match.awayTeam)
          : copy.draw;
    setToast({
      variant: 'success',
      title: pickFor(matchId) ? copy.updated : copy.saved,
      pick: isGame ? pickName : `${home} - ${away}`,
      caption: `${teamName(match.awayTeam)} ${copy.vs} ${teamName(match.homeTeam)}`,
    });

    void (async () => {
      try {
        await PredictionsService.submitPrediction(getTokenRef.current, {
          apiMatchId: match.id,
          predictionType,
          ...meta,
          predictedHomeScore: isGame ? undefined : home!,
          predictedAwayScore: isGame ? undefined : away!,
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
    })();
  }, [
    apiMode,
    awayText,
    copy,
    explain,
    homeText,
    isGame,
    isSignedIn,
    pickFor,
    sheetMatch,
    sheetPick,
    showError,
    teamName,
  ]);

  const sheetReady = isGame
    ? sheetPick != null
    : parseScore(homeText) != null && parseScore(awayText) != null;

  const completedCount = useMemo(() => {
    return matches.reduce((count, match) => {
      const prev = pickFor(match.id);
      if (!prev) return count;
      if (isGame) return prev.type ? count + 1 : count;
      return prev.home != null && prev.away != null ? count + 1 : count;
    }, 0);
  }, [isGame, matches, pickFor]);

  const phaseOf = useCallback(
    (match: Match): CardPhase => {
      if (isPostponed(match)) return 'postponed';
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

  const scoreDisplay = useCallback(
    (match: Match) => {
      const prev = pickFor(match.id);
      return {
        home: prev?.home != null ? String(prev.home) : '',
        away: prev?.away != null ? String(prev.away) : '',
      };
    },
    [pickFor],
  );

  const switchMode = (next: KingRouteMode) => {
    if (next === mode) return;
    router.setParams({ mode: next, date: dateKey || undefined } as never);
  };

  const openBoard = () => {
    router.replace({ pathname: '/king-of-predictions/leaderboard', params: { mode } } as never);
  };

  const onNavChange = (next: KingTabKey) => {
    if (next === 'ranking') {
      openBoard();
      return;
    }
    setTab(next);
    router.setParams({ tab: next } as never);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/rank' as never);
  };

  const title =
    tab === 'history' ? copy.tabHistory : isGame ? copy.playModePredictions : copy.hubResultsTitle;
  const cardCopy = {
    predictNow: copy.predictNow,
    predicted: copy.predicted,
    waitingEnd: copy.waitingEnd,
    predictionEnded: copy.predictionEnded,
    notPredicted: copy.notPredicted,
    postponed: copy.postponed,
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

  const sheetBg = theme.isDark ? (['#0C051A', '#07040D'] as const) : (['#FFFFFF', '#F8F7FF'] as const);

  return (
    <View style={[styles.root, { backgroundColor: theme.screen }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />

      <KingPlayHeader title={title} onBack={goBack} backLabel={copy.back} theme={theme} />

      <View
        style={[
          styles.modeTrack,
          {
            marginHorizontal: SIDE,
            marginTop: 8,
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

      {tab === 'history' ? (
        <KingHistoryList
          mode={mode}
          bottomPadding={listBottom}
          onPredict={() => onNavChange('matches')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: listBottom, paddingTop: 12 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.refresh} />
          }
        >
          <Image source={KING_ART.promoBanner} style={styles.banner} contentFit="cover" />

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
                started: started(match) || isPostponed(match),
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
              const draft = scoreDisplay(match);
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
                  locked={button.locked || isPostponed(match)}
                  onPress={() => openSheet(match)}
                />
              );
            })
          )}
        </ScrollView>
      )}

      <KingNav activeTab={tab} onChange={onNavChange} />

      <Modal visible={sheetMatch != null} transparent animationType="fade" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          <LinearGradient colors={[...sheetBg]} style={[styles.sheet, { borderColor: theme.modeTrackBorder }]}>
            <Pressable onPress={closeSheet} style={styles.close} hitSlop={8}>
              <Ionicons name="close" size={28} color={theme.ink} />
            </Pressable>
            <Text style={[styles.sheetTitle, { color: theme.ink, fontFamily: fontSemi }]}>{copy.sheetTitle}</Text>

            {sheetMatch && isGame ? (
              <>
                <Text style={[styles.pickHint, { color: theme.muted, fontFamily: fontMedium }]}>{copy.pickWinner}</Text>
                <View style={styles.pickRow}>
                  <PickTeam
                    name={teamName(sheetMatch.homeTeam)}
                    logo={sheetMatch.homeTeam.logo}
                    selected={sheetPick === 'home'}
                    theme={theme}
                    font={fontSemi}
                    onPress={() => setSheetPick('home')}
                  />
                  <View style={styles.pickMid}>
                    <Pressable onPress={() => setSheetPick('draw')} accessibilityLabel={copy.draw}>
                      <View
                        style={[
                          styles.drawCircle,
                          {
                            backgroundColor: sheetPick === 'draw' ? theme.primary : theme.surface,
                            borderColor: theme.primary,
                          },
                        ]}
                      >
                        <Image
                          source={KING_ICON.drawX}
                          style={styles.drawX}
                          contentFit="contain"
                          tintColor={sheetPick === 'draw' ? '#fff' : theme.primary}
                        />
                      </View>
                    </Pressable>
                    <Text
                      style={[
                        styles.drawLabel,
                        { color: sheetPick === 'draw' ? theme.ink : theme.muted, fontFamily: fontSemi },
                      ]}
                    >
                      {copy.draw}
                    </Text>
                    <Text style={[styles.sheetTime, { color: theme.muted, fontFamily: fontMedium }]}>
                      {sheetMatch.time || ''}
                    </Text>
                  </View>
                  <PickTeam
                    name={teamName(sheetMatch.awayTeam)}
                    logo={sheetMatch.awayTeam.logo}
                    selected={sheetPick === 'away'}
                    theme={theme}
                    font={fontSemi}
                    onPress={() => setSheetPick('away')}
                  />
                </View>
              </>
            ) : sheetMatch ? (
              <>
                <View style={styles.sheetTeams}>
                  <SheetTeam name={teamName(sheetMatch.homeTeam)} logo={sheetMatch.homeTeam.logo} theme={theme} font={fontSemi} />
                  <View style={styles.sheetMid}>
                    <Text style={[styles.sheetVs, { color: theme.primary, fontFamily: fontSemi }]}>{copy.vs}</Text>
                    <Text style={[styles.sheetTime, { color: theme.muted, fontFamily: fontMedium }]}>
                      {sheetMatch.time || ''}
                    </Text>
                  </View>
                  <SheetTeam name={teamName(sheetMatch.awayTeam)} logo={sheetMatch.awayTeam.logo} theme={theme} font={fontSemi} />
                </View>
                <Text style={[styles.resultTitle, { color: theme.ink, fontFamily: fontSemi }]}>{copy.matchResult}</Text>
                <View style={styles.scoreRow}>
                  <ScoreInput value={homeText} onChange={setHomeText} theme={theme} font={fontBold} />
                  <Text style={[styles.scoreColon, { color: theme.muted, fontFamily: fontSemi }]}>:</Text>
                  <ScoreInput value={awayText} onChange={setAwayText} theme={theme} font={fontBold} />
                </View>
              </>
            ) : null}

            <Pressable
              disabled={!sheetReady}
              onPress={confirmSheet}
              style={[styles.sheetConfirm, !sheetReady && styles.dimmed]}
            >
              <LinearGradient colors={KING_BUTTON_GRADIENT} style={styles.footerBtn}>
                <Text style={[styles.footerText, { fontFamily: fontSemi }]} maxFontSizeMultiplier={1.15}>
                  {copy.confirm}
                </Text>
              </LinearGradient>
            </Pressable>
            <Text style={[styles.hint, { color: theme.muted, fontFamily: fontRegular }]}>{copy.editHint}</Text>
          </LinearGradient>
        </KeyboardAvoidingView>
        {sheetMatch ? <KingToast toast={toast} onHide={() => setToast(null)} /> : null}
      </Modal>

      {sheetMatch ? null : <KingToast toast={toast} onHide={() => setToast(null)} />}
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
    <Pressable onPress={onPress} style={[styles.modeTab, active && { backgroundColor: theme.modeActiveBg }]}>
      <Text
        style={[
          styles.modeTabText,
          { color: active ? theme.modeActiveText : theme.modeIdleText, fontFamily: font },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function singleWord(name: string) {
  return !/\s/.test(name.trim());
}

function TeamLabel({ name, style, font }: { name: string; style: object; font: string }) {
  return (
    <Text
      style={[style, { fontFamily: font }]}
      numberOfLines={singleWord(name) ? 1 : 2}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={1.15}
    >
      {name}
    </Text>
  );
}

function SheetTeam({
  name,
  logo,
  theme,
  font,
}: {
  name: string;
  logo?: string;
  theme: ReturnType<typeof getKingPlayTheme>;
  font: string;
}) {
  return (
    <View style={styles.sheetTeam}>
      {logo ? <Image source={{ uri: logo }} style={styles.sheetLogo} contentFit="contain" /> : <View style={styles.sheetLogo} />}
      <TeamLabel name={name} font={font} style={[styles.sheetName, { color: theme.ink }]} />
    </View>
  );
}

function PickTeam({
  name,
  logo,
  selected,
  theme,
  font,
  onPress,
}: {
  name: string;
  logo?: string;
  selected: boolean;
  theme: ReturnType<typeof getKingPlayTheme>;
  font: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={styles.pickPress}>
      <View
        style={[
          styles.pickTeam,
          {
            backgroundColor: selected ? theme.primary : theme.surface,
            borderColor: selected ? theme.primary : theme.choiceIdleBorder,
          },
        ]}
      >
        {logo ? <Image source={{ uri: logo }} style={styles.sheetLogo} contentFit="contain" /> : <View style={styles.sheetLogo} />}
        <TeamLabel name={name} font={font} style={[styles.pickName, { color: selected ? '#fff' : theme.ink }]} />
      </View>
    </Pressable>
  );
}

function ScoreInput({
  value,
  onChange,
  theme,
  font,
}: {
  value: string;
  onChange: (next: string) => void;
  theme: ReturnType<typeof getKingPlayTheme>;
  font: string;
}) {
  return (
    <View style={[styles.scoreBox, { backgroundColor: theme.scoreIdleBg, borderColor: theme.primary }]}>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="-"
        placeholderTextColor={theme.scoreIdleText}
        style={[styles.scoreInput, { color: theme.ink, fontFamily: font }]}
        selectionColor={theme.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: SIDE, gap: 14, paddingTop: 4 },
  banner: { width: '100%', height: 161, borderRadius: 17 },
  modeTrack: {
    height: 51,
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    flexDirection: 'row',
    gap: 4,
  },
  modeTab: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' },
  sheet: {
    marginHorizontal: 16,
    borderRadius: 28,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  close: { height: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  sheetTitle: { fontSize: 22, textAlign: 'center' },
  pickHint: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  pickRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    direction: 'ltr',
  },
  pickPress: { flex: 1, maxWidth: 140 },
  pickTeam: {
    width: '100%',
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pickName: { fontSize: 14, textAlign: 'center' },
  pickMid: { alignItems: 'center' },
  drawCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawX: { width: 28, height: 28 },
  drawLabel: { fontSize: 14, marginTop: 8 },
  sheetTeams: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    direction: 'ltr',
  },
  sheetTeam: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  sheetLogo: { width: 48, height: 54 },
  sheetName: { fontSize: 15, textAlign: 'center' },
  sheetMid: { width: 90, alignItems: 'center' },
  sheetVs: { fontSize: 22 },
  sheetTime: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  resultTitle: { fontSize: 20, textAlign: 'center', marginTop: 20 },
  scoreRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    direction: 'ltr',
  },
  scoreBox: {
    width: 88,
    height: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  scoreInput: {
    flex: 1,
    fontSize: 28,
    textAlign: 'center',
    padding: 0,
  },
  scoreColon: { fontSize: 26 },
  sheetConfirm: { marginTop: 28 },
  footerBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: { color: '#fff', fontSize: 18 },
  hint: { marginTop: 10, fontSize: 12, textAlign: 'center' },
  dimmed: { opacity: 0.45 },
});
