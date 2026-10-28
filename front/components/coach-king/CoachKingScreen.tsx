import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CK_LEAGUE_KEYS,
  CkApiError,
  coachKingService,
  type CkBoardRow,
  type CkCoach,
  type CkFixture,
  type CkHome,
  type CkLeagueKey,
  type CkLine,
  type CkPlayer,
  type CkPoolKind,
} from '../../services/coachKing.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { pushPlayerCareer } from '../../utils/openPlayerProfile';
import { KingEmptyState, KingPeriodTabs } from '../KingOfPredictions/KingBoardList';
import type { KingPeriod } from '../../services/predictions.service';
import { CoachKingCardGrid, type CkPick } from './CoachKingCardGrid';
import { CoachKingLeagueChips } from './CoachKingLeagueChips';
import { CoachKingMoney } from './CoachKingCoin';
import { CoachKingLockedSheet, type CkLockedNotice } from './CoachKingLockedSheet';
import { CoachKingNav, ckNavBottom, type CkTab } from './CoachKingNav';
import { CoachKingPitch } from './CoachKingPitch';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');
const CLUB_LIMIT = 3;
const EMPTY_HOME: CkHome = {
  user: { displayName: '—', avatar: null, level: 1, rank: null },
  wallet: { balanceMilli: 1000, remainingMilli: 1000, balanceLabel: '100M', remainingLabel: '100M' },
  gameweek: { id: '', status: 'OPEN', locked: false },
  squad: { confirmed: false, spentMilli: 0, points: 0, coach: null, slots: [] },
};

const LINE_OF: Record<string, CkLine> = {
  lw: 'FWD', st: 'FWD', rw: 'FWD',
  cm1: 'MID', cm2: 'MID', cm3: 'MID',
  lb: 'DEF', cb1: 'DEF', cb2: 'DEF', rb: 'DEF',
  gk: 'GK',
};

type ErrorKey = 'budget' | 'clubLimit' | 'started' | 'slotLocked' | 'duplicate' | 'weekClosed' | 'generic';

function errorKey(reason: string | null): ErrorKey {
  if (reason === 'BUDGET') return 'budget';
  if (reason === 'CLUB_LIMIT') return 'clubLimit';
  if (reason === 'MATCH_STARTED') return 'started';
  if (reason === 'SLOT_LOCKED') return 'slotLocked';
  if (reason === 'DUPLICATE_PLAYER') return 'duplicate';
  if (reason === 'SQUAD_LOCKED') return 'weekClosed';
  return 'generic';
}

