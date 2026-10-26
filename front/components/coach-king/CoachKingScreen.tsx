import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CkApiError,
  coachKingService,
  type CkBoardRow,
  type CkCoach,
  type CkFixture,
  type CkHome,
  type CkLine,
  type CkPlayer,
} from '../../services/coachKing.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KingEmptyState, KingPeriodTabs } from '../KingOfPredictions/KingBoardList';
import type { KingPeriod } from '../../services/predictions.service';
import { CoachKingNav, ckNavBottom, type CkTab } from './CoachKingNav';
import { CoachKingPicker } from './CoachKingPicker';
import { CoachKingPitch } from './CoachKingPitch';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');
const EMPTY_HOME: CkHome = {
  user: { displayName: '—', avatar: null, level: 1, rank: null },
  wallet: {
    balanceMilli: 1000,
    remainingMilli: 1000,
    balanceLabel: '100M',
    remainingLabel: '100M',
  },
  gameweek: { id: '', status: 'OPEN', locked: false },
  squad: { confirmed: false, spentMilli: 0, points: 0, coach: null, slots: [] },
};

const LINE_OF: Record<string, CkLine> = {
  lw: 'FWD', st: 'FWD', rw: 'FWD',
  cm1: 'MID', cm2: 'MID', cm3: 'MID',
  lb: 'DEF', cb1: 'DEF', cb2: 'DEF', rb: 'DEF',
  gk: 'GK',
};

function reasonKey(reason: string | null): 'budget' | 'started' | 'incomplete' | 'locked' | 'generic' {
  if (reason === 'BUDGET') return 'budget';
  if (reason === 'MATCH_STARTED') return 'started';
  if (reason === 'INCOMPLETE' || reason === 'MISSING_COACH') return 'incomplete';
  if (reason === 'SQUAD_LOCKED') return 'locked';
  return 'generic';
}

