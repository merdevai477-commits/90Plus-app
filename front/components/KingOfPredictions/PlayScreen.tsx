import { Image } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';

import { fetchMatchesByDate } from '../Matches/leagueApiUtils';
import type { Match } from '../Matches/matchCardUtils';
import { PredictionApiError, PredictionsService } from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KingHeader } from './KingHeader';
import {
  KING_BG,
  KING_CARD,
  KING_LEAGUE_IDS,
  KING_PURPLE,
  parseKingMode,
} from './shared';

type Pick = 'home' | 'draw' | 'away';

type ScoreDraft = { home: number | null; away: number | null };

type SavedRow = {
  type?: Pick;
  home: number | null;
  away: number | null;
  resolved: boolean;
};

function started(match: Match): boolean {
  if (match.status === 'live' || match.status === 'finished') return true;
  if (!match.fixtureDate) return false;
  const kickoff = new Date(match.fixtureDate).getTime();
  return Number.isFinite(kickoff) && kickoff <= Date.now();
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
  const insets = useSafeAreaInsets();
  const { getToken, isSignedIn } = useAuth();
  const { t } = useTranslation();
  const copy = t.kingPredictions;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);

  const [matches, setMatches] = useState<Match[]>([]);
  const [saved, setSaved] = useState<Record<string, SavedRow>>({});
  const [scores, setScores] = useState<Record<string, ScoreDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sheetMatch, setSheetMatch] = useState<Match | null>(null);
  const [sheetPick, setSheetPick] = useState<Pick | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const when = dateKey ? new Date(`${dateKey}T12:00:00`) : new Date();
    const list = await fetchMatchesByDate(when);
    const leagueSet = new Set<number>(KING_LEAGUE_IDS);
    const dayMatches = list.filter((match) => leagueSet.has(match.league?.id)).slice(0, 10);
    setMatches(dayMatches);

    const token = await getToken().catch(() => null);
    if (!token) {
      setSaved({});
      setScores({});
      return;
    }
    const preds = await PredictionsService.getUserPredictions(token);
    const nextSaved: Record<string, SavedRow> = {};
    const nextScores: Record<string, ScoreDraft> = {};
    for (const match of dayMatches) {
      const row = (preds.predictionsMap as Record<string, {
        prediction?: { type?: Pick };
        predictedHomeScore?: number | null;
        predictedAwayScore?: number | null;
        isCorrect?: boolean | null;
      }>)[match.id];
      if (!row) {
        nextScores[match.id] = { home: null, away: null };
        continue;
      }
      const home = row.predictedHomeScore ?? null;
      const away = row.predictedAwayScore ?? null;
      nextSaved[match.id] = {
        type: row.prediction?.type,
        home,
        away,
        resolved: row.isCorrect != null,
      };
      nextScores[match.id] = { home, away };
    }
    setSaved(nextSaved);
    setScores(nextScores);
  }, [dateKey, getToken]);

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
    match: Match,
    body: { predictionType: Pick; predictedHomeScore?: number; predictedAwayScore?: number },
    options?: { silent?: boolean },
  ): Promise<boolean> => {
    const token = await getToken();
    if (!token || !isSignedIn) {
      if (!options?.silent) Alert.alert(copy.signIn);
      return false;
    }
    if (!options?.silent) setBusy(true);
    try {
      const result = await PredictionsService.submitPrediction(token, {
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
      if (!options?.silent) {
        Alert.alert(result.updated ? copy.updated : copy.saved);
        await load();
      }
      return true;
    } catch (err) {
      if (!options?.silent) explain(err);
      else throw err;
    } finally {
      if (!options?.silent) setBusy(false);
    }
    return false;
  }, [copy, explain, getToken, isSignedIn, load]);

  const confirmScores = useCallback(async () => {
    const pending = matches.filter((match) => {
      if (started(match) || saved[match.id]?.resolved) return false;
      const draft = scores[match.id];
      if (draft?.home == null || draft.away == null) return false;
      const prev = saved[match.id];
      return prev?.home !== draft.home || prev?.away !== draft.away;
    });
    if (pending.length === 0) return;
    const token = await getToken();
    if (!token || !isSignedIn) {
      Alert.alert(copy.signIn);
      return;
    }
    setBusy(true);
    let updated = false;
    try {
      for (const match of pending) {
        const draft = scores[match.id];
        if (draft?.home == null || draft.away == null) continue;
        const home = draft.home ?? 0;
        const away = draft.away ?? 0;
        const predictionType: Pick = home > away ? 'home' : away > home ? 'away' : 'draw';
        const ok = await submitOne(
          match,
          { predictionType, predictedHomeScore: home, predictedAwayScore: away },
          { silent: true },
        );
        updated = updated || ok;
      }
      if (updated) Alert.alert(copy.saved);
    } catch (err) {
      explain(err);
    } finally {
      if (updated) await load();
      setBusy(false);
    }
  }, [copy, explain, getToken, isSignedIn, load, matches, saved, scores, submitOne]);

  const title = mode === 'results' ? copy.resultsTitle : copy.gameTitle;

  const sheetOptions = useMemo(() => ([
    { id: 'home' as const, label: copy.homeWin },
    { id: 'draw' as const, label: copy.draw },
    { id: 'away' as const, label: copy.awayWin },
  ]), [copy]);

  return (
    <View style={styles.root}>
      <KingHeader />
      <Text style={[styles.title, { fontFamily: fontBold }]}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={KING_PURPLE} style={{ marginTop: 40 }} />
      ) : error ? (
        <Pressable onPress={() => { setLoading(true); void load().finally(() => setLoading(false)); }} style={styles.center}>
          <Text style={[styles.muted, { fontFamily: fontMedium }]}>{copy.loadError}</Text>
          <Text style={[styles.retry, { fontFamily: fontSemi }]}>{copy.retry}</Text>
        </Pressable>
      ) : matches.length === 0 ? (
        <Text style={[styles.muted, styles.center, { fontFamily: fontMedium }]}>{copy.noMatches}</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + (mode === 'results' ? 110 : 24) }}
          showsVerticalScrollIndicator={false}
        >
          {matches.map((match) => {
            const locked = started(match) || saved[match.id]?.resolved === true;
            if (mode === 'game') {
              const current = saved[match.id]?.type;
              const label = current === 'home' ? copy.homeWin : current === 'away' ? copy.awayWin : current === 'draw' ? copy.draw : copy.predictNow;
              return (
                <View key={match.id} style={styles.matchCard}>
                  <TeamSide name={match.homeTeam.name} logo={match.homeTeam.logo} font={fontSemi} />
                  <View style={styles.mid}>
                    <Text style={[styles.vs, { fontFamily: fontBold }]}>{copy.vs}</Text>
                    <Text style={[styles.time, { fontFamily: fontMedium }]}>{match.time || ''}</Text>
                    <Pressable
                      disabled={locked || busy}
                      onPress={() => {
                        setSheetPick(current ?? null);
                        setSheetMatch(match);
                      }}
                      style={[styles.predictBtn, locked && styles.predictBtnOff]}
                    >
                      <Text style={[styles.predictText, { fontFamily: fontSemi }]}>
                        {locked && !current ? copy.closed : label}
                      </Text>
                    </Pressable>
                  </View>
                  <TeamSide name={match.awayTeam.name} logo={match.awayTeam.logo} font={fontSemi} />
                </View>
              );
            }

            const draft = scores[match.id] ?? { home: null, away: null };
            return (
              <View key={match.id} style={styles.scoreRow}>
                <TeamSide name={match.homeTeam.name} logo={match.homeTeam.logo} font={fontSemi} compact />
                <ScoreBox
                  value={draft.home}
                  disabled={locked || busy}
                  onChange={(home) => setScores((prev) => ({ ...prev, [match.id]: { ...draft, home } }))}
                />
                <Text style={[styles.vs, { fontFamily: fontBold }]}>{copy.vs}</Text>
                <ScoreBox
                  value={draft.away}
                  disabled={locked || busy}
                  onChange={(away) => setScores((prev) => ({ ...prev, [match.id]: { ...draft, away } }))}
                />
                <TeamSide name={match.awayTeam.name} logo={match.awayTeam.logo} font={fontSemi} compact />
              </View>
            );
          })}
        </ScrollView>
      )}

      {mode === 'results' && !loading && matches.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={styles.footerBtn} disabled={busy} onPress={() => { void confirmScores(); }}>
            <Text style={[styles.footerText, { fontFamily: fontBold }]}>{copy.confirm}</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={sheetMatch != null} transparent animationType="slide" onRequestClose={() => setSheetMatch(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheetMatch(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={[styles.sheetTitle, { fontFamily: fontBold }]}>{copy.sheetTitle}</Text>
            {sheetMatch ? (
              <View style={styles.sheetTeams}>
                <TeamSide name={sheetMatch.homeTeam.name} logo={sheetMatch.homeTeam.logo} font={fontSemi} />
                <Text style={[styles.vs, { fontFamily: fontBold }]}>{copy.vs}</Text>
                <TeamSide name={sheetMatch.awayTeam.name} logo={sheetMatch.awayTeam.logo} font={fontSemi} />
              </View>
            ) : null}
            {sheetOptions.map((option) => {
              const on = sheetPick === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSheetPick(option.id)}
                  style={[styles.option, on && styles.optionOn]}
                >
                  <Text style={[styles.optionText, { fontFamily: fontSemi }]}>{option.label}</Text>
                </Pressable>
              );
            })}
            <Pressable
              disabled={!sheetPick || busy || !sheetMatch}
              style={[styles.footerBtn, (!sheetPick || busy) && styles.predictBtnOff]}
              onPress={() => {
                if (!sheetMatch || !sheetPick) return;
                const match = sheetMatch;
                const pick = sheetPick;
                setSheetMatch(null);
                void submitOne(match, { predictionType: pick });
              }}
            >
              <Text style={[styles.footerText, { fontFamily: fontBold }]}>{copy.confirm}</Text>
            </Pressable>
            <Text style={[styles.hint, { fontFamily: fontMedium }]}>{copy.editHint}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function TeamSide({
  name,
  logo,
  font,
  compact,
}: {
  name: string;
  logo?: string;
  font: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.team, compact && styles.teamCompact]}>
      {logo ? <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" /> : <View style={styles.logo} />}
      <Text style={[styles.teamName, { fontFamily: font }]} numberOfLines={2}>{name}</Text>
    </View>
  );
}

function ScoreBox({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  const fontBold = useAppFont(700);
  const current = value ?? 0;
  return (
    <View style={styles.scoreBox}>
      <Pressable disabled={disabled} onPress={() => onChange(Math.min(20, (value ?? -1) + 1))}>
        <Text style={styles.step}>+</Text>
      </Pressable>
      <Text style={[styles.scoreValue, { fontFamily: fontBold }]}>{value == null ? '_' : String(current)}</Text>
      <Pressable disabled={disabled || value == null} onPress={() => onChange(Math.max(0, current - 1))}>
        <Text style={styles.step}>−</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KING_BG },
  title: { color: '#fff', fontSize: 22, textAlign: 'center', marginBottom: 8 },
  center: { marginTop: 48, alignItems: 'center' },
  muted: { color: '#A1A1AA', fontSize: 15, textAlign: 'center' },
  retry: { color: KING_PURPLE, marginTop: 8, fontSize: 15 },
  matchCard: {
    marginHorizontal: 22,
    marginBottom: 12,
    backgroundColor: KING_CARD,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: KING_CARD,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  team: { flex: 1, alignItems: 'center' },
  teamCompact: { flex: 1 },
  logo: { width: 36, height: 36 },
  teamName: { color: '#fff', fontSize: 12, textAlign: 'center', marginTop: 4 },
  mid: { width: 110, alignItems: 'center' },
  vs: { color: '#fff', fontSize: 16 },
  time: { color: '#A1A1AA', fontSize: 12, marginTop: 2 },
  predictBtn: {
    marginTop: 8,
    backgroundColor: KING_PURPLE,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  predictBtnOff: { opacity: 0.45 },
  predictText: { color: '#fff', fontSize: 12 },
  scoreBox: { width: 36, alignItems: 'center' },
  scoreValue: { color: '#fff', fontSize: 20 },
  step: { color: KING_PURPLE, fontSize: 18, paddingHorizontal: 6 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 23,
    paddingTop: 10,
    backgroundColor: 'rgba(3,3,3,0.94)',
  },
  footerBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: KING_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: { color: '#fff', fontSize: 18 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#12081F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
  },
  sheetTitle: { color: '#fff', fontSize: 20, textAlign: 'center', marginBottom: 12 },
  sheetTeams: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  option: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  optionOn: { backgroundColor: KING_PURPLE, borderColor: KING_PURPLE },
  optionText: { color: '#fff', fontSize: 16 },
  hint: { color: '#A1A1AA', fontSize: 12, textAlign: 'center', marginTop: 10 },
});