function withPick(home: CkHome, pick: CkPick, slotKey: string | null): CkHome {
  const price = pick.priceMilli;
  if (pick.kind === 'COACH') {
    const refund = home.squad.coach?.pricePaidMilli ?? 0;
    const delta = price - refund;
    return {
      ...home,
      wallet: { ...home.wallet, remainingMilli: home.wallet.remainingMilli - delta },
      squad: {
        ...home.squad,
        confirmed: true,
        spentMilli: home.squad.spentMilli + delta,
        coach: { ...(pick as CkCoach), locked: true, pricePaidMilli: price, points: 0 },
      },
    };
  }
  const current = home.squad.slots.find((slot) => slot.slotKey === slotKey);
  const delta = price - (current?.pricePaidMilli ?? 0);
  const others = home.squad.slots.filter((slot) => slot.slotKey !== slotKey);
  return {
    ...home,
    wallet: { ...home.wallet, remainingMilli: home.wallet.remainingMilli - delta },
    squad: {
      ...home.squad,
      confirmed: true,
      spentMilli: home.squad.spentMilli + delta,
      slots: [
        ...others,
        { slotKey: slotKey!, label: slotKey!, locked: true, pricePaidMilli: price, points: 0, player: pick as CkPlayer },
      ],
    },
  };
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
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<CkPoolKind | null>(null);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [locked, setLocked] = useState<(CkLockedNotice & { player: CkPlayer | null }) | null>(null);
  const [period, setPeriod] = useState<KingPeriod>('week');
  const [board, setBoard] = useState<CkBoardRow[]>([]);
  const [fixtures, setFixtures] = useState<CkFixture[]>([]);
  const [matchLeague, setMatchLeague] = useState<CkLeagueKey | null>(null);
  const prefetched = useRef<string | null>(null);

  const tokenOf = useCallback(async () => {
    if (!isSignedIn) return null;
    return getTokenRef.current().catch(() => null);
  }, [isSignedIn]);

  const loadHome = useCallback(async () => {
    const token = await tokenOf();
    if (!token) {
      setLoading(false);
      return;
    }
    if (prefetched.current !== language) {
      prefetched.current = language;
      coachKingService.prefetchPools(token, language);
    }
    try {
      setHome(await coachKingService.getHome(token, language));
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

  const shown = home ?? (!loading ? EMPTY_HOME : null);
  const squadLeagues = useMemo(() => {
    const present = new Set<string>();
    for (const slot of shown?.squad.slots ?? []) {
      if (slot.player.leagueKey) present.add(slot.player.leagueKey);
    }
    if (shown?.squad.coach?.leagueKey) present.add(shown.squad.coach.leagueKey);
    return CK_LEAGUE_KEYS.filter((key) => present.has(key));
  }, [shown]);
  const activeMatchLeague = matchLeague && squadLeagues.includes(matchLeague) ? matchLeague : squadLeagues[0] ?? null;
  const visibleFixtures = useMemo(() => {
    if (squadLeagues.length === 0) return fixtures;
    return fixtures.filter((fixture) => fixture.leagueKey === activeMatchLeague);
  }, [fixtures, squadLeagues.length, activeMatchLeague]);
  const closed = shown?.gameweek.locked === true;
  const lockedUntil = shown?.squad.lockedUntil ?? shown?.gameweek.endAt ?? null;

  const takenIds = useMemo(() => {
    const ids = new Set<string>();
    for (const slot of shown?.squad.slots ?? []) if (slot.slotKey !== slotKey) ids.add(slot.player.id);
    if (picker === 'COACH' && shown?.squad.coach) ids.add(shown.squad.coach.id);
    return ids;
  }, [shown, slotKey, picker]);

  const refundMilli = useMemo(() => {
    if (!shown) return 0;
    if (picker === 'COACH') return shown.squad.coach?.pricePaidMilli ?? 0;
    return shown.squad.slots.find((slot) => slot.slotKey === slotKey)?.pricePaidMilli ?? 0;
  }, [shown, picker, slotKey]);

  const onSlot = (key: string) => {
    if (!shown) return;
    const slot = shown.squad.slots.find((row) => row.slotKey === key);
    if (slot?.locked) {
      setLocked({
        name: slot.player.name,
        club: slot.player.club,
        photo: slot.player.photo,
        teamLogo: slot.player.teamLogo,
        pricePaidMilli: slot.pricePaidMilli,
        points: slot.points,
        lockedUntil,
        canViewProfile: slot.player.externalPlayerId != null,
        player: slot.player,
      });
      return;
    }
    if (closed) {
      setError(copy.errors.weekClosed);
      return;
    }
    setError(null);
    setSheetError(null);
    setSlotKey(key);
    setPicker(LINE_OF[key] ?? 'FWD');
  };

  const onCoach = () => {
    const coach = shown?.squad.coach;
    if (coach?.locked) {
      setLocked({
        name: coach.name,
        club: coach.club,
        photo: coach.photo,
        teamLogo: coach.teamLogo ?? null,
        pricePaidMilli: coach.pricePaidMilli,
        points: coach.points,
        lockedUntil,
        canViewProfile: false,
        player: null,
      });
      return;
    }
    if (closed) {
      setError(copy.errors.weekClosed);
      return;
    }
    setError(null);
    setSheetError(null);
    setSlotKey(null);
    setPicker('COACH');
  };

  const onConfirm = async (pick: CkPick) => {
    if (!home) return;
    if (pick.kind !== 'COACH') {
      if (takenIds.has(pick.id)) {
        setSheetError(copy.errors.duplicate);
        return;
      }
      const sameClub = home.squad.slots.filter((slot) => slot.slotKey !== slotKey && slot.player.teamId === pick.teamId).length;
      if (sameClub >= CLUB_LIMIT) {
        setSheetError(copy.errors.clubLimit);
        return;
      }
    }
    const token = await tokenOf();
    if (!token) return;
    const before = home;
    const key = slotKey;
    setHome(withPick(home, pick, key));
    setPicker(null);
    setSheetError(null);
    try {
      const next = pick.kind === 'COACH'
        ? await coachKingService.pickCoach(token, language, pick.id)
        : await coachKingService.pickSlot(token, language, key!, pick.id);
      setHome(next);
      setError(null);
    } catch (err) {
      setHome(before);
      setError(copy.errors[errorKey(err instanceof CkApiError ? err.reason : null)]);
    }
  };

  const viewPlayer = (player: CkPlayer) => {
    if (player.externalPlayerId == null) return;
    setPicker(null);
    setLocked(null);
    pushPlayerCareer(router, {
      athleteId: player.externalPlayerId,
      name: player.name,
      photo: player.photo,
      teamName: player.club,
      teamLogo: player.teamLogo,
      teamId: player.teamId,
    });
  };

  const openOpponent = (row: CkBoardRow) => {
    router.push({
      pathname: '/coach-king/opponent/[userId]',
      params: { userId: row.userId, name: row.name, avatar: row.avatar ?? '', username: row.username },
    } as never);
  };

  const bottomPad = ckNavBottom(insets.bottom) + 92;
  const row = isAr ? 'row-reverse' : 'row';

  return (
    <View style={styles.root} testID="coach-king-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8, flexDirection: row }]}>
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
          <LinearGradient
            colors={['#1A0B3A', '#0A001C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.profile, { flexDirection: row }]}
          >
            <View style={[styles.identity, { flexDirection: row }]}>
              <Image source={shown.user.avatar ? { uri: shown.user.avatar } : PLACEHOLDER} style={styles.avatar} cachePolicy="memory-disk" />
              <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
                <Text style={[styles.userName, { fontFamily: fontSemi }]} numberOfLines={1}>{shown.user.displayName}</Text>
                <View style={[styles.metaRow, { flexDirection: row }]}>
                  <Text style={[styles.meta, { fontFamily: fontMed }]}>{`${copy.level} ${shown.user.level}`}</Text>
                  <View style={styles.metaDot} />
                  <Ionicons name="trophy" size={12} color="#F8C94A" />
                  <Text style={[styles.meta, { fontFamily: fontMed }]}>{shown.user.rank ? `#${shown.user.rank}` : '—'}</Text>
                  <View style={styles.metaDot} />
                  <Ionicons name="flash" size={12} color="#C2ABFC" />
                  <Text style={[styles.meta, { fontFamily: fontMed }]}>{shown.squad.points}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.budget, { alignItems: isAr ? 'flex-start' : 'flex-end' }]}>
              <Text style={[styles.budgetHint, { fontFamily: fontMed }]}>{copy.budgetLabel}</Text>
              <CoachKingMoney
                milli={shown.wallet.remainingMilli}
                lang={language}
                size="lg"
                color={shown.wallet.remainingMilli < 0 ? '#F87171' : '#FFFFFF'}
                testID="ck-remaining"
              />
              <View style={[styles.ofRow, { flexDirection: row }]}>
                <Text style={[styles.budgetHint, { fontFamily: fontMed }]}>{copy.budgetOf.replace('{bank}', '')}</Text>
                <CoachKingMoney milli={shown.wallet.balanceMilli} lang={language} size="sm" color="#C2ABFC" />
              </View>
            </View>
          </LinearGradient>

          <View style={[styles.hint, { flexDirection: row }]}>
            <Ionicons name="lock-closed-outline" size={14} color="#C2ABFC" />
            <Text style={[styles.hintTxt, { fontFamily: fontMed, textAlign: isAr ? 'right' : 'left' }]}>{copy.tapHint}</Text>
          </View>
          {error && home ? <Text style={[styles.error, { fontFamily: fontMed }]} testID="ck-error">{error}</Text> : null}

          <CoachKingPitch
            slots={shown.squad.slots}
            coach={shown.squad.coach}
            coachLabel={copy.coach}
            formation={copy.formation}
            isAr={isAr}
            closed={closed}
            onSlot={onSlot}
            onCoach={onCoach}
          />
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
          ) : board.map((entry) => (
            <Pressable
              key={entry.userId}
              onPress={() => openOpponent(entry)}
              testID={`ck-board-${entry.rank}`}
              style={({ pressed }) => [styles.boardRow, { flexDirection: row }, entry.isMe && styles.boardMe, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.rankBadge, entry.rank <= 3 && { backgroundColor: MEDAL[entry.rank - 1] }]}>
                <Text style={[styles.rank, { fontFamily: fontBold, color: entry.rank <= 3 ? '#1A0B00' : '#fff' }]}>{entry.rank}</Text>
              </View>
              <Image source={entry.avatar ? { uri: entry.avatar } : PLACEHOLDER} style={styles.boardAvatar} cachePolicy="memory-disk" />
              <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
                <Text style={[styles.boardName, { fontFamily: fontSemi }]} numberOfLines={1}>{entry.name}</Text>
                <Text style={[styles.boardUser, { fontFamily: fontMed }]} numberOfLines={1}>@{entry.username}</Text>
              </View>
              <View style={[styles.boardPtsWrap, { flexDirection: row }]}>
                <Ionicons name="flash" size={14} color="#C2ABFC" />
                <Text style={[styles.boardPts, { fontFamily: fontBold }]}>{entry.points}</Text>
              </View>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {tab === 'matches' ? (
        <View style={{ flex: 1 }}>
          {squadLeagues.length > 0 ? (
            <CoachKingLeagueChips
              options={squadLeagues}
              active={activeMatchLeague}
              isAr={isAr}
              label={(key) => copy.leagues[key as keyof typeof copy.leagues]}
              onChange={(key) => setMatchLeague(key as CkLeagueKey)}
            />
          ) : null}
          <ScrollView contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
            {visibleFixtures.length === 0 ? (
              <KingEmptyState title={copy.noMatches} actionLabel={copy.tabs.pitch} onAction={() => onTab('pitch')} />
            ) : visibleFixtures.map((fixture) => (
              <View key={fixture.fixtureId} style={styles.match}>
                <Text style={[styles.matchDate, { fontFamily: fontMed }]}>
                  {new Date(fixture.kickoffAt).toLocaleString(isAr ? 'ar' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
                <View style={styles.matchTeams}>
                  <Image source={{ uri: fixture.homeLogo }} style={styles.matchLogo} contentFit="contain" cachePolicy="memory-disk" />
                  <Text style={[styles.team, { fontFamily: fontSemi }]} numberOfLines={1}>{fixture.homeName}</Text>
                  <Text style={[styles.score, { fontFamily: fontBold }]}>
                    {fixture.homeScore == null ? fixture.status : `${fixture.homeScore} - ${fixture.awayScore}`}
                  </Text>
                  <Text style={[styles.team, { fontFamily: fontSemi, textAlign: 'right' }]} numberOfLines={1}>{fixture.awayName}</Text>
                  <Image source={{ uri: fixture.awayLogo }} style={styles.matchLogo} contentFit="contain" cachePolicy="memory-disk" />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <CoachKingCardGrid
        kind={picker}
        slotKey={picker === 'COACH' ? null : slotKey}
        resolveToken={tokenOf}
        remainingMilli={shown?.wallet.remainingMilli ?? 0}
        refundMilli={refundMilli}
        takenIds={takenIds}
        confirming={false}
        error={sheetError}
        onClose={() => setPicker(null)}
        onConfirm={(pick) => void onConfirm(pick)}
        onClearError={() => setSheetError(null)}
        onViewProfile={viewPlayer}
      />
      <CoachKingNav active={tab} onChange={onTab} />
      <CoachKingLockedSheet
        notice={locked}
        onClose={() => setLocked(null)}
        onViewProfile={() => {
          if (locked?.player) viewPlayer(locked.player);
        }}
      />
    </View>
  );
}

const MEDAL = ['#F8C94A', '#D4D4D8', '#D08A4A'];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030303' },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: '#0D051A',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 20 },
  error: { color: '#F87171', textAlign: 'center', marginHorizontal: 20, marginTop: 8 },
  profile: {
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#3A1D7A',
  },
  identity: { alignItems: 'center', columnGap: 10, flex: 1 },
  avatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: '#8C5CF5' },
  userName: { color: '#fff', fontSize: 16 },
  metaRow: { alignItems: 'center', columnGap: 5, marginTop: 4 },
  meta: { color: '#C9C9C9', fontSize: 12 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  budget: { rowGap: 4 },
  budgetHint: { color: '#9E9E9E', fontSize: 10 },
  ofRow: { alignItems: 'center', columnGap: 4 },
  hint: {
    alignItems: 'center',
    columnGap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(140,92,245,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(184,150,252,0.3)',
  },
  hintTxt: { color: '#D8C7FD', fontSize: 12, flex: 1 },
  boardRow: {
    marginTop: 8,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#0A001C',
    borderWidth: 0.5,
    borderColor: '#241152',
    alignItems: 'center',
    paddingHorizontal: 12,
    columnGap: 10,
  },
  boardMe: { borderColor: 'rgba(140,92,245,0.8)', backgroundColor: '#140533' },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rank: { fontSize: 13 },
  boardAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(140,92,245,0.6)' },
  boardName: { color: '#fff', fontSize: 15 },
  boardUser: { color: '#9E8BC9', fontSize: 11, marginTop: 1 },
  boardPtsWrap: { alignItems: 'center', columnGap: 4 },
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
  matchLogo: { width: 22, height: 22 },
  team: { color: '#fff', flex: 1, fontSize: 14 },
  score: { color: '#fff', fontSize: 16 },
});
