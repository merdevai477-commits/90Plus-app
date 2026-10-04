import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';

import type { Match } from '../Matches/matchCardUtils';
import { PWGradientText } from '../predictAndWin/GradientText';
import { PredictionApiError, PredictionsService } from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ART, KING_ICON } from './assets';
import { GlassSurface, type GlassTone } from './GlassSurface';
import { KingHistoryList } from './HistoryList';
import { KING_BUTTON_GRADIENT } from './KingBoardList';
import { KingHeader } from './KingHeader';
import { KingToast, type KingToastState } from './KingToast';
import {
  KING_BG,
  KING_PURPLE,
  fetchKingMatches,
  localDateKey,
  parseKingMode,
} from './shared';

type Pick = 'home' | 'draw' | 'away';

type SavedRow = {
  type?: Pick;
  home: number | null;
  away: number | null;
  correct: boolean | null;
};

type Verdict = 'pending' | 'correct' | 'wrong';

const SIDE = 22;
const VS_GRADIENT = ['#A855F7', '#633291'] as const;
const PICK_ON = [KING_PURPLE, '#513690'] as const;
const CARD_BG = ['#0C051A', '#07040D'] as const;
type ButtonState = Verdict | 'open' | 'closed';

const BUTTON_LOOK: Record<
  ButtonState,
  { tone: GlassTone; icon: React.ComponentProps<typeof Ionicons>['name']; text: string }
> = {
  open: { tone: 'purple', icon: 'sparkles', text: '#FFFFFF' },
  pending: { tone: 'yellow', icon: 'time', text: '#FEF3C7' },
  correct: { tone: 'green', icon: 'checkmark-circle', text: '#DCFCE7' },
  wrong: { tone: 'red', icon: 'close-circle', text: '#FEE2E2' },
  closed: { tone: 'muted', icon: 'lock-closed', text: '#8A8794' },
};

function started(match: Match): boolean {
  if (match.status === 'live' || match.status === 'finished') return true;
  if (!match.fixtureDate) return false;
  const kickoff = new Date(match.fixtureDate).getTime();
  return Number.isFinite(kickoff) && kickoff <= Date.now();
}

function parseScore(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  return Math.min(20, Number.parseInt(digits, 10));
}