export default function CoachKingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { t, language } = useTranslation();
  const copy = t.coachKingGame;
  const isAr = language === 'ar';
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  const fontBold = useAppFont(700);

  const [tab, setTab] = useState<CkTab>('pitch');
  const [home, setHome] = useState<CkHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<CkLine | 'COACH' | null>(null);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [period, setPeriod] = useState<KingPeriod>('week');
  const [board, setBoard] = useState<CkBoardRow[]>([]);
  const [fixtures, setFixtures] = useState<CkFixture[]>([]);

  const tokenOf = useCallback(async () => {
    if (!isSignedIn) return null;
    return getTokenRef.current().catch(() => null);
  }, [isSignedIn]);

  const loadHome = useCallback(async () => {
    const nextToken = await tokenOf();
    if (!nextToken) {
      setLoading(false);
      return;
    }
    try {
      setHome(await coachKingService.getHome(nextToken, language));
      setError(null);
    } catch (err) {
      const detail = err instanceof CkApiError ? `${err.code} ${err.reason ?? ''} ${err.message}` : String(err);
      console.warn('[CoachKing] home failed', detail);
      setError(copy.generic);
    } finally {
      setLoading(false);
    }
  }, [tokenOf, language, copy.generic]);

  useFocusEffect(useCallback(() => {
    void loadHome();
  }, [loadHome]));

  const loadSide = useCallback(async (next: CkTab, nextPeriod = period) => {
    const token = await tokenOf();
    if (!token) return;
    if (next === 'ranking') {
      setBoard(await coachKingService.getLeaderboard(token, nextPeriod).catch(() => []));
    }
    if (next === 'matches') {
      setFixtures(await coachKingService.getFixtures(token, language).catch(() => []));
    }
  }, [tokenOf, period, language]);

  const onTab = (next: CkTab) => {
    setTab(next);
    void loadSide(next);
  };

  const explain = (err: unknown) => {
    const reason = err instanceof CkApiError ? err.reason : null;
    const key = reasonKey(reason);
    setError(copy[key]);
  };

  const persist = async (coachId: string | null, slots: Array<{ slotKey: string; playerId: string }>) => {
    const token = await tokenOf();
    if (!token) return;
    setBusy(true);
    try {
      setHome(await coachKingService.saveSquad(token, language, { coachId, slots }));
      setError(null);
    } catch (err) {
      explain(err);
    } finally {
      setBusy(false);
    }
  };

  const slotsOf = (current: CkHome) => current.squad.slots.map((slot) => ({
    slotKey: slot.slotKey,
    playerId: slot.player.id,
  }));

  const onPickPlayer = (player: CkPlayer) => {
    if (!home || !slotKey || home.squad.confirmed) return;
    const slots = slotsOf(home).filter((slot) => slot.slotKey !== slotKey && slot.playerId !== player.id);
    slots.push({ slotKey, playerId: player.id });
    setPicker(null);
    void persist(home.squad.coach?.id ?? null, slots);
  };

  const onPickCoach = (coach: CkCoach) => {
    if (!home || home.squad.confirmed) return;
    setPicker(null);
    void persist(coach.id, slotsOf(home));
  };

  const onClear = (key: string) => {
    if (!home || home.squad.confirmed) return;
    void persist(home.squad.coach?.id ?? null, slotsOf(home).filter((slot) => slot.slotKey !== key));
  };

  const onConfirm = async () => {
    const token = await tokenOf();
    if (!token || !home || home.squad.confirmed) return;
    if (home.squad.slots.length < 11 || !home.squad.coach) {
      setError(copy.incomplete);
      return;
    }
    setBusy(true);
    try {
      setHome(await coachKingService.confirm(token, language));
      setError(null);
    } catch (err) {
      explain(err);
    } finally {
      setBusy(false);
    }
  };

  const bottomPad = ckNavBottom(insets.bottom) + 92;
  const shown = home ?? (!loading ? EMPTY_HOME : null);

  return (
    <View style={styles.root} testID="coach-king-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" testID="ck-back">
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={26} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: fontSemi }]}>{copy.title}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading && !home ? <ActivityIndicator color="#8C5CF6" style={{ marginTop: 40 }} /> : null}
      {error && !home ? <Text style={[styles.error, { fontFamily: fontMed }]}>{error}</Text> : null}

      {tab === 'pitch' && shown ? (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
          <CoachKingPitch
            slots={shown.squad.slots}
            coach={shown.squad.coach}
            confirmed={shown.squad.confirmed || shown.gameweek.locked}
            userName={shown.user.displayName}
            avatar={shown.user.avatar}
            levelLabel={`${copy.level} ${shown.user.level}`}
            rankLabel={shown.user.rank ? `#${shown.user.rank}` : '—'}
            budgetLabel={copy.budgetLabel}
            remainingLabel={shown.wallet.remainingLabel}
            ofLabel={copy.budgetOf.replace('{bank}', shown.wallet.balanceLabel)}
            coachLabel={copy.coach}
            formation={copy.formation}
            remainingNegative={shown.wallet.remainingMilli < 0}
            onSlot={(key) => {
              setSlotKey(key);
              setPicker(LINE_OF[key] ?? 'FWD');
            }}
            onCoach={() => setPicker('COACH')}
            onClear={onClear}
          />
          {error && home ? <Text style={[styles.error, { fontFamily: fontMed }]}>{error}</Text> : null}
          <Pressable
            onPress={onConfirm}
            disabled={busy || !home || shown.squad.confirmed || shown.gameweek.locked}
            testID="ck-confirm"
            style={({ pressed }) => [styles.ctaHit, pressed && { opacity: 0.9 }]}
          >
            <LinearGradient colors={['#8B5CF6', '#2E146A']} style={styles.cta}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={[styles.ctaTxt, { fontFamily: fontSemi }]}>
                {shown.squad.confirmed ? copy.confirmed : copy.confirm}
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      ) : null}

      {tab === 'ranking' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
          <KingPeriodTabs
            period={period}
            weekLabel={copy.week}
            allLabel={copy.all}
            onChange={(next) => {
              setPeriod(next);
              void loadSide('ranking', next);
            }}
          />
          {board.length === 0 ? (
            <KingEmptyState title={copy.noRanking} actionLabel={copy.tabs.pitch} onAction={() => onTab('pitch')} />
          ) : board.map((row) => (
            <View key={`${row.rank}-${row.name}`} style={[styles.boardRow, row.isMe && styles.boardMe]}>
              <Text style={[styles.rank, { fontFamily: fontBold }]}>{row.rank}</Text>
              <Image source={row.avatar ? { uri: row.avatar } : PLACEHOLDER} style={styles.boardAvatar} />
              <Text style={[styles.boardName, { fontFamily: fontSemi }]} numberOfLines={1}>{row.name}</Text>
              <Text style={[styles.boardPts, { fontFamily: fontBold }]}>{row.points}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {tab === 'matches' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
          {fixtures.length === 0 ? (
            <KingEmptyState title={copy.noMatches} actionLabel={copy.tabs.pitch} onAction={() => onTab('pitch')} />
          ) : fixtures.map((fixture) => (
            <View key={fixture.fixtureId} style={styles.match}>
              <Text style={[styles.matchDate, { fontFamily: fontMed }]}>
                {new Date(fixture.kickoffAt).toLocaleString(isAr ? 'ar' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
              <View style={styles.matchTeams}>
                <Text style={[styles.team, { fontFamily: fontSemi }]} numberOfLines={1}>{fixture.homeName}</Text>
                <Text style={[styles.score, { fontFamily: fontBold }]}>
                  {fixture.homeScore == null ? fixture.status : `${fixture.homeScore} - ${fixture.awayScore}`}
                </Text>
                <Text style={[styles.team, { fontFamily: fontSemi, textAlign: 'right' }]} numberOfLines={1}>{fixture.awayName}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <CoachKingPicker
        resolveToken={tokenOf}
        lang={language}
        line={picker}
        onClose={() => setPicker(null)}
        onPickPlayer={onPickPlayer}
        onPickCoach={onPickCoach}
      />
      <CoachKingNav active={tab} onChange={onTab} />
      {busy ? <ActivityIndicator color="#8C5CF6" style={styles.busy} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030303' },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: '#0D051A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 20 },
  error: { color: '#F87171', textAlign: 'center', marginHorizontal: 20, marginTop: 8 },
  ctaHit: { marginHorizontal: 22, marginTop: 16 },
  cta: {
    height: 58,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaTxt: { color: '#fff', fontSize: 19 },
  boardRow: {
    marginTop: 8,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#0A001C',
    borderWidth: 0.5,
    borderColor: '#241152',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  boardMe: { borderColor: 'rgba(140,92,245,0.7)' },
  rank: { color: '#fff', width: 28, textAlign: 'center' },
  boardAvatar: { width: 36, height: 36, borderRadius: 18 },
  boardName: { color: '#fff', flex: 1, fontSize: 15 },
  boardPts: { color: '#E9D5FF', fontSize: 16 },
  match: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#08050E',
    borderWidth: 0.5,
    borderColor: '#1B1B1B',
    padding: 14,
  },
  matchDate: { color: '#E6CEFD', fontSize: 12, marginBottom: 8 },
  matchTeams: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  team: { color: '#fff', flex: 1, fontSize: 14 },
  score: { color: '#fff', fontSize: 16 },
  busy: { position: 'absolute', top: 120, alignSelf: 'center' },
});
