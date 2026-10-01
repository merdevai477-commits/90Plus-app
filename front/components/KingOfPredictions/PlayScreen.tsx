import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { KING_BUTTON_GRADIENT } from './KingBoardList';
import { KingHeader } from './KingHeader';
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
  resolved: boolean;
};

const SIDE = 22;
const VS_GRADIENT = ['#A855F7', '#633291'] as const;
const PICK_ON = [KING_PURPLE, '#513690'] as const;
const CHIP_IDLE = ['#0C051A', '#07040D'] as const;

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
  const dateKey = (Array.isArray(date) ? date[0] : date) || '';
  const router = useRouter();
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
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scoreMatch, setScoreMatch] = useState<Match | null>(null);
  const [homeText, setHomeText] = useState('');
  const [awayText, setAwayText] = useState('');

  const load = useCallback(async () => {
    setError(false);
    const dayMatches = await fetchKingMatches(dateKey || localDateKey(new Date()));
    setMatches(dayMatches);

    const token = await getTokenRef.current().catch(() => null);
    if (!token) {
      setSaved({});
      setPicks({});
      return;
    }
    const preds = await PredictionsService.getUserPredictions(token);
    const nextSaved: Record<string, SavedRow> = {};
    const nextPicks: Record<string, Pick> = {};
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
        resolved: row.isCorrect != null,
      };
      if (row.prediction?.type) nextPicks[match.id] = row.prediction.type;
    }
    setSaved(nextSaved);
    setPicks(nextPicks);
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

  const explain = useCallback((err: unknown) => {
    const api = err instanceof PredictionApiError ? err : null;
    const reason = String(api?.details?.reason ?? '');
    if (api?.code === 'E006' || reason === 'DAILY_LIMIT_REACHED') {
      Alert.alert(copy.limit);
      return;
    }
    if (reason === 'MATCH_STARTED' || reason === 'ALREADY_RESOLVED') {
      Alert.alert(copy.started);
      return;
    }
    if (api?.code === 'E002') {
      Alert.alert(copy.signIn);
      return;
    }
    Alert.alert(copy.loadError);
  }, [copy]);

  const submitOne = useCallback(async (
    token: string,
    match: Match,
    body: { predictionType: Pick; predictedHomeScore?: number; predictedAwayScore?: number },
  ) => {
    return PredictionsService.submitPrediction(token, {
      apiMatchId: match.id,
      predictionType: body.predictionType,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeTeamLogo: match.homeTeam.logo,
      awayTeamLogo: match.awayTeam.logo,
      matchDate: match.fixtureDate || new Date().toISOString(),
      leagueName: match.league?.name,
      predictedHomeScore: body.predictedHomeScore,
      predictedAwayScore: body.predictedAwayScore,
    });
  }, []);

  const isLocked = useCallback(
    (match: Match) => started(match) || saved[match.id]?.resolved === true,
    [saved],
  );

  const confirmPicks = useCallback(async () => {
    const pending = matches.filter((match) => {
      const pick = picks[match.id];
      return pick && !isLocked(match) && pick !== saved[match.id]?.type;
    });
    if (pending.length === 0) return;
    const token = await getToken();
    if (!token || !isSignedIn) {
      Alert.alert(copy.signIn);
      return;
    }
    setBusy(true);
    let saves = 0;
    try {
      for (const match of pending) {
        await submitOne(token, match, { predictionType: picks[match.id] });
        saves += 1;
      }
      Alert.alert(copy.saved);
    } catch (err) {
      explain(err);
    } finally {
      if (saves > 0) await load().catch(() => undefined);
      setBusy(false);
    }
  }, [copy, explain, getToken, isLocked, isSignedIn, load, matches, picks, saved, submitOne]);

  const openScore = (match: Match) => {
    const prev = saved[match.id];
    setHomeText(prev?.home != null ? String(prev.home) : '');
    setAwayText(prev?.away != null ? String(prev.away) : '');
    setScoreMatch(match);
  };

  const confirmScore = useCallback(async () => {
    const match = scoreMatch;
    const home = parseScore(homeText);
    const away = parseScore(awayText);
    if (!match || home == null || away == null) return;
    const token = await getToken();
    if (!token || !isSignedIn) {
      Alert.alert(copy.signIn);
      return;
    }
    setBusy(true);
    try {
      const predictionType: Pick = home > away ? 'home' : away > home ? 'away' : 'draw';
      const result = await submitOne(token, match, {
        predictionType,
        predictedHomeScore: home,
        predictedAwayScore: away,
      });
      setScoreMatch(null);
      Alert.alert(result.updated ? copy.updated : copy.saved);
      await load().catch(() => undefined);
    } catch (err) {
      explain(err);
    } finally {
      setBusy(false);
    }
  }, [awayText, copy, explain, getToken, homeText, isSignedIn, load, scoreMatch, submitOne]);

  const onFooter = () => {
    if (mode === 'game') {
      void confirmPicks();
      return;
    }
    if (router.canGoBack()) router.back();
  };

  const scoreReady = parseScore(homeText) != null && parseScore(awayText) != null;

  return (
    <View style={styles.root}>
      <KingHeader />
      <LinearGradient colors={KING_BUTTON_GRADIENT} style={styles.pill}>
        <Text style={[styles.pillText, { fontFamily: fontSemi }]}>{copy.majorLeagues}</Text>
      </LinearGradient>

      {loading ? (
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
          contentContainerStyle={[
            mode === 'game' ? styles.gameList : styles.cardList,
            { paddingBottom: Math.max(insets.bottom, 16) + 130 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {matches.map((match) => {
            const locked = isLocked(match);
            if (mode === 'game') {
              const pick = picks[match.id];
              return (
                <View key={match.id} style={[styles.gameRow, locked && styles.locked]}>
                  <TeamChip
                    name={match.awayTeam.name}
                    logo={match.awayTeam.logo}
                    logoFirst
                    selected={pick === 'away'}
                    disabled={locked || busy}
                    fonts={{ on: fontBold, off: fontSemi }}
                    onPress={() => setPicks((prev) => ({ ...prev, [match.id]: 'away' }))}
                  />
                  <Pressable
                    disabled={locked || busy}
                    onPress={() => setPicks((prev) => ({ ...prev, [match.id]: 'draw' }))}
                    accessibilityLabel={copy.draw}
                  >
                    {pick === 'draw' ? (
                      <LinearGradient colors={PICK_ON} style={styles.drawCircle}>
                        <Text style={[styles.drawText, { fontFamily: fontSemi }]}>{copy.draw}</Text>
                      </LinearGradient>
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
                  <TeamChip
                    name={match.homeTeam.name}
                    logo={match.homeTeam.logo}
                    selected={pick === 'home'}
                    disabled={locked || busy}
                    fonts={{ on: fontBold, off: fontSemi }}
                    onPress={() => setPicks((prev) => ({ ...prev, [match.id]: 'home' }))}
                  />
                </View>
              );
            }

            const prev = saved[match.id];
            const hasScore = prev?.home != null && prev.away != null;
            const label = hasScore ? `${prev.away} - ${prev.home}` : locked ? copy.closed : copy.predictNow;
            return (
              <LinearGradient key={match.id} colors={CHIP_IDLE} style={styles.card}>
                <CardTeam name={match.awayTeam.name} logo={match.awayTeam.logo} font={fontBold} size={13} />
                <View style={styles.cardMid}>
                  <PWGradientText colors={VS_GRADIENT} style={[styles.vs, { fontFamily: fontSemi }]}>
                    {copy.vs}
                  </PWGradientText>
                  <Text style={[styles.time, { fontFamily: fontMedium }]}>{match.time || ''}</Text>
                  <Pressable disabled={locked || busy} onPress={() => openScore(match)}>
                    <LinearGradient colors={PICK_ON} style={[styles.predictBtn, locked && styles.locked]}>
                      <Text
                        style={[styles.predictText, { fontFamily: fontBold }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        {label}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
                <CardTeam name={match.homeTeam.name} logo={match.homeTeam.logo} font={fontBold} size={14} />
              </LinearGradient>
            );
          })}
        </ScrollView>
      )}

      {!loading && matches.length > 0 ? (
        <LinearGradient
          colors={['rgba(18,5,48,0)', '#180544']}
          pointerEvents="box-none"
          style={[styles.footer, { height: 130 + Math.max(insets.bottom, 12), paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
        >
          <Pressable disabled={busy} onPress={onFooter}>
            <LinearGradient colors={KING_BUTTON_GRADIENT} style={[styles.footerBtn, busy && styles.locked]}>
              <Text style={[styles.footerText, { fontFamily: fontSemi }]}>{copy.confirm}</Text>
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      ) : null}

      <Modal visible={scoreMatch != null} transparent animationType="fade" onRequestClose={() => setScoreMatch(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setScoreMatch(null)} />
          <LinearGradient colors={CHIP_IDLE} style={styles.sheet}>
            <Pressable onPress={() => setScoreMatch(null)} style={styles.close} hitSlop={8}>
              <Image source={KING_ICON.close} style={styles.closeIcon} contentFit="contain" />
            </Pressable>
            <Text style={[styles.sheetTitle, { fontFamily: fontSemi }]}>{copy.sheetTitle}</Text>
            {scoreMatch ? (
              <View style={styles.sheetTeams}>
                <SheetTeam name={scoreMatch.awayTeam.name} logo={scoreMatch.awayTeam.logo} font={fontSemi} />
                <View style={styles.sheetMid}>
                  <PWGradientText colors={VS_GRADIENT} style={[styles.vs, { fontFamily: fontSemi }]}>
                    {copy.vs}
                  </PWGradientText>
                  <Text style={[styles.time, { fontFamily: fontMedium }]}>{scoreMatch.time || ''}</Text>
                </View>
                <SheetTeam name={scoreMatch.homeTeam.name} logo={scoreMatch.homeTeam.logo} font={fontSemi} />
              </View>
            ) : null}
            <Text style={[styles.resultTitle, { fontFamily: fontSemi }]}>{copy.matchResult}</Text>
            <View style={styles.scoreRow}>
              <ScoreInput value={awayText} onChange={setAwayText} font={fontBold} />
              <PWGradientText colors={VS_GRADIENT} style={[styles.scoreVs, { fontFamily: fontSemi }]}>
                {copy.vs}
              </PWGradientText>
              <ScoreInput value={homeText} onChange={setHomeText} font={fontBold} />
            </View>
            <Pressable disabled={!scoreReady || busy} onPress={() => { void confirmScore(); }} style={styles.sheetConfirm}>
              <LinearGradient colors={KING_BUTTON_GRADIENT} style={[styles.footerBtn, (!scoreReady || busy) && styles.locked]}>
                <Text style={[styles.footerText, { fontFamily: fontSemi }]}>{copy.confirm}</Text>
              </LinearGradient>
            </Pressable>
            <View style={styles.hintRow}>
              <Text style={[styles.hint, { fontFamily: fontRegular }]}>{copy.editHint}</Text>
              <Image source={KING_ICON.info} style={styles.infoIcon} contentFit="contain" />
            </View>
          </LinearGradient>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function TeamChip({
  name,
  logo,
  logoFirst,
  selected,
  disabled,
  fonts,
  onPress,
}: {
  name: string;
  logo?: string;
  logoFirst?: boolean;
  selected: boolean;
  disabled: boolean;
  fonts: { on: string; off: string };
  onPress: () => void;
}) {
  const crest = logo ? (
    <Image source={{ uri: logo }} style={styles.chipLogo} contentFit="contain" />
  ) : (
    <View style={styles.chipLogo} />
  );
  const label = (
    <Text
      style={[styles.chipName, { fontFamily: selected ? fonts.on : fonts.off }, selected && styles.chipNameOn]}
      numberOfLines={1}
    >
      {name}
    </Text>
  );
  return (
    <Pressable disabled={disabled} onPress={onPress} style={styles.chipCell}>
      <LinearGradient
        colors={selected ? PICK_ON : CHIP_IDLE}
        style={[styles.chip, !selected && styles.chipIdle]}
      >
        {logoFirst ? crest : label}
        {logoFirst ? label : crest}
      </LinearGradient>
    </Pressable>
  );
}

function CardTeam({ name, logo, font, size }: { name: string; logo?: string; font: string; size: number }) {
  return (
    <View style={styles.cardTeam}>
      {logo ? <Image source={{ uri: logo }} style={styles.cardLogo} contentFit="contain" /> : <View style={styles.cardLogo} />}
      <Text
        style={[styles.cardName, { fontFamily: font, fontSize: size }]}
        numberOfLines={singleWord(name) ? 1 : 2}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {name}
      </Text>
    </View>
  );
}

function singleWord(name: string) {
  return !/\s/.test(name.trim());
}

function SheetTeam({ name, logo, font }: { name: string; logo?: string; font: string }) {
  return (
    <View style={styles.sheetTeam}>
      {logo ? <Image source={{ uri: logo }} style={styles.sheetLogo} contentFit="contain" /> : <View style={styles.sheetLogo} />}
      <Text
        style={[styles.sheetName, { fontFamily: font }]}
        numberOfLines={singleWord(name) ? 1 : 2}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {name}
      </Text>
    </View>
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
  pill: {
    marginTop: 14,
    marginHorizontal: SIDE,
    height: 58,
    borderRadius: 16,
    paddingHorizontal: 23,
    justifyContent: 'center',
  },
  pillText: { color: '#fff', fontSize: 19, textAlign: 'right' },
  center: { marginTop: 48, alignItems: 'center' },
  muted: { color: '#A1A1AA', fontSize: 15, textAlign: 'center' },
  retry: { color: KING_PURPLE, marginTop: 8, fontSize: 15 },
  gameList: { paddingHorizontal: SIDE, paddingTop: 37, gap: 10 },
  cardList: { paddingHorizontal: SIDE, paddingTop: 19, gap: 12 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locked: { opacity: 0.45 },
  chipCell: { flex: 1 },
  chip: {
    height: 54,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  chipIdle: { borderWidth: 1, borderColor: '#0F0F11' },
  chipLogo: { width: 35, height: 35 },
  chipName: { color: '#fff', fontSize: 14, flexShrink: 1, textAlign: 'right' },
  chipNameOn: { fontSize: 16 },
  drawCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawIdle: { borderWidth: 1, borderColor: '#6521FF' },
  drawGlow: { position: 'absolute', width: 43, height: 43, left: 4.5, top: 4.5 },
  drawX: { width: 32, height: 32 },
  drawText: { color: '#fff', fontSize: 15 },
  card: {
    height: 121,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#6D33F2',
    paddingHorizontal: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTeam: { width: 72, alignItems: 'center', gap: 9 },
  cardLogo: { width: 43, height: 43 },
  cardName: { color: '#fff', textAlign: 'center' },
  cardMid: { width: 105, alignItems: 'center' },
  vs: { fontSize: 21, textAlign: 'center' },
  time: { color: '#777', fontSize: 13, textAlign: 'center', marginTop: 4 },
  predictBtn: {
    marginTop: 9,
    width: 105,
    height: 33,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictText: { color: '#fff', fontSize: 13 },
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
    height: 101,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTeam: { width: 92, alignItems: 'center', gap: 9 },
  sheetLogo: { width: 50, height: 58 },
  sheetName: { color: '#fff', fontSize: 18, textAlign: 'center' },
  sheetMid: { width: 105, alignItems: 'center' },
  resultTitle: { color: '#fff', fontSize: 23, textAlign: 'center', marginTop: 24 },
  scoreRow: {
    marginTop: 16,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreVs: { fontSize: 26, textAlign: 'center' },
  scoreBox: { width: 95, height: 74 },
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
  hintRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  hint: { color: '#6B6B6B', fontSize: 12, textAlign: 'center' },
  infoIcon: { width: 16, height: 16 },
});
