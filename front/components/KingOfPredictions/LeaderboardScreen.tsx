import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import {
  PredictionsService,
  type KingLeaderboard,
  type KingLeaderboardEntry,
  type KingPeriod,
} from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ART } from './assets';
import { KingEmptyState } from './KingBoardList';
import { KingPlayHeader } from './KingPlayHeader';
import { KingPodium } from './KingPodium';
import { useKingPicksStore } from './kingPicksStore';
import { getKingPlayTheme } from './playTheme';
import { KingNav, KING_NAV_HEIGHT, kingNavBottom, type KingTabKey } from './KingNav';
import { parseKingMode, toApiMode } from './shared';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');
const SIDE = 20;

export function KingLeaderboardScreen({ mode: modeParam }: { mode: string | string[] | undefined }) {
  const mode = parseKingMode(Array.isArray(modeParam) ? modeParam[0] : modeParam);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { t } = useTranslation();
  const copy = t.kingPredictions;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const fontRegular = useAppFont(400);
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getKingPlayTheme(isDark), [isDark]);

  const [period, setPeriod] = useState<KingPeriod>('week');
  const results = useKingPicksStore((state) => state.results);
  const [board, setBoard] = useState<KingLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const hasToken = !!(await getTokenRef.current().catch(() => null));
    if (!hasToken) {
      setBoard(null);
      return;
    }
    const data = await PredictionsService.getKingLeaderboard(
      getTokenRef.current,
      toApiMode(mode),
      period,
    ).catch(() => null);
    setBoard(data);
  }, [mode, period, results]);

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

  const entries = board?.entries ?? [];
  const top3 = useMemo(() => entries.filter((e) => e.rank >= 1 && e.rank <= 3).slice(0, 3), [entries]);
  const rest = useMemo(() => {
    const others = entries.filter((e) => e.rank > 3);
    return showAll ? others : others.slice(0, 8);
  }, [entries, showAll]);

  const meEntry = useMemo(() => {
    if (!board?.me) return null;
    const found = entries.find((e) => e.userId === board.me?.userId);
    return {
      rank: board.me.rank ?? found?.rank ?? 0,
      userId: board.me.userId,
      username: found?.username ?? null,
      displayName: found?.displayName ?? null,
      avatar: found?.avatar ?? null,
      xp: board.me.xp ?? found?.xp ?? 0,
      isVerified: found?.isVerified,
      isDeveloper: found?.isDeveloper,
      identity: found?.identity,
    } satisfies KingLeaderboardEntry;
  }, [board?.me, entries]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/king-of-predictions', params: { mode } } as never);
  };

  const openPlay = (tab: 'matches' | 'history' = 'matches') => {
    router.replace({ pathname: '/king-of-predictions', params: { mode, tab } } as never);
  };

  const onNavChange = (next: KingTabKey) => {
    if (next === 'matches' || next === 'history') openPlay(next);
  };

  const navBottom = kingNavBottom(insets.bottom);
  const listBottom = navBottom + KING_NAV_HEIGHT + (meEntry ? 78 : 16);

  const fonts = { bold: fontBold, semi: fontSemi, medium: fontMedium, regular: fontRegular };

  return (
    <View style={[styles.root, { backgroundColor: theme.screen }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />
      <KingPlayHeader title={copy.tabRanking} onBack={goBack} backLabel={copy.back} theme={theme} />

      {loading && entries.length === 0 ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
      ) : !loading && entries.length === 0 ? (
        <KingEmptyState
          title={copy.emptyTitle}
          actionLabel={copy.predictNow}
          style={{ marginTop: 80 }}
          onAction={() => openPlay('matches')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: listBottom }]}
          showsVerticalScrollIndicator={false}
        >
          <Image source={KING_ART.promoBanner} style={styles.banner} contentFit="cover" />

          <View style={[styles.infoBox, { backgroundColor: theme.infoBg }]}>
            <Text style={[styles.infoText, { color: theme.infoText, fontFamily: fontSemi }]}>
              {period === 'week' ? copy.boardInfoWeek : copy.boardInfoAll}
            </Text>
            <Ionicons name="information-circle-outline" size={20} color={theme.infoIcon} />
          </View>

          <View style={styles.periodRow}>
            <PeriodChip
              label={copy.thisWeek}
              active={period === 'week'}
              theme={theme}
              font={fontSemi}
              onPress={() => setPeriod('week')}
            />
            <PeriodChip
              label={copy.allTime}
              active={period === 'all'}
              theme={theme}
              font={fontSemi}
              onPress={() => setPeriod('all')}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: theme.ink, fontFamily: fontBold }]}>
            {period === 'week' ? copy.podiumWeekTitle : copy.podiumAllTitle}
          </Text>
          <KingPodium top={top3} theme={theme} pointsLabel={copy.pointUnit} />

          <View style={styles.restHead}>
            <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8}>
              <Text style={[styles.viewAll, { color: theme.primary, fontFamily: fontSemi }]}>
                {showAll ? copy.showLess : copy.showAll}
              </Text>
            </Pressable>
            <Text style={[styles.sectionTitle, { color: theme.ink, fontFamily: fontBold, marginTop: 0 }]}>
              {copy.otherParticipants}
            </Text>
          </View>

          <View style={styles.list}>
            {rest.map((entry) => (
              <RankingRow
                key={entry.userId}
                entry={entry}
                theme={theme}
                fonts={fonts}
                pointsLabel={copy.pointUnit}
                mine={false}
                youLabel={copy.you}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {meEntry ? (
        <View pointerEvents="box-none" style={[styles.meWrap, { bottom: navBottom + KING_NAV_HEIGHT + 10 }]}>
          <RankingRow
            entry={meEntry}
            theme={theme}
            fonts={fonts}
            pointsLabel={copy.pointUnit}
            mine
            youLabel={copy.you}
          />
        </View>
      ) : null}

      <KingNav activeTab="ranking" onChange={onNavChange} />
    </View>
  );
}

function PeriodChip({
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
        styles.chip,
        {
          backgroundColor: active ? theme.primary : theme.modeTrackBg,
          borderColor: theme.modeTrackBorder,
        },
      ]}
    >
      <Text style={{ color: active ? '#fff' : theme.modeIdleText, fontFamily: font, fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function RankingRow({
  entry,
  theme,
  fonts,
  pointsLabel,
  mine,
  youLabel,
}: {
  entry: KingLeaderboardEntry;
  theme: ReturnType<typeof getKingPlayTheme>;
  fonts: { bold: string; semi: string; medium: string; regular: string };
  pointsLabel: string;
  mine: boolean;
  youLabel: string;
}) {
  const name = mine ? youLabel : entry.displayName || entry.username || '—';
  const handle = entry.username ? `@${entry.username.replace(/^@/, '')}` : '';
  const initial = (entry.displayName || entry.username || 'A').trim().charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.row,
        mine
          ? { backgroundColor: theme.isDark ? '#4B1FA3' : '#4B1FA3' }
          : {
              backgroundColor: theme.isDark ? theme.card : '#F4F4F6',
              borderWidth: theme.isDark ? 0 : 1,
              borderColor: '#E5E0F5',
            },
      ]}
    >
      <View style={styles.pointsStack}>
        <Text
          style={[
            styles.pointsValue,
            {
              color: mine ? '#FCFCFC' : theme.isDark ? '#EBDCFA' : '#4B1FA3',
              fontFamily: fonts.bold,
            },
          ]}
        >
          {entry.xp}
        </Text>
        <Text
          style={[
            styles.pointsUnit,
            {
              color: mine ? '#F3EDFF' : theme.isDark ? '#A78BFA' : '#6A2BD9',
              fontFamily: fonts.regular,
            },
          ]}
        >
          {pointsLabel}
        </Text>
      </View>

      <View style={styles.rowRight}>
        <View style={styles.userStack}>
          <Text
            style={[
              styles.userName,
              { color: mine ? '#FCFCFC' : theme.ink, fontFamily: fonts.semi },
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {handle ? (
            <Text
              style={[
                styles.userHandle,
                { color: mine ? 'rgba(252,252,252,0.75)' : theme.muted, fontFamily: fonts.regular },
              ]}
              numberOfLines={1}
            >
              {handle}
            </Text>
          ) : null}
        </View>

        {entry.avatar ? (
          <Image source={{ uri: entry.avatar }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarFallback,
              { backgroundColor: mine ? '#5F27CE' : theme.isDark ? '#2A1A4A' : '#6A2BD9' },
            ]}
          >
            <Text style={[styles.avatarLetter, { fontFamily: fonts.regular }]}>{initial}</Text>
          </View>
        )}

        <View style={[styles.rankBadge, mine ? { backgroundColor: '#662DD7' } : { backgroundColor: theme.isDark ? '#2A1A4A' : '#EDE9FE' }]}>
          <Text
            style={[
              styles.rankText,
              {
                color: mine ? '#FCFCFC' : theme.isDark ? '#fff' : '#4B1FA3',
                fontFamily: fonts.semi,
              },
            ]}
          >
            {entry.rank || '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: SIDE, gap: 14, paddingTop: 4 },
  banner: { width: '100%', height: 161, borderRadius: 17 },
  infoBox: {
    minHeight: 42,
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    direction: 'ltr',
  },
  infoText: { flex: 1, fontSize: 12, textAlign: 'right' },
  periodRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 17, textAlign: 'right', marginTop: 4, width: '100%' },
  restHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    direction: 'ltr',
  },
  viewAll: { fontSize: 13 },
  list: { gap: 10 },
  row: {
    height: 62,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    direction: 'ltr',
  },
  pointsStack: { width: 70, alignItems: 'center', justifyContent: 'center' },
  pointsValue: { fontSize: 20, textAlign: 'center' },
  pointsUnit: { fontSize: 10, textAlign: 'center' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  userStack: { width: 130, alignItems: 'flex-end', justifyContent: 'center', gap: 1 },
  userName: { fontSize: 11, textAlign: 'right', width: '100%' },
  userHandle: { fontSize: 9, textAlign: 'right', width: '100%' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EDE9FE' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#FCFCFC', fontSize: 14 },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 11, textAlign: 'center' },
  meWrap: { position: 'absolute', left: SIDE, right: SIDE },
});
