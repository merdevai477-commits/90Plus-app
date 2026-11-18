/**
 * خماسي الهدافين — one card per league. The user swipes between competitions
 * and may play one or all of them. Each slot locks for 7 days on its own.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import {
  TSF_COMPETITIONS,
  TsfApiError,
  topScorersFiveService,
  tsfSlotKey,
  type TsfApiFixture,
  type TsfApiLeaderboard,
  type TsfApiLineup,
  type TsfApiPlayer,
  type TsfCompetitionKey,
} from '../../services/topScorersFive.service';
import { useTranslation } from '../../src/i18n';
import { logger } from '../../utils/logger';
import { useAppFont, useScreenFont } from '../../utils/fontSetup';
import { pushPlayerCareer } from '../../utils/openPlayerProfile';

import { TSF_LEAGUE_LOGO, TSF_PITCH_CARD_ART } from './assets';
import { TsfNav, tsfNavBottom, type TsfTabKey } from './TsfNav';
import { TSF_THEME, type TsfColors } from './tsfTheme';

const CREST: Record<TsfCompetitionKey, number> = {
  egypt: TSF_LEAGUE_LOGO.egypt1,
  pl: TSF_LEAGUE_LOGO.pl,
  laliga: TSF_LEAGUE_LOGO.laliga,
  seriea: TSF_LEAGUE_LOGO.seriea,
  bundesliga: TSF_LEAGUE_LOGO.bundesliga,
  ligue1: TSF_LEAGUE_LOGO.ligue1,
};

function isCompetition(value: string | undefined): value is TsfCompetitionKey {
  return TSF_COMPETITIONS.includes(value as TsfCompetitionKey);
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function emptyLineup(league: TsfCompetitionKey): TsfApiLineup['slots'] {
  return [1, 2, 3, 4, 5].map((index) => ({
    slotKey: tsfSlotKey(league, index),
    locked: false,
    lockedUntil: null,
    player: null,
    score: { goals: 0, assists: 0, points: 0 },
  }));
}

function formatWhen(iso: string | null, language: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(language === 'ar' ? 'ar-EG' : 'en', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LeagueBoardScreen() {
  useScreenFont();
  const router = useRouter();
  const params = useLocalSearchParams<{ league?: string; mode?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isDark } = useResolvedAppScheme();
  const colors = isDark ? TSF_THEME.dark : TSF_THEME.light;
  const { t, language } = useTranslation();
  const copy = t.topScorersFive;
  const pickCopy = copy.pick;
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);

  const initialIndex = useMemo(() => {
    const league = firstParam(params.league);
    const mode = firstParam(params.mode);
    const key = isCompetition(league) ? league : mode === 'egypt' ? 'egypt' : mode === 'europe' ? 'pl' : 'egypt';
    return Math.max(0, TSF_COMPETITIONS.indexOf(key));
  }, [params.league, params.mode]);

  const [index, setIndex] = useState(initialIndex);
  const [tab, setTab] = useState<TsfTabKey>('pitch');
  const [lineups, setLineups] = useState<Partial<Record<TsfCompetitionKey, TsfApiLineup>>>({});
  const [pickerSlot, setPickerSlot] = useState<string | null>(null);
  const [players, setPlayers] = useState<TsfApiPlayer[]>([]);
  const [query, setQuery] = useState('');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<TsfApiPlayer | null>(null);
  const [lockText, setLockText] = useState<string | null>(null);
  const listRef = useRef<FlatList<TsfCompetitionKey>>(null);

  const competition = TSF_COMPETITIONS[index] ?? 'egypt';

  const leagueName = useCallback(
    (key: TsfCompetitionKey) => (key === 'egypt' ? pickCopy.leagues.egypt1 : pickCopy.leagues[key]),
    [pickCopy.leagues],
  );

  const loadLineup = useCallback(
    async (key: TsfCompetitionKey) => {
      if (!isSignedIn) return;
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const data = await topScorersFiveService.getLineup(token, key, language);
        setLineups((prev) => ({ ...prev, [key]: data }));
      } catch (error) {
        logger.warn('[TopScorersFive] lineup load failed', error);
      }
    },
    [isSignedIn, language],
  );

  useEffect(() => {
    void loadLineup(competition);
  }, [competition, loadLineup]);

  useEffect(() => {
    if (!pickerSlot) return;
    let cancelled = false;
    topScorersFiveService
      .getPlayers(competition, language)
      .then((rows) => {
        if (!cancelled) setPlayers(rows);
      })
      .catch((error) => logger.warn('[TopScorersFive] players load failed', error));
    return () => {
      cancelled = true;
    };
  }, [pickerSlot, competition, language]);

  const openSlot = useCallback(
    (slotKey: string, locked: boolean, lockedUntil: string | null) => {
      if (locked) {
        const when = formatWhen(lockedUntil, language);
        setLockText(pickCopy.lockedBodyGeneric.replace('{when}', when));
        return;
      }
      if (!isSignedIn) {
        Alert.alert(pickCopy.signInTitle, pickCopy.signInBody);
        return;
      }
      setQuery('');
      setChosenId(null);
      setPickerSlot(slotKey);
    },
    [isSignedIn, language, pickCopy.lockedBodyGeneric, pickCopy.signInBody, pickCopy.signInTitle],
  );

  const confirmPick = useCallback(async () => {
    if (!pickerSlot || !chosenId || saving) return;
    setSaving(true);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        Alert.alert(pickCopy.signInTitle, pickCopy.signInBody);
        return;
      }
      await topScorersFiveService.saveSelection(token, pickerSlot, chosenId, language);
      setPickerSlot(null);
      await loadLineup(competition);
    } catch (error) {
      const reason = error instanceof TsfApiError ? error.reason : null;
      if (reason === 'PLAYER_ALREADY_PICKED') {
        Alert.alert(pickCopy.alreadyPickedTitle, pickCopy.alreadyPickedBody);
      } else if (reason === 'GAMEWEEK_PICK_LOCKED') {
        setPickerSlot(null);
        setLockText(pickCopy.lockedBodyGeneric.replace('{when}', ''));
      } else {
        logger.warn('[TopScorersFive] save failed', error);
        Alert.alert(pickCopy.saveFailedTitle, pickCopy.saveFailedBody);
      }
    } finally {
      setSaving(false);
    }
  }, [chosenId, competition, language, loadLineup, pickCopy, pickerSlot, saving]);

  const removeSlot = useCallback(
    async (slotKey: string, locked: boolean, lockedUntil: string | null) => {
      if (locked) {
        setLockText(pickCopy.lockedBodyGeneric.replace('{when}', formatWhen(lockedUntil, language)));
        return;
      }
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        await topScorersFiveService.clearSelection(token, slotKey);
        await loadLineup(competition);
      } catch (error) {
        const reason = error instanceof TsfApiError ? error.reason : null;
        if (reason === 'GAMEWEEK_PICK_LOCKED') {
          setLockText(pickCopy.lockedBodyGeneric.replace('{when}', formatWhen(lockedUntil, language)));
          return;
        }
        logger.warn('[TopScorersFive] clear failed', error);
        Alert.alert(pickCopy.saveFailedTitle, pickCopy.saveFailedBody);
      }
    },
    [competition, language, loadLineup, pickCopy],
  );

  const onSwipe = useCallback(
    (offsetX: number) => {
      const next = Math.max(0, Math.min(TSF_COMPETITIONS.length - 1, Math.round(offsetX / width)));
      setIndex(next);
    },
    [width],
  );

  const renderCard: ListRenderItem<TsfCompetitionKey> = useCallback(
    ({ item }) => {
      const lineup = lineups[item];
      const slots = lineup?.slots ?? emptyLineup(item);
      const tint = isDark && (item === 'pl' || item === 'ligue1' || item === 'egypt') ? '#FFFFFF' : undefined;
      return (
        <ScrollView
          style={{ width }}
          contentContainerStyle={{ paddingBottom: tsfNavBottom(insets.bottom) + 88, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image source={CREST[item]} style={styles.crest} contentFit="contain" tintColor={tint} />
            <Text style={[styles.leagueName, { color: colors.text, fontFamily: fontBold }]}>{leagueName(item)}</Text>
            <Text style={[styles.pointsLine, { color: colors.muted, fontFamily: fontMedium }]}>
              {pickCopy.yourPoints} {lineup?.points ?? 0}
            </Text>
            <Formation
              slots={slots}
              colors={colors}
              fontSemi={fontSemi}
              fontMedium={fontMedium}
              emptyLabel={pickCopy.chooseFormation}
              onOpen={openSlot}
              onRemove={removeSlot}
            />
          </View>
        </ScrollView>
      );
    },
    [colors, fontBold, fontMedium, fontSemi, insets.bottom, isDark, leagueName, lineups, openSlot, pickCopy, removeSlot, width],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return players;
    return players.filter((player) =>
      [player.name, player.nameAr, player.nameEn, player.club].some((value) =>
        (value ?? '').toLowerCase().includes(needle),
      ),
    );
  }, [players, query]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBar === 'light' ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text, fontFamily: fontSemi }]}>{copy.title}</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          hitSlop={12}
          style={styles.back}
          testID="top-scorers-five-back"
        >
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>

      {tab === 'pitch' ? (
        <>
          <FlatList
            ref={listRef}
            data={TSF_COMPETITIONS}
            keyExtractor={(item) => item}
            renderItem={renderCard}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
            onMomentumScrollEnd={(event) => onSwipe(event.nativeEvent.contentOffset.x)}
            extraData={lineups}
            style={styles.flex}
          />
          <View style={[styles.dots, { bottom: tsfNavBottom(insets.bottom) + 72 }]}>
            {TSF_COMPETITIONS.map((key, dot) => (
              <View
                key={key}
                style={[
                  styles.dot,
                  { backgroundColor: dot === index ? colors.dotActive : colors.dot, width: dot === index ? 16 : 6 },
                ]}
              />
            ))}
          </View>
        </>
      ) : null}

      {tab === 'matches' ? (
        <LeagueMatches
          competition={competition}
          leagueName={leagueName(competition)}
          crest={CREST[competition]}
          tint={isDark && (competition === 'pl' || competition === 'ligue1' || competition === 'egypt')}
          colors={colors}
          language={language}
          isSignedIn={!!isSignedIn}
          getToken={() => getTokenRef.current()}
          onPick={() => setTab('pitch')}
        />
      ) : null}

      {tab === 'ranking' ? (
        <LeagueRanking
          competition={competition}
          leagueName={leagueName(competition)}
          crest={CREST[competition]}
          tint={isDark && (competition === 'pl' || competition === 'ligue1' || competition === 'egypt')}
          colors={colors}
          isSignedIn={!!isSignedIn}
          getToken={() => getTokenRef.current()}
          onPick={() => setTab('pitch')}
        />
      ) : null}

      <TsfNav activeTab={tab} onChange={setTab} scale={Math.min(width / 390, 1)} />

      <PlayerSheet
        visible={pickerSlot != null}
        colors={colors}
        title={pickCopy.sheetTitle.replace('{league}', leagueName(competition))}
        query={query}
        onQuery={setQuery}
        players={filtered}
        chosenId={chosenId}
        onChoose={setChosenId}
        onDetail={setDetail}
        saving={saving}
        confirmLabel={pickCopy.confirmShort}
        searchPlaceholder={pickCopy.searchPlaceholder}
        emptyLabel={pickCopy.searchEmpty}
        onClose={() => setPickerSlot(null)}
        onConfirm={() => void confirmPick()}
      />

      <DetailSheet
        player={detail}
        colors={colors}
        onClose={() => setDetail(null)}
        onProfile={(player) => {
          setDetail(null);
          setPickerSlot(null);
          if (player.externalPlayerId != null) {
            pushPlayerCareer(router, {
              athleteId: player.externalPlayerId,
              name: player.name,
              photo: player.photo,
              teamName: player.club,
              teamLogo: player.teamLogo,
              teamId: player.teamId,
            });
          }
        }}
        profileLabel={pickCopy.viewProfile}
        goalsLabel={pickCopy.statGoals}
        assistsLabel={pickCopy.statAssists}
      />

      <Modal visible={lockText != null} transparent animationType="fade" onRequestClose={() => setLockText(null)}>
        <Pressable style={styles.scrim} onPress={() => setLockText(null)}>
          <View style={[styles.lockCard, { backgroundColor: colors.sheet }]}>
            <Text style={[styles.lockTitle, { color: colors.text, fontFamily: fontBold }]}>{pickCopy.lockedTitle}</Text>
            <Text style={[styles.lockBody, { color: colors.muted, fontFamily: fontMedium }]}>{lockText}</Text>
            <TouchableOpacity
              onPress={() => setLockText(null)}
              style={[styles.confirmBtn, { backgroundColor: colors.purple }]}
            >
              <Text style={[styles.confirmText, { fontFamily: fontSemi }]}>{pickCopy.lockedGotIt}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Formation({
  slots,
  colors,
  fontSemi,
  fontMedium,
  emptyLabel,
  onOpen,
  onRemove,
}: {
  slots: TsfApiLineup['slots'];
  colors: TsfColors;
  fontSemi: string | undefined;
  fontMedium: string | undefined;
  emptyLabel: string;
  onOpen: (slotKey: string, locked: boolean, lockedUntil: string | null) => void;
  onRemove: (slotKey: string, locked: boolean, lockedUntil: string | null) => void;
}) {
  const rows = [slots.slice(0, 1), slots.slice(1, 3), slots.slice(3, 5)];
  const allEmpty = slots.every((slot) => slot.player == null);
  return (
    <View style={styles.formation}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.formationRow}>
          {row.map((slot) => (
            <SlotCard
              key={slot.slotKey}
              slot={slot}
              colors={colors}
              fontSemi={fontSemi}
              fontMedium={fontMedium}
              onOpen={() => onOpen(slot.slotKey, slot.locked, slot.lockedUntil)}
              onRemove={() => onRemove(slot.slotKey, slot.locked, slot.lockedUntil)}
            />
          ))}
        </View>
      ))}
      {allEmpty ? (
        <Text style={[styles.emptyFormation, { color: colors.muted, fontFamily: fontMedium }]}>{emptyLabel}</Text>
      ) : null}
    </View>
  );
}

function SlotCard({
  slot,
  colors,
  fontSemi,
  fontMedium,
  onOpen,
  onRemove,
}: {
  slot: TsfApiLineup['slots'][number];
  colors: TsfColors;
  fontSemi: string | undefined;
  fontMedium: string | undefined;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const player = slot.player;
  if (!player) {
    return (
      <TouchableOpacity
        onPress={onOpen}
        accessibilityRole="button"
        style={[styles.slot, styles.slotEmpty, { borderColor: colors.purple, backgroundColor: colors.field }]}
        testID={`tsf-slot-${slot.slotKey}`}
      >
        <Ionicons name="add" size={28} color={colors.purple} />
      </TouchableOpacity>
    );
  }
  const points = slot.score.points;
  return (
    <TouchableOpacity
      onPress={onOpen}
      accessibilityRole="button"
      style={[styles.slot, { backgroundColor: colors.field, borderColor: colors.border }]}
      testID={`tsf-slot-${slot.slotKey}`}
    >
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={8}
        style={styles.remove}
        accessibilityRole="button"
      >
        <Ionicons name="close" size={14} color={colors.muted} />
      </TouchableOpacity>
      {player.photo ? (
        <Image source={{ uri: player.photo }} style={styles.photo} contentFit="contain" />
      ) : (
        <View style={[styles.photo, { backgroundColor: colors.purple }]} />
      )}
      <Text numberOfLines={1} style={[styles.playerName, { color: colors.text, fontFamily: fontSemi }]}>
        {player.name}
      </Text>
      <View style={styles.statRow}>
        <View style={[styles.pill, { backgroundColor: points > 0 ? colors.positive : colors.zero }]}>
          <Text style={[styles.pillText, { fontFamily: fontMedium }]}>{points}</Text>
        </View>
        <Image source={TSF_PITCH_CARD_ART.football} style={styles.ball} contentFit="contain" />
        <Text style={[styles.goalCount, { color: colors.muted, fontFamily: fontMedium }]}>{slot.score.goals}</Text>
      </View>
    </TouchableOpacity>
  );
}

function LeagueMatches({
  competition,
  leagueName,
  crest,
  tint,
  colors,
  language,
  isSignedIn,
  getToken,
  onPick,
}: {
  competition: TsfCompetitionKey;
  leagueName: string;
  crest: number;
  tint: boolean;
  colors: TsfColors;
  language: string;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.topScorersFive;
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const insets = useSafeAreaInsets();
  const [fixtures, setFixtures] = useState<TsfApiFixture[]>([]);
  const [expanded, setExpanded] = useState(false);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const upcoming = await topScorersFiveService.getUpcoming(competition, language);
        let rows = upcoming.fixtures;
        if (isSignedIn) {
          const token = await getTokenRef.current();
          if (token) {
            const mine = await topScorersFiveService.getMyFixtures(token, language, 'europe', competition);
            const byId = new Map(rows.map((row) => [row.fixtureId, row]));
            for (const row of mine.fixtures) {
              if (!byId.has(row.fixtureId)) byId.set(row.fixtureId, row);
            }
            rows = [...byId.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
          }
        }
        if (!cancelled) setFixtures(rows);
      } catch (error) {
        logger.warn('[TopScorersFive] matches load failed', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [competition, isSignedIn, language]);

  const shown = expanded ? fixtures : fixtures.slice(0, 4);
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ padding: 16, paddingBottom: tsfNavBottom(insets.bottom) + 88, gap: 12 }}
    >
      <LeagueHeading name={leagueName} crest={crest} tint={tint} colors={colors} font={fontSemi} />
      {shown.length === 0 ? (
        <TouchableOpacity onPress={onPick}>
          <Text style={{ color: colors.muted, fontFamily: fontMedium, textAlign: 'center' }}>{copy.matches.emptyTitle}</Text>
        </TouchableOpacity>
      ) : (
        shown.map((fixture) => (
          <View key={fixture.fixtureId} style={[styles.matchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.matchDate, { color: colors.purple, fontFamily: fontMedium }]}>
              {new Date(fixture.kickoff).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
            <View style={styles.matchTeams}>
              <TeamSide name={fixture.home.name} logo={fixture.home.logo} colors={colors} font={fontMedium} />
              <Text style={{ color: colors.muted, fontFamily: fontSemi }}>-</Text>
              <TeamSide name={fixture.away.name} logo={fixture.away.logo} colors={colors} font={fontMedium} />
            </View>
          </View>
        ))
      )}
      {fixtures.length > 4 && !expanded ? (
        <TouchableOpacity onPress={() => setExpanded(true)} accessibilityRole="button">
          <Text style={[styles.viewMore, { color: colors.purple, fontFamily: fontSemi }]}>{copy.pick.viewMore}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function LeagueRanking({
  competition,
  leagueName,
  crest,
  tint,
  colors,
  isSignedIn,
  getToken,
  onPick,
}: {
  competition: TsfCompetitionKey;
  leagueName: string;
  crest: number;
  tint: boolean;
  colors: TsfColors;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.topScorersFive;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [board, setBoard] = useState<TsfApiLeaderboard | null>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const data = await topScorersFiveService.getLeaderboard(token, period, 50, 'europe', competition);
        if (!cancelled) setBoard(data);
      } catch (error) {
        logger.warn('[TopScorersFive] leaderboard load failed', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [competition, isSignedIn, period]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ padding: 16, paddingBottom: tsfNavBottom(insets.bottom) + 88, gap: 10 }}
    >
      <LeagueHeading name={leagueName} crest={crest} tint={tint} colors={colors} font={fontSemi} />
      <View style={styles.periodRow}>
        {(['week', 'all'] as const).map((key) => {
          const active = period === key;
          const label = key === 'week' ? copy.ranking.filterWeek : copy.ranking.filterAll;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setPeriod(key)}
              style={[
                styles.periodChip,
                { backgroundColor: active ? colors.purple : colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: active ? colors.onPurple : colors.text, fontFamily: fontMedium }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {(board?.entries.length ?? 0) === 0 ? (
        <TouchableOpacity onPress={onPick}>
          <Text style={{ color: colors.muted, textAlign: 'center', fontFamily: fontMedium }}>{copy.ranking.emptyTitle}</Text>
        </TouchableOpacity>
      ) : (
        board?.entries.map((entry) => (
          <View key={entry.userId} style={[styles.rankRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.rankNum, { color: colors.purple, fontFamily: fontBold }]}>{entry.rank}</Text>
            {entry.avatar ? (
              <Image source={{ uri: entry.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.field }]} />
            )}
            <Text numberOfLines={1} style={[styles.rankName, { color: colors.text, fontFamily: fontSemi }]}>
              {entry.displayName || entry.username || '—'}
            </Text>
            <Text style={{ color: colors.purple, fontFamily: fontBold }}>{entry.xp}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function LeagueHeading({
  name,
  crest,
  tint,
  colors,
  font,
}: {
  name: string;
  crest: number;
  tint: boolean;
  colors: TsfColors;
  font: string | undefined;
}) {
  return (
    <View style={styles.heading}>
      <Image source={crest} style={styles.headingCrest} contentFit="contain" tintColor={tint ? '#FFFFFF' : undefined} />
      <Text style={[styles.leagueName, { color: colors.text, fontFamily: font }]}>{name}</Text>
    </View>
  );
}

function TeamSide({
  name,
  logo,
  colors,
  font,
}: {
  name: string;
  logo: string | null;
  colors: TsfColors;
  font: string | undefined;
}) {
  return (
    <View style={styles.teamSide}>
      {logo ? <Image source={{ uri: logo }} style={styles.teamLogo} contentFit="contain" /> : null}
      <Text numberOfLines={1} style={[styles.teamName, { color: colors.text, fontFamily: font }]}>
        {name}
      </Text>
    </View>
  );
}

function PlayerSheet({
  visible,
  colors,
  title,
  query,
  onQuery,
  players,
  chosenId,
  onChoose,
  onDetail,
  saving,
  confirmLabel,
  searchPlaceholder,
  emptyLabel,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  colors: TsfColors;
  title: string;
  query: string;
  onQuery: (value: string) => void;
  players: TsfApiPlayer[];
  chosenId: string | null;
  onChoose: (id: string) => void;
  onDetail: (player: TsfApiPlayer) => void;
  saving: boolean;
  confirmLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetWrap}>
        <Pressable style={styles.scrimFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.sheet }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text, fontFamily: fontSemi }]}>{title}</Text>
          <View style={[styles.search, { backgroundColor: colors.field }]}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={onQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.text, fontFamily: fontMedium }]}
            />
          </View>
          <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
            {players.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: 'center', padding: 24, fontFamily: fontMedium }}>{emptyLabel}</Text>
            ) : (
              players.map((player) => {
                const selected = player.id === chosenId;
                return (
                  <TouchableOpacity
                    key={player.id}
                    onPress={() => onChoose(player.id)}
                    style={[styles.playerRow, { borderColor: colors.border }]}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={selected ? colors.purple : colors.muted}
                    />
                    <TouchableOpacity onPress={() => onDetail(player)}>
                      {player.photo ? (
                        <Image source={{ uri: player.photo }} style={styles.rowPhoto} contentFit="cover" />
                      ) : (
                        <View style={[styles.rowPhoto, { backgroundColor: colors.field }]} />
                      )}
                    </TouchableOpacity>
                    <View style={styles.playerCopy}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fontSemi }}>{player.name}</Text>
                      <Text numberOfLines={1} style={{ color: colors.muted, fontFamily: fontMedium }}>{player.club}</Text>
                    </View>
                    <Text style={{ color: colors.muted, fontFamily: fontMedium }}>{player.seasonGoals}</Text>
                    <Ionicons name="football" size={14} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontFamily: fontMedium }}>{player.seasonAssists}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          <TouchableOpacity
            disabled={!chosenId || saving}
            onPress={onConfirm}
            style={[styles.confirmBtn, { backgroundColor: colors.purple, opacity: !chosenId || saving ? 0.5 : 1 }]}
            testID="tsf-confirm-pick"
          >
            <Text style={[styles.confirmText, { fontFamily: fontSemi }]}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function DetailSheet({
  player,
  colors,
  onClose,
  onProfile,
  profileLabel,
  goalsLabel,
  assistsLabel,
}: {
  player: TsfApiPlayer | null;
  colors: TsfColors;
  onClose: () => void;
  onProfile: (player: TsfApiPlayer) => void;
  profileLabel: string;
  goalsLabel: string;
  assistsLabel: string;
}) {
  const fontBold = useAppFont(700);
  const fontMedium = useAppFont(500);
  return (
    <Modal visible={player != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        {player ? (
          <Pressable style={[styles.detailCard, { backgroundColor: colors.sheet }]} onPress={() => undefined}>
            {player.photo ? (
              <Image source={{ uri: player.photo }} style={styles.detailPhoto} contentFit="contain" />
            ) : null}
            <Text style={[styles.detailName, { color: colors.text, fontFamily: fontBold }]}>{player.name}</Text>
            <Text style={{ color: colors.muted, fontFamily: fontMedium }}>{player.club}</Text>
            <View style={styles.detailStats}>
              <Text style={{ color: colors.text, fontFamily: fontMedium }}>{goalsLabel} {player.seasonGoals}</Text>
              <Text style={{ color: colors.text, fontFamily: fontMedium }}>{assistsLabel} {player.seasonAssists}</Text>
            </View>
            {player.externalPlayerId != null ? (
              <TouchableOpacity onPress={() => onProfile(player)}>
                <Text style={{ color: colors.purple, fontFamily: fontMedium }}>{profileLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { height: 48, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18 },
  back: { position: 'absolute', left: 16, top: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  crest: { width: 56, height: 56 },
  leagueName: { fontSize: 16, textAlign: 'center' },
  pointsLine: { fontSize: 13 },
  formation: { width: '100%', alignItems: 'center', gap: 14, marginTop: 12 },
  formationRow: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
  emptyFormation: { marginTop: 4, fontSize: 13 },
  slot: {
    width: 104,
    height: 132,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingTop: 8,
  },
  slotEmpty: { borderStyle: 'dashed' },
  remove: { position: 'absolute', top: 6, right: 6, zIndex: 2 },
  photo: { width: 64, height: 64 },
  playerName: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  pill: { minWidth: 18, borderRadius: 6, paddingHorizontal: 4, alignItems: 'center' },
  pillText: { color: '#FFFFFF', fontSize: 11 },
  ball: { width: 12, height: 12 },
  goalCount: { fontSize: 11 },
  dots: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  heading: { alignItems: 'center', gap: 6, marginBottom: 8 },
  headingCrest: { width: 48, height: 48 },
  matchRow: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  matchDate: { fontSize: 12, textAlign: 'center' },
  matchTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  teamSide: { flex: 1, alignItems: 'center', gap: 4 },
  teamLogo: { width: 36, height: 36 },
  teamName: { fontSize: 12, textAlign: 'center' },
  viewMore: { textAlign: 'center', marginTop: 4 },
  periodRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  periodChip: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 6 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rankNum: { width: 24, textAlign: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  rankName: { flex: 1, fontSize: 14 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  scrimFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '78%', gap: 10 },
  grabber: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center' },
  sheetTitle: { fontSize: 18, textAlign: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 15 },
  sheetList: { maxHeight: 360 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowPhoto: { width: 40, height: 40, borderRadius: 20 },
  playerCopy: { flex: 1 },
  confirmBtn: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#FFFFFF', fontSize: 16 },
  lockCard: { borderRadius: 20, padding: 20, gap: 12 },
  lockTitle: { fontSize: 18, textAlign: 'center' },
  lockBody: { fontSize: 14, textAlign: 'center' },
  detailCard: { borderRadius: 24, padding: 20, alignItems: 'center', gap: 8 },
  detailPhoto: { width: 120, height: 140 },
  detailName: { fontSize: 20, textAlign: 'center' },
  detailStats: { flexDirection: 'row', gap: 16 },
});
