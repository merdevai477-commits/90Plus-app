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

import UserIdentity from '../identity/UserIdentity';
import { TSF_CARD_ART, TSF_CARD_ART_BOX, TSF_LEAGUE_LOGO, TSF_PITCH_CARD_ART } from './assets';
import { GlassCapsuleNav, useGlassNavColors } from '../navigation/GlassCapsuleNav';
import { TsfNav, tsfNavBottom, type TsfTabKey } from './TsfNav';
import { TsfIslandBack, TsfPointsHero } from './TsfPointsHero';
import { TSF_THEME, type TsfColors } from './tsfTheme';

const PITCH = require('../../assets/images/top-scorers-five/pitch.jpg');

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

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/** 2-2-1 on the far goal: striker, two mids, two at the back. Percents of the pitch. */
const PITCH_SPOTS = [
  { top: 0.16, left: 0.5 },
  { top: 0.4, left: 0.24 },
  { top: 0.4, left: 0.76 },
  { top: 0.66, left: 0.3 },
  { top: 0.66, left: 0.7 },
] as const;

const PITCH_CARD = { width: 118, height: 156 };

export default function LeagueBoardScreen() {
  useScreenFont();
  const router = useRouter();
  const params = useLocalSearchParams<{ league?: string; mode?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isDark } = useResolvedAppScheme();
  const colors = isDark ? TSF_THEME.dark : TSF_THEME.light;
  const navColors = useGlassNavColors();
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
  const [period, setPeriod] = useState<'week' | 'all'>('all');
  const [lineups, setLineups] = useState<Partial<Record<TsfCompetitionKey, TsfApiLineup>>>({});
  const [pickerSlot, setPickerSlot] = useState<string | null>(null);
  const [players, setPlayers] = useState<TsfApiPlayer[]>([]);
  const [query, setQuery] = useState('');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<TsfApiPlayer | null>(null);
  const [lockText, setLockText] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pitchBox, setPitchBox] = useState({ width: 0, height: 0 });
  const listRef = useRef<FlatList<TsfCompetitionKey>>(null);

  const competition = TSF_COMPETITIONS[index] ?? 'egypt';
  const focusedLeague = isCompetition(firstParam(params.league)) || firstParam(params.mode) === 'egypt' || firstParam(params.mode) === 'europe';
  const pages = focusedLeague ? [competition] : TSF_COMPETITIONS;

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
      return (
        <ScrollView
          style={{ width }}
          contentContainerStyle={{ paddingBottom: tsfNavBottom(insets.bottom) + 16, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width, height: pitchBox.height || undefined, flex: pitchBox.height ? undefined : 1 }}>
            <PitchFormation
              slots={slots}
              reopenAt={
                slots.map((slot) => slot.lockedUntil).filter((value): value is string => !!value).sort()[0]
                ?? (lineup?.gameweek.locked ? lineup.gameweek.endAt : null)
              }
              box={pitchBox}
              fontSemi={fontSemi}
              fontMedium={fontMedium}
              lockLabel={pickCopy.lockBanner}
              onHelp={() => setHelpOpen(true)}
              onOpen={openSlot}
              onRemove={removeSlot}
            />
          </View>
        </ScrollView>
      );
    },
    [fontMedium, fontSemi, insets.bottom, lineups, openSlot, pickCopy.lockBanner, pitchBox, removeSlot, width],
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
        <Text style={[styles.title, { color: colors.text, fontFamily: fontSemi }]}>
          {tab === 'pitch' ? pickCopy.formationTitle : copy.title}
        </Text>
        <TsfIslandBack
          onPress={() => router.back()}
          label={copy.back}
          rtl={language === 'ar'}
          light={isDark}
        />
      </View>

      {tab === 'pitch' ? (
        <View
          style={styles.flex}
          onLayout={(event) => {
            const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
            setPitchBox((prev) =>
              prev.width === nextWidth && prev.height === nextHeight ? prev : { width: nextWidth, height: nextHeight },
            );
          }}
        >
          <Image source={PITCH} style={StyleSheet.absoluteFill} contentFit="cover" />
          <FlatList
            ref={listRef}
            data={pages}
            keyExtractor={(item) => item}
            renderItem={renderCard}
            horizontal
            pagingEnabled
            scrollEnabled={!focusedLeague}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={focusedLeague ? 0 : initialIndex}
            getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
            onMomentumScrollEnd={(event) => {
              if (!focusedLeague) onSwipe(event.nativeEvent.contentOffset.x);
            }}
            extraData={lineups}
            style={styles.flex}
          />
          {focusedLeague ? null : (
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
          )}
        </View>
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
          colors={colors}
          isDark={isDark}
          period={period}
          isSignedIn={!!isSignedIn}
          getToken={() => getTokenRef.current()}
          onPick={() => setTab('pitch')}
          leagueName={(key) => (key === 'egypt' ? pickCopy.leagues.egypt1 : pickCopy.leagues[key as TsfCompetitionKey] ?? key)}
        />
      ) : null}

      {tab === 'ranking' ? (
        <View pointerEvents="box-none" style={[styles.periodNav, { bottom: tsfNavBottom(insets.bottom) + 78 }]}>
          <GlassCapsuleNav
            items={[
              {
                key: 'all',
                label: copy.ranking.filterAll,
                renderIcon: (active, size) => (
                  <Ionicons
                    name={active ? 'layers' : 'layers-outline'}
                    size={size}
                    color={active ? navColors.iconActive : navColors.iconIdle}
                  />
                ),
              },
              {
                key: 'week',
                label: copy.ranking.filterWeek,
                renderIcon: (active, size) => (
                  <Ionicons
                    name={active ? 'calendar' : 'calendar-outline'}
                    size={size}
                    color={active ? navColors.iconActive : navColors.iconIdle}
                  />
                ),
              },
            ]}
            activeKey={period}
            onChange={setPeriod}
            scale={Math.min(width / 390, 1)}
            maxWidth={width - 48}
          />
        </View>
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

      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setHelpOpen(false)}>
          <Pressable style={styles.helpCard} onPress={() => undefined}>
            <View style={styles.helpHead}>
              <TouchableOpacity onPress={() => setHelpOpen(false)} style={styles.helpIconBtn} accessibilityRole="button">
                <Ionicons name="close" size={16} color="#6A2BD9" />
              </TouchableOpacity>
              <View style={styles.helpChip}>
                <Text style={[styles.helpChipText, { fontFamily: fontSemi }]}>{pickCopy.helpRulesChip}</Text>
              </View>
              <View style={styles.helpIconBtn}>
                <Ionicons name="trophy" size={16} color="#6A2BD9" />
              </View>
            </View>
            <Text style={[styles.helpTitle, { fontFamily: fontBold }]}>{pickCopy.helpWinTitle}</Text>
            <Text style={[styles.helpSub, { fontFamily: fontMedium }]}>{pickCopy.helpWinSub}</Text>
            <Text style={[styles.helpScoring, { fontFamily: fontBold }]}>{pickCopy.helpScoring}</Text>
            <View style={styles.helpScoreRow}>
              <View style={styles.helpScoreCard}>
                <Ionicons name="footsteps" size={28} color="#4B1FA3" />
                <Text style={[styles.helpScoreValue, { fontFamily: fontBold }]}>+1</Text>
                <Text style={[styles.helpScoreLabel, { fontFamily: fontBold }]}>{pickCopy.helpAssist}</Text>
                <Text style={[styles.helpScoreHint, { fontFamily: fontMedium }]}>{pickCopy.helpAssistSub}</Text>
              </View>
              <View style={styles.helpScoreCard}>
                <Ionicons name="radio-button-on" size={28} color="#4B1FA3" />
                <Text style={[styles.helpScoreValue, { fontFamily: fontBold }]}>+3</Text>
                <Text style={[styles.helpScoreLabel, { fontFamily: fontBold }]}>{pickCopy.helpGoal}</Text>
                <Text style={[styles.helpScoreHint, { fontFamily: fontMedium }]}>{pickCopy.helpGoalSub}</Text>
              </View>
            </View>
            <View style={styles.helpWinner}>
              <Text style={[styles.helpWinnerText, { fontFamily: fontSemi }]}>{pickCopy.helpWinner}</Text>
              <Ionicons name="ribbon" size={18} color="#6A2BD9" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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

function PitchFormation({
  slots,
  reopenAt,
  box,
  fontSemi,
  fontMedium,
  lockLabel,
  onHelp,
  onOpen,
  onRemove,
}: {
  slots: TsfApiLineup['slots'];
  reopenAt: string | null;
  box: { width: number; height: number };
  fontSemi: string | undefined;
  fontMedium: string | undefined;
  lockLabel: string;
  onHelp: () => void;
  onOpen: (slotKey: string, locked: boolean, lockedUntil: string | null) => void;
  onRemove: (slotKey: string, locked: boolean, lockedUntil: string | null) => void;
}) {
  const days = daysUntil(reopenAt);

  return (
    <View style={styles.pitchStage}>
      <View style={styles.lockRow}>
        <TouchableOpacity
          onPress={onHelp}
          accessibilityRole="button"
          style={styles.infoOrb}
          hitSlop={8}
        >
          <Ionicons name="help" size={18} color="#6A2BD9" />
        </TouchableOpacity>
        {days != null ? (
          <View style={styles.lockPill}>
            <Ionicons name="time" size={16} color="#FFFFFF" />
            <Text style={[styles.lockPillText, { fontFamily: fontSemi }]} numberOfLines={1}>
              {lockLabel.replace('{days}', String(days))}
            </Text>
          </View>
        ) : null}
      </View>
      {box.width > 0
        ? slots.slice(0, 5).map((slot, index) => {
            const spot = PITCH_SPOTS[index] ?? PITCH_SPOTS[0];
            return (
              <View
                key={slot.slotKey}
                style={{
                  position: 'absolute',
                  top: box.height * spot.top,
                  left: box.width * spot.left - PITCH_CARD.width / 2,
                  width: PITCH_CARD.width,
                }}
              >
                <PitchSlot
                  slot={slot}
                  fontSemi={fontSemi}
                  fontMedium={fontMedium}
                  onOpen={() => onOpen(slot.slotKey, slot.locked, slot.lockedUntil)}
                  onRemove={() => onRemove(slot.slotKey, slot.locked, slot.lockedUntil)}
                />
              </View>
            );
          })
        : null}
    </View>
  );
}

function PitchSlot({
  slot,
  fontSemi,
  fontMedium,
  onOpen,
  onRemove,
}: {
  slot: TsfApiLineup['slots'][number];
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
        style={styles.pitchEmpty}
        testID={`tsf-slot-${slot.slotKey}`}
      >
        <Ionicons name="add" size={36} color="#6A2BD9" />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      onPress={onOpen}
      accessibilityRole="button"
      style={styles.pitchCard}
      testID={`tsf-slot-${slot.slotKey}`}
    >
      <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.remove} accessibilityRole="button">
        <Ionicons name="close" size={14} color="#6B7280" />
      </TouchableOpacity>
      <Ionicons name="ribbon" size={16} color="#F5B301" style={styles.crown} />
      {player.photo ? (
        <Image source={{ uri: player.photo }} style={styles.pitchPhoto} contentFit="contain" />
      ) : (
        <View style={[styles.pitchPhoto, { backgroundColor: '#EDE4FF' }]} />
      )}
      <Text numberOfLines={1} style={[styles.pitchName, { fontFamily: fontSemi }]}>
        {player.name}
      </Text>
      <View style={styles.statRow}>
        <Image source={TSF_PITCH_CARD_ART.football} style={styles.ball} contentFit="contain" />
        <Text style={[styles.goalCount, { fontFamily: fontMedium }]}>{slot.score.goals}</Text>
        <Ionicons name="walk" size={12} color="#6A2BD9" />
        <Text style={[styles.goalCount, { fontFamily: fontMedium }]}>{slot.score.assists}</Text>
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
  colors,
  isDark,
  period,
  isSignedIn,
  getToken,
  onPick,
  leagueName,
}: {
  colors: TsfColors;
  isDark: boolean;
  period: 'week' | 'all';
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  onPick: () => void;
  leagueName: (key: string) => string;
}) {
  const { t, language } = useTranslation();
  const copy = t.topScorersFive;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<TsfApiLeaderboard | null>(null);
  const [leagueSplit, setLeagueSplit] = useState<{ leagueKey: string; total: number }[] | null>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const data = await topScorersFiveService.getLeaderboard(token, period, 50, 'europe', undefined, true);
        if (!cancelled) setBoard(data);
      } catch (error) {
        logger.warn('[TopScorersFive] leaderboard load failed', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, period]);

  const loadSplit = async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    const [europe, egypt] = await Promise.all([
      topScorersFiveService.getScore(token, 'europe'),
      topScorersFiveService.getScore(token, 'egypt'),
    ]);
    const rows = [...(europe?.leagues ?? []), ...(egypt?.leagues ?? [])];
    setLeagueSplit(rows.map((row) => ({ leagueKey: row.leagueKey, total: row.total })));
  };

  const [showAll, setShowAll] = useState(false);
  const ordered = [board?.entries[1], board?.entries[0], board?.entries[2]].filter((row) => row != null);
  const rest = board?.entries.slice(3) ?? [];
  const visibleRest = showAll ? rest : rest.slice(0, 6);
  const total = board?.me?.xp ?? 0;
  const splitSum = (leagueSplit ?? []).reduce((sum, row) => sum + row.total, 0);
  const splitOrder = ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'egypt', 'egypt1'];

  return (
    <>
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.bg }]}
        contentContainerStyle={{ padding: 16, paddingBottom: tsfNavBottom(insets.bottom) + 156, gap: 14 }}
      >
        <TsfPointsHero
          title={copy.ranking.totalPoints}
          points={total}
          unit={copy.pick.pointUnit}
          leagueCount={copy.ranking.leagueCount.replace('{count}', '6')}
          detailsLabel={copy.ranking.viewDetails}
          onDetails={() => void loadSplit()}
          rtl={language === 'ar'}
          titleFont={fontBold}
          valueFont={fontBold}
          bodyFont={fontSemi}
        />

        <Text style={[styles.leadTitle, { color: colors.text, fontFamily: fontBold }]}>
          {period === 'week' ? copy.ranking.leadWeek : copy.ranking.leadAll}
        </Text>

        {(board?.entries.length ?? 0) === 0 ? (
          <TouchableOpacity onPress={onPick}>
            <Text style={{ color: colors.muted, textAlign: 'center', fontFamily: fontMedium }}>{copy.ranking.emptyTitle}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.podium}>
              {ordered.map((entry) => {
                const first = entry.rank === 1;
                return (
                  <View key={entry.userId} style={[styles.podiumCol, first && styles.podiumColFirst]}>
                    {entry.avatar ? (
                      <Image source={{ uri: entry.avatar }} style={[styles.podiumAvatar, first && styles.podiumAvatarFirst]} />
                    ) : (
                      <View style={[styles.podiumAvatar, first && styles.podiumAvatarFirst, { backgroundColor: colors.field }]} />
                    )}
                    <Text numberOfLines={1} style={[styles.podiumName, { color: colors.text, fontFamily: fontSemi }]}>
                      {entry.displayName || entry.username || '—'}
                    </Text>
                    <Text style={[styles.podiumPts, { color: colors.muted, fontFamily: fontMedium }]}>
                      {entry.xp} {copy.pick.pointUnit}
                    </Text>
                    <View style={[styles.podiumBlock, first ? styles.podiumBlockFirst : entry.rank === 2 ? styles.podiumBlockSecond : styles.podiumBlockThird]}>
                      <Text style={[styles.podiumRank, first && styles.podiumRankFirst, { fontFamily: fontBold }]}>{entry.rank}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.restHead}>
              {rest.length > 6 ? (
                <TouchableOpacity onPress={() => setShowAll((value) => !value)}>
                  <Text style={{ color: colors.purple, fontFamily: fontSemi }}>
                    {showAll ? copy.ranking.filterAll : copy.ranking.viewAll}
                  </Text>
                </TouchableOpacity>
              ) : <View />}
              <Text style={[styles.restTitle, { color: colors.text, fontFamily: fontBold }]}>{copy.ranking.restTitle}</Text>
            </View>

            {visibleRest.map((entry) => {
              const mine = entry.userId === board?.me?.userId;
              return (
                <View
                  key={entry.userId}
                  style={[
                    styles.rankRow,
                    mine
                      ? { backgroundColor: '#6A2BD9', borderColor: '#6A2BD9' }
                      : { backgroundColor: isDark ? colors.card : '#FFFFFF', borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.pointsPill, mine && styles.pointsPillMine, !mine && isDark && { backgroundColor: colors.field }]}>
                    <Text style={[styles.pointsPillUnit, { fontFamily: fontMedium, color: mine ? '#E9D5FF' : colors.purple }]}>
                      {copy.pick.pointUnit}
                    </Text>
                    <Text style={[styles.pointsPillValue, { fontFamily: fontBold, color: mine ? '#FFFFFF' : colors.text }]}>
                      {entry.xp}
                    </Text>
                  </View>
                  <View style={styles.rankName}>
                    <Text
                      numberOfLines={1}
                      style={{ color: mine ? '#FFFFFF' : colors.text, fontFamily: fontSemi, textAlign: 'right' }}
                    >
                      {mine ? copy.ranking.you : entry.displayName || entry.username || '—'}
                    </Text>
                    {!mine && entry.username ? (
                      <Text numberOfLines={1} style={{ color: colors.muted, fontFamily: fontMedium, textAlign: 'right', fontSize: 11 }}>
                        @{entry.username}
                      </Text>
                    ) : null}
                  </View>
                  {entry.avatar ? (
                    <Image source={{ uri: entry.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarLetter, { backgroundColor: mine ? '#4B1FA3' : colors.field }]}>
                      <Text style={{ color: mine ? '#FFFFFF' : colors.purple, fontFamily: fontBold }}>
                        {(entry.displayName || entry.username || '?').slice(0, 1)}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.rankNum, { color: mine ? '#FFFFFF' : colors.text, fontFamily: fontBold }]}>{entry.rank}</Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
      <Modal visible={leagueSplit != null} transparent animationType="fade" onRequestClose={() => setLeagueSplit(null)}>
        <Pressable style={styles.scrim} onPress={() => setLeagueSplit(null)}>
          <Pressable style={styles.pointsSheet} onPress={() => undefined}>
            <View style={styles.helpHead}>
              <TouchableOpacity onPress={() => setLeagueSplit(null)} style={styles.helpIconBtn} accessibilityRole="button">
                <Ionicons name="close" size={16} color="#6A2BD9" />
              </TouchableOpacity>
              <View style={styles.helpChip}>
                <Text style={[styles.helpChipText, { fontFamily: fontSemi }]}>{copy.pick.pointsDetails}</Text>
              </View>
              <View style={styles.helpIconBtn}>
                <Ionicons name="star" size={16} color="#6A2BD9" />
              </View>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              {[...(leagueSplit ?? [])]
                .sort((a, b) => splitOrder.indexOf(a.leagueKey) - splitOrder.indexOf(b.leagueKey))
                .map((row) => {
                  const pct = splitSum > 0 ? ((row.total / splitSum) * 100).toFixed(1) : '0';
                  const crestKey = row.leagueKey === 'egypt' ? 'egypt1' : row.leagueKey;
                  const crest = CREST[crestKey as TsfCompetitionKey];
                  return (
                    <View key={row.leagueKey} style={styles.splitRow}>
                      <View style={styles.pointsPill}>
                        <Text style={[styles.pointsPillUnit, { fontFamily: fontMedium, color: '#6A2BD9' }]}>{copy.pick.pointUnit}</Text>
                        <Text style={[styles.pointsPillValue, { fontFamily: fontBold, color: '#4B1FA3' }]}>{row.total}</Text>
                      </View>
                      <View style={styles.rankName}>
                        <Text style={{ color: '#24104E', fontFamily: fontBold, textAlign: 'right' }}>{leagueName(row.leagueKey)}</Text>
                        <Text style={{ color: '#6B7280', fontFamily: fontMedium, textAlign: 'right', fontSize: 11 }}>
                          {copy.pick.pointsShare.replace('{pct}', pct)}
                        </Text>
                      </View>
                      {crest ? <Image source={crest} style={styles.splitCrest} contentFit="contain" /> : null}
                    </View>
                  );
                })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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

function FifaPickCard({
  player,
  selected,
  fontBold,
  onPress,
  onLongPress,
}: {
  player: TsfApiPlayer;
  selected: boolean;
  fontBold: string | undefined;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = 0.78;
  const s = (value: number) => value * scale;
  const card = { width: 112.48, height: 176.7 };
  const photoWindow = { left: 6, top: 8, width: 100, height: 108 };
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      style={{
        width: s(card.width),
        height: s(card.height),
        borderRadius: 12,
        borderWidth: selected ? 2 : 0,
        borderColor: '#6A2BD9',
      }}
    >
      <Image
        source={TSF_CARD_ART.under}
        style={{ position: 'absolute', left: s(TSF_CARD_ART_BOX.left), top: s(TSF_CARD_ART_BOX.top), width: s(TSF_CARD_ART_BOX.width), height: s(TSF_CARD_ART_BOX.height) }}
        contentFit="fill"
      />
      <View style={{ position: 'absolute', left: s(photoWindow.left), top: s(photoWindow.top), width: s(photoWindow.width), height: s(photoWindow.height), overflow: 'hidden' }}>
        {player.photo ? (
          <Image source={{ uri: player.photo }} style={{ width: '100%', height: '130%' }} contentFit="contain" contentPosition="top" />
        ) : null}
      </View>
      <Image
        source={TSF_CARD_ART.over}
        style={{ position: 'absolute', left: s(TSF_CARD_ART_BOX.left), top: s(TSF_CARD_ART_BOX.top), width: s(TSF_CARD_ART_BOX.width), height: s(TSF_CARD_ART_BOX.height) }}
        contentFit="fill"
      />
      <Text
        numberOfLines={1}
        style={{ position: 'absolute', left: 6, right: 6, bottom: s(28), textAlign: 'center', color: '#FFFFFF', fontFamily: fontBold, fontSize: 12 }}
      >
        {player.name}
      </Text>
    </TouchableOpacity>
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
          <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.fifaGrid}>
            {players.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: 'center', padding: 24, fontFamily: fontMedium, width: '100%' }}>{emptyLabel}</Text>
            ) : (
              players.map((player) => (
                <FifaPickCard
                  key={player.id}
                  player={player}
                  selected={player.id === chosenId}
                  fontBold={fontSemi}
                  onPress={() => onChoose(player.id)}
                  onLongPress={() => onDetail(player)}
                />
              ))
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
  help: { position: 'absolute', right: 16, top: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pitchStage: { flex: 1, minHeight: 520 },
  lockRow: {
    marginTop: 10,
    marginLeft: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 3,
    maxWidth: '92%',
  },
  periodNav: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6A2BD9',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '82%',
  },
  lockPillText: { color: '#FFFFFF', fontSize: 13 },
  infoOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitchCard: {
    width: PITCH_CARD.width,
    height: PITCH_CARD.height,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(106,43,217,0.18)',
  },
  pitchEmpty: {
    width: PITCH_CARD.width,
    height: PITCH_CARD.height,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: '#6A2BD9',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitchPhoto: { width: 92, height: 92 },
  pitchName: { color: '#24104E', fontSize: 13, marginTop: 2, textAlign: 'center', paddingHorizontal: 6 },
  crown: { position: 'absolute', top: 6, left: 8 },
  helpCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 10,
  },
  helpHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helpIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpChip: {
    height: 26,
    borderRadius: 52,
    backgroundColor: '#F8F7FF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpChipText: { color: '#6A2BD9', fontSize: 12 },
  helpTitle: { color: '#24104E', fontSize: 17, textAlign: 'center' },
  helpSub: { color: '#6B7280', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  helpScoring: { color: '#24104E', fontSize: 11, textAlign: 'right' },
  helpScoreRow: { flexDirection: 'row', gap: 8 },
  helpScoreCard: {
    flex: 1,
    backgroundColor: '#F8F5FF',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 2,
  },
  helpScoreValue: { color: '#4B1FA3', fontSize: 36 },
  helpScoreLabel: { color: '#24104E', fontSize: 16 },
  helpScoreHint: { color: '#6B7280', fontSize: 12, textAlign: 'center' },
  helpWinner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3EDFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  helpWinnerText: { flex: 1, color: '#6A2BD9', fontSize: 12, textAlign: 'right' },
  pointsHero: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointsHeroMain: { alignItems: 'flex-end', gap: 2 },
  pointsHeroLabel: { color: '#F3EDFF', fontSize: 13 },
  pointsHeroValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  pointsHeroUnit: { color: '#E9D5FF', fontSize: 13, marginBottom: 6 },
  pointsHeroValue: { color: '#FFFFFF', fontSize: 32 },
  pointsHeroSide: { alignItems: 'flex-start', gap: 10 },
  leagueCountPill: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  leagueCountText: { color: '#FFFFFF', fontSize: 12 },
  detailsLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsLinkText: { color: '#FFFFFF', fontSize: 12 },
  leadTitle: { textAlign: 'center', fontSize: 16 },
  podiumCol: { width: 104, alignItems: 'center' },
  podiumColFirst: { marginBottom: 0 },
  podiumAvatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 6 },
  podiumAvatarFirst: { width: 58, height: 58, borderRadius: 29 },
  podiumName: { fontSize: 12, maxWidth: 100, textAlign: 'center' },
  podiumPts: { fontSize: 11, marginBottom: 6 },
  podiumBlock: { width: '100%', borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: 'center', justifyContent: 'center' },
  podiumBlockFirst: { height: 118, backgroundColor: '#6A2BD9' },
  podiumBlockSecond: { height: 86, backgroundColor: '#8B5CF6' },
  podiumBlockThird: { height: 68, backgroundColor: '#A78BFA' },
  podiumRank: { color: '#FFFFFF', fontSize: 28 },
  podiumRankFirst: { color: '#F5C451', fontSize: 36 },
  restHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restTitle: { fontSize: 16 },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3EDFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pointsPillMine: { backgroundColor: 'rgba(255,255,255,0.16)' },
  pointsPillUnit: { fontSize: 11 },
  pointsPillValue: { fontSize: 16 },
  avatarLetter: { alignItems: 'center', justifyContent: 'center' },
  pointsSheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#F9F6FE',
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  splitCrest: { width: 40, height: 40 },
  fifaGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, paddingBottom: 12 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  podiumCard: { width: 104, borderRadius: 16, alignItems: 'center', padding: 8, gap: 4 },
  podiumFirst: { marginBottom: 16 },
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