export function KingPlayScreen({
  mode: modeParam,
  date,
}: {
  mode: string | string[] | undefined;
  date?: string | string[];
}) {
  const mode = parseKingMode(Array.isArray(modeParam) ? modeParam[0] : modeParam);
  const isGame = mode === 'game';
  const dateKey = (Array.isArray(date) ? date[0] : date) || '';
  const dayPassed = dateKey !== '' && dateKey < localDateKey(new Date());
  const insets = useSafeAreaInsets();
  const { getToken, isSignedIn } = useAuth();
  // Clerk hands out a new getToken on renders; keeping it out of load's deps
  // stops the focus effect from re-running (and re-rendering) forever.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { t } = useTranslation();
  const copy = t.kingPredictions;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const fontRegular = useAppFont(400);

  const [matches, setMatches] = useState<Match[]>([]);
  const [saved, setSaved] = useState<Record<string, SavedRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetMatch, setSheetMatch] = useState<Match | null>(null);
  const [sheetPick, setSheetPick] = useState<Pick | null>(null);
  const [homeText, setHomeText] = useState('');
  const [awayText, setAwayText] = useState('');
  const [toast, setToast] = useState<KingToastState | null>(null);
  const [tab, setTab] = useState<KingTab>('predict');
  const navBottom = Math.max(insets.bottom, 12) + 8;
  const listBottom = navBottom + NAV_HEIGHT + 20;

  const load = useCallback(async () => {
    setError(false);
    const dayMatches = await fetchKingMatches(dateKey || localDateKey(new Date()));
    setMatches(dayMatches);

    const token = await getTokenRef.current().catch(() => null);
    if (!token) {
      setSaved({});
      return;
    }
    const preds = await PredictionsService.getUserPredictions(token);
    const nextSaved: Record<string, SavedRow> = {};
    for (const match of dayMatches) {
      const row = (preds.predictionsMap as Record<string, {
        prediction?: { type?: Pick };
        predictedHomeScore?: number | null;
        predictedAwayScore?: number | null;
        isCorrect?: boolean | null;
      }>)[match.id];
      if (!row) continue;
      nextSaved[match.id] = {
        type: row.prediction?.type,
        home: row.predictedHomeScore ?? null,
        away: row.predictedAwayScore ?? null,
        correct: row.isCorrect ?? null,
      };
    }
    setSaved(nextSaved);
  }, [dateKey]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void load()
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [load]),
  );

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

  const isLocked = useCallback(
    (match: Match) => dayPassed || started(match) || saved[match.id]?.correct != null,
    [dayPassed, saved],
  );

  const openSheet = (match: Match) => {
    const prev = saved[match.id];
    setHomeText(prev?.home != null ? String(prev.home) : '');
    setAwayText(prev?.away != null ? String(prev.away) : '');
    setSheetPick(prev?.type ?? null);
    setSheetMatch(match);
  };

  const closeSheet = () => setSheetMatch(null);

  const confirmSheet = useCallback(async () => {
    const match = sheetMatch;
    if (!match) return;
    const home = parseScore(homeText);
    const away = parseScore(awayText);
    if (isGame ? sheetPick == null : home == null || away == null) return;
    const token = await getToken();
    if (!token || !isSignedIn) {
      showError(copy.signIn);
      return;
    }
    setBusy(true);
    try {
      const predictionType: Pick = isGame
        ? (sheetPick as Pick)
        : home! > away! ? 'home' : away! > home! ? 'away' : 'draw';
      const result = await PredictionsService.submitPrediction(token, {
        apiMatchId: match.id,
        predictionType,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeTeamLogo: match.homeTeam.logo,
        awayTeamLogo: match.awayTeam.logo,
        matchDate: match.fixtureDate || new Date().toISOString(),
        leagueName: match.league?.name,
        predictedHomeScore: isGame ? undefined : home!,
        predictedAwayScore: isGame ? undefined : away!,
      });
      setSheetMatch(null);
      const pickName =
        predictionType === 'home' ? match.homeTeam.name : predictionType === 'away' ? match.awayTeam.name : copy.draw;
      setToast({
        variant: 'success',
        title: result.updated ? copy.updated : copy.saved,
        pick: isGame ? pickName : `${away} - ${home}`,
        caption: `${match.awayTeam.name} ${copy.vs} ${match.homeTeam.name}`,
      });
      await load().catch(() => undefined);
    } catch (err) {
      explain(err);
    } finally {
      setBusy(false);
    }
  }, [awayText, copy, explain, getToken, homeText, isGame, isSignedIn, load, sheetMatch, sheetPick, showError]);

  const sheetReady = isGame
    ? sheetPick != null
    : parseScore(homeText) != null && parseScore(awayText) != null;

  const savedLabel = (match: Match): string | null => {
    const prev = saved[match.id];
    if (!prev) return null;
    const exact = prev.home != null && prev.away != null;
    if (!isGame) return exact ? `${prev.away} - ${prev.home}` : null;
    if (exact) return null;
    if (prev.type === 'home') return match.homeTeam.name;
    if (prev.type === 'away') return match.awayTeam.name;
    if (prev.type === 'draw') return copy.draw;
    return null;
  };

  // King of Results is about the exact scoreline, so a right winner with the
  // wrong score still reads as wrong here once the final score is known.
  const verdictOf = (match: Match): Verdict | null => {
    const prev = saved[match.id];
    if (!prev || savedLabel(match) == null) return null;
    if (prev.correct == null) return 'pending';
    if (!prev.correct) return 'wrong';
    if (
      !isGame &&
      match.status === 'finished' &&
      (prev.home !== match.score.home || prev.away !== match.score.away)
    ) {
      return 'wrong';
    }
    return 'correct';
  };

  return (
    <View style={styles.root}>
      <KingHeader />

      {tab === 'history' ? (
        <KingHistoryList mode={mode} bottomPadding={listBottom} />
      ) : loading ? (
        <ActivityIndicator color={KING_PURPLE} style={{ marginTop: 40 }} />
      ) : error ? (
        <Pressable onPress={() => { setLoading(true); void load().catch(() => setError(true)).finally(() => setLoading(false)); }} style={styles.center}>
          <Text style={[styles.muted, { fontFamily: fontMedium }]}>{copy.loadError}</Text>
          <Text style={[styles.retry, { fontFamily: fontSemi }]}>{copy.retry}</Text>
        </Pressable>
      ) : matches.length === 0 ? (
        <Text style={[styles.muted, styles.center, { fontFamily: fontMedium }]}>{copy.noMatches}</Text>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.cardList, { paddingBottom: listBottom }]}
          showsVerticalScrollIndicator={false}
        >
          {matches.map((match) => {
            const locked = isLocked(match);
            const verdict = verdictOf(match);
            const label =
              verdict === 'correct'
                ? copy.resultCorrect
                : verdict === 'wrong'
                  ? copy.resultWrong
                  : savedLabel(match) ?? (locked ? copy.closed : copy.predictNow);
            const state: ButtonState = verdict ?? (locked ? 'closed' : 'open');
            const look = BUTTON_LOOK[state];
            return (
              <LinearGradient key={match.id} colors={CARD_BG} style={styles.card}>
                <CardTeam name={match.awayTeam.name} logo={match.awayTeam.logo} font={fontBold} size={13} />
                <View style={styles.cardMid}>
                  <PWGradientText colors={VS_GRADIENT} style={[styles.vs, { fontFamily: fontSemi }]}>
                    {copy.vs}
                  </PWGradientText>
                  <Text style={[styles.time, { fontFamily: fontMedium }]}>{match.time || ''}</Text>
                  <Pressable
                    disabled={locked || busy}
                    onPress={() => openSheet(match)}
                    style={({ pressed }) => [styles.predictPress, pressed && styles.predictPressed]}
                  >
                    <GlassSurface radius={12} tone={look.tone} style={styles.predictBtn}>
                      <Ionicons name={look.icon} size={13} color={look.text} />
                      <Text
                        style={[styles.predictText, { color: look.text, fontFamily: fontBold }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        {label}
                      </Text>
                    </GlassSurface>
                  </Pressable>
                </View>
                <CardTeam name={match.homeTeam.name} logo={match.homeTeam.logo} font={fontBold} size={14} />
              </LinearGradient>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={sheetMatch != null} transparent animationType="fade" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          <LinearGradient colors={CARD_BG} style={styles.sheet}>
            <Pressable onPress={closeSheet} style={styles.close} hitSlop={8}>
              <Image source={KING_ICON.close} style={styles.closeIcon} contentFit="contain" />
            </Pressable>
            <Text style={[styles.sheetTitle, { fontFamily: fontSemi }]}>{copy.sheetTitle}</Text>

            {sheetMatch && isGame ? (
              <>
                <Text style={[styles.pickHint, { fontFamily: fontMedium }]}>{copy.pickWinner}</Text>
                <View style={styles.pickRow}>
                  <PickTeam
                    name={sheetMatch.awayTeam.name}
                    logo={sheetMatch.awayTeam.logo}
                    selected={sheetPick === 'away'}
                    font={fontSemi}
                    onPress={() => setSheetPick('away')}
                    style={styles.pickPress}
                  />
                  <View style={styles.pickMid}>
                    <Pressable onPress={() => setSheetPick('draw')} accessibilityLabel={copy.draw}>
                      {sheetPick === 'draw' ? (
                        <View style={styles.drawRing}>
                          <LinearGradient colors={['#A78BFA', '#6D28D9']} style={[styles.drawCircle, styles.drawOn]}>
                            <Image source={KING_ICON.drawX} style={styles.drawX} contentFit="contain" tintColor="#fff" />
                          </LinearGradient>
                        </View>
                      ) : (
                        <LinearGradient
                          colors={['rgba(86,21,216,0.32)', 'rgba(62,15,156,0.32)', 'rgba(46,11,114,0.32)']}
                          locations={[0, 0.587, 1]}
                          style={[styles.drawCircle, styles.drawIdle]}
                        >
                          <Image source={KING_ICON.drawXGlow} style={styles.drawGlow} contentFit="contain" />
                          <Image source={KING_ICON.drawX} style={styles.drawX} contentFit="contain" />
                        </LinearGradient>
                      )}
                    </Pressable>
                    <Text
                      style={[styles.drawLabel, sheetPick === 'draw' && styles.drawLabelOn, { fontFamily: fontSemi }]}
                    >
                      {copy.draw}
                    </Text>
                    <Text style={[styles.time, { fontFamily: fontMedium }]}>{sheetMatch.time || ''}</Text>
                  </View>
                  <PickTeam
                    name={sheetMatch.homeTeam.name}
                    logo={sheetMatch.homeTeam.logo}
                    selected={sheetPick === 'home'}
                    font={fontSemi}
                    onPress={() => setSheetPick('home')}
                    style={styles.pickPress}
                  />
                </View>
              </>
            ) : sheetMatch ? (
              <>
                <View style={styles.sheetTeams}>
                  <SheetTeam name={sheetMatch.awayTeam.name} logo={sheetMatch.awayTeam.logo} font={fontSemi} />
                  <View style={styles.sheetMid}>
                    <PWGradientText colors={VS_GRADIENT} style={[styles.vs, { fontFamily: fontSemi }]}>
                      {copy.vs}
                    </PWGradientText>
                    <Text style={[styles.time, { fontFamily: fontMedium }]}>{sheetMatch.time || ''}</Text>
                  </View>
                  <SheetTeam name={sheetMatch.homeTeam.name} logo={sheetMatch.homeTeam.logo} font={fontSemi} />
                </View>
                <Text style={[styles.resultTitle, { fontFamily: fontSemi }]}>{copy.matchResult}</Text>
                <View style={styles.scoreRow}>
                  <ScoreInput value={awayText} onChange={setAwayText} font={fontBold} />
                  <PWGradientText colors={VS_GRADIENT} style={[styles.scoreVs, { fontFamily: fontSemi }]}>
                    {copy.vs}
                  </PWGradientText>
                  <ScoreInput value={homeText} onChange={setHomeText} font={fontBold} />
                </View>
              </>
            ) : null}

            <Pressable
              disabled={!sheetReady || busy}
              onPress={() => { void confirmSheet(); }}
              style={isGame ? styles.sheetConfirmGame : styles.sheetConfirm}
            >
              <LinearGradient colors={KING_BUTTON_GRADIENT} style={[styles.footerBtn, (!sheetReady || busy) && styles.dimmed]}>
                <Text style={[styles.footerText, { fontFamily: fontSemi }]}>{copy.confirm}</Text>
              </LinearGradient>
            </Pressable>
            <View style={styles.hintRow}>
              <Text style={[styles.hint, { fontFamily: fontRegular }]}>{copy.editHint}</Text>
              <Image source={KING_ICON.info} style={styles.infoIcon} contentFit="contain" />
            </View>
          </LinearGradient>
        </KeyboardAvoidingView>
        {sheetMatch ? <KingToast toast={toast} onHide={() => setToast(null)} /> : null}
      </Modal>

      <View pointerEvents="box-none" style={[styles.navWrap, { bottom: navBottom }]}>
        <GlassSurface
          radius={NAV_HEIGHT / 2}
          tone="muted"
          style={[styles.nav, Platform.OS === 'android' && styles.navSolid]}
        >
          {NAV_TABS.map(({ key, icon }) => {
            const active = tab === key;
            const label = key === 'predict' ? copy.tabPredict : copy.tabHistory;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
                style={styles.navItem}
              >
                {active ? (
                  <LinearGradient colors={KING_BUTTON_GRADIENT} style={styles.navActive} />
                ) : null}
                <Ionicons name={icon} size={17} color={active ? '#FFFFFF' : '#8A8794'} />
                <Text style={[styles.navText, active && styles.navTextOn, { fontFamily: active ? fontBold : fontMedium }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </GlassSurface>
      </View>

      {sheetMatch ? null : <KingToast toast={toast} onHide={() => setToast(null)} />}
    </View>
  );
}

type KingTab = 'predict' | 'history';

const NAV_HEIGHT = 56;
const NAV_TABS: { key: KingTab; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'predict', icon: 'sparkles' },
  { key: 'history', icon: 'time' },
];

function singleWord(name: string) {
  return !/\s/.test(name.trim());
}

function TeamName({ name, style, font }: { name: string; style: object; font: string }) {
  return (
    <Text
      style={[style, { fontFamily: font }]}
      numberOfLines={singleWord(name) ? 1 : 2}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
    >
      {name}
    </Text>
  );
}

function CardTeam({ name, logo, font, size }: { name: string; logo?: string; font: string; size: number }) {
  return (
    <View style={styles.cardTeam}>
      {logo ? <Image source={{ uri: logo }} style={styles.cardLogo} contentFit="contain" /> : <View style={styles.cardLogo} />}
      <TeamName name={name} font={font} style={[styles.cardName, { fontSize: size }]} />
    </View>
  );
}

function SheetTeam({ name, logo, font }: { name: string; logo?: string; font: string }) {
  return (
    <View style={styles.sheetTeam}>
      {logo ? <Image source={{ uri: logo }} style={styles.sheetLogo} contentFit="contain" /> : <View style={styles.sheetLogo} />}
      <TeamName name={name} font={font} style={styles.sheetName} />
    </View>
  );
}

function PickTeam({
  name,
  logo,
  selected,
  font,
  onPress,
  style,
}: {
  name: string;
  logo?: string;
  selected: boolean;
  font: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={style}>
      <LinearGradient
        colors={selected ? PICK_ON : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
        style={[styles.pickTeam, selected ? styles.pickTeamOn : styles.pickTeamIdle]}
      >
        {logo ? <Image source={{ uri: logo }} style={styles.sheetLogo} contentFit="contain" /> : <View style={styles.sheetLogo} />}
        <TeamName name={name} font={font} style={styles.pickName} />
      </LinearGradient>
    </Pressable>
  );
}

function ScoreInput({ value, onChange, font }: { value: string; onChange: (next: string) => void; font: string }) {
  return (
    <View style={styles.scoreBox}>
      <Image source={KING_ART.scoreBox} style={StyleSheet.absoluteFill} contentFit="fill" />
      {value ? <View style={styles.scoreFill} /> : null}
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        maxLength={2}
        style={[styles.scoreInput, { fontFamily: font }]}
        selectionColor={KING_PURPLE}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KING_BG },
  center: { marginTop: 48, alignItems: 'center' },
  muted: { color: '#A1A1AA', fontSize: 15, textAlign: 'center' },
  retry: { color: KING_PURPLE, marginTop: 8, fontSize: 15 },
  cardList: { paddingHorizontal: SIDE, paddingTop: 10, gap: 12 },
  dimmed: { opacity: 0.45 },
  card: {
    minHeight: 121,
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
  cardTeam: { flex: 1, minWidth: 0, alignItems: 'center', gap: 9 },
  cardLogo: { width: 43, height: 43 },
  cardName: { color: '#fff', textAlign: 'center' },
  cardMid: { width: '34%', maxWidth: 124, minWidth: 96, alignItems: 'stretch' },
  vs: { fontSize: 21, textAlign: 'center', alignSelf: 'center' },
  time: { color: '#777', fontSize: 13, textAlign: 'center', alignSelf: 'center', marginTop: 4 },
  predictPress: { marginTop: 9, alignSelf: 'stretch' },
  predictPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  predictBtn: {
    height: 34,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  predictText: { flexShrink: 1, fontSize: 13 },
  footerBtn: {
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: { color: '#fff', fontSize: 19 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  sheet: {
    marginHorizontal: 16,
    borderRadius: 44,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 24,
    shadowColor: '#5A129E',
    shadowOpacity: 0.36,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  close: { height: 35, justifyContent: 'center', alignSelf: 'flex-start', marginLeft: 4 },
  closeIcon: { width: 36, height: 36 },
  sheetTitle: { color: '#fff', fontSize: 24, textAlign: 'center' },
  sheetTeams: {
    marginTop: 16,
    minHeight: 101,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetTeam: { flex: 1, minWidth: 0, alignItems: 'center', gap: 9 },
  sheetLogo: { width: 50, height: 58 },
  sheetName: { color: '#fff', fontSize: 18, textAlign: 'center' },
  sheetMid: { width: 105, alignItems: 'center' },
  pickHint: { color: '#9C9AA5', fontSize: 14, textAlign: 'center', marginTop: 8 },
  pickRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pickPress: { flex: 1, maxWidth: 140 },
  pickTeam: {
    width: '100%',
    height: 132,
    borderRadius: 22,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pickTeamIdle: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pickTeamOn: { borderWidth: 1, borderColor: '#B79BFF' },
  pickName: { color: '#fff', fontSize: 15, textAlign: 'center' },
  pickMid: { alignItems: 'center' },
  drawCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawIdle: { borderWidth: 1, borderColor: '#6521FF' },
  drawOn: { borderWidth: 1, borderColor: '#D9CCFF' },
  drawRing: {
    margin: -4,
    padding: 3,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.55)',
  },
  drawGlow: { position: 'absolute', width: 49, height: 49, left: 5.5, top: 5.5 },
  drawX: { width: 34, height: 34 },
  drawLabel: { color: '#9C9AA5', fontSize: 14, marginTop: 8 },
  drawLabelOn: { color: '#fff' },
  resultTitle: { color: '#fff', fontSize: 23, textAlign: 'center', marginTop: 24 },
  scoreRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  scoreVs: { fontSize: 26, textAlign: 'center' },
  scoreBox: { flex: 1, maxWidth: 110, height: 74 },
  scoreFill: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
    borderRadius: 12,
    backgroundColor: '#07040D',
  },
  scoreInput: {
    ...StyleSheet.absoluteFillObject,
    color: '#fff',
    fontSize: 32,
    textAlign: 'center',
    padding: 0,
  },
  sheetConfirm: { marginTop: 48 },
  sheetConfirmGame: { marginTop: 32 },
  hintRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  hint: { color: '#6B6B6B', fontSize: 12, textAlign: 'center' },
  infoIcon: { width: 16, height: 16 },
  navWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  nav: {
    width: 260,
    height: NAV_HEIGHT,
    padding: 5,
    flexDirection: 'row',
    shadowColor: '#5A129E',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  navSolid: { backgroundColor: 'rgba(14,8,28,0.97)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)' },
  navItem: {
    flex: 1,
    borderRadius: (NAV_HEIGHT - 10) / 2,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  navActive: { ...StyleSheet.absoluteFillObject },
  navText: { color: '#8A8794', fontSize: 14 },
  navTextOn: { color: '#FFFFFF' },
});
