/**
 * Competition profile: crest hero + follow + scorers + matches + standings.
 * Opens from search / favorites / AI the same way club & player profiles do.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { useTranslation } from '../src/i18n';
import { getLeagueDisplayName, getTeamDisplayName } from '../utils/i18nHelpers';
import ApiFootballService, {
  type Standing365Row,
  type Stat365LeaderRow,
  type Stat365Leaderboard,
} from '../services/apiFootball';
import { useCompetitorStandings } from '../hooks/useTeamProfile';
import { useFavoriteLeagues } from '../hooks/useFavoriteLeagues';
import { useHaptic } from '../hooks/useHaptic';
import TeamBadge from '../components/common/TeamBadge';
import LeagueIcon from '../components/common/LeagueIcon';
import CachedAthletePhoto from '../components/common/CachedAthletePhoto';
import MatchesTab from '../components/TeamProfile/MatchesTab';
import { pushPlayerCareer } from '../utils/openPlayerProfile';

type TabKey = 'scorers' | 'matches' | 'table';

/** Prefer goals / assists / rating early; keep API order otherwise. */
function sortBoards(boards: Stat365Leaderboard[]): Stat365Leaderboard[] {
  const priority = (b: Stat365Leaderboard) => {
    const t = b.typeId ?? b.key;
    if (t === 1) return 0; // goals
    if (t === 3 || t === 2) return 1; // assists
    if (t === 36) return 2; // rating
    return 10;
  };
  return [...boards].sort((a, b) => priority(a) - priority(b));
}

function boardLabel(board: Stat365Leaderboard, fallback: string): string {
  const name = (board.name || '').trim();
  return name || fallback;
}

export default function CompetitionProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const { trigger } = useHaptic();
  const params = useLocalSearchParams() as {
    id?: string;
    name?: string;
    logo?: string;
    country?: string;
  };
  const competitionId = parseInt(params.id ?? '0', 10);
  const cp = t.competitionProfile;
  const { isFollowing, toggleFollow, pending: followPending } = useFavoriteLeagues();
  const following = competitionId > 0 && isFollowing(competitionId);
  const [tab, setTab] = useState<TabKey>('scorers');
  const [boardKey, setBoardKey] = useState<number | null>(null);

  // Hero can paint from nav params — don't block the whole screen on profile fetch.
  const infoQ = useQuery({
    queryKey: ['365-competition-profile', competitionId, language],
    queryFn: () => ApiFootballService.getCompetition365Profile(competitionId),
    enabled: competitionId > 0,
    staleTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Scorers tab is default — fetch immediately.
  const statsQ = useQuery({
    queryKey: ['365-competition-stats', competitionId, language],
    queryFn: () => ApiFootballService.getCompetition365Stats(competitionId),
    enabled: competitionId > 0,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Heavy fixtures paging — only when the user opens Matches.
  const matchesQ = useQuery({
    queryKey: ['365-competition-matches', competitionId, language],
    queryFn: () => ApiFootballService.getCompetition365Matches(competitionId),
    enabled: competitionId > 0 && tab === 'matches',
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Standings only when Table tab is open.
  const standingsQ = useCompetitorStandings(
    competitionId,
    competitionId > 0 && tab === 'table',
  );

  const info = infoQ.data;
  const name = info?.name || params.name || '—';
  const logo = info?.logo || params.logo || null;
  const country = info?.country || params.country || null;
  const hasStandings = info?.hasStandings !== false;
  const displayName = getLeagueDisplayName(name, language, competitionId, country);

  const boards = useMemo(
    () => sortBoards(statsQ.data?.leaderboards ?? []),
    [statsQ.data],
  );
  const activeBoard: Stat365Leaderboard | null = useMemo(() => {
    if (!boards.length) return null;
    if (boardKey != null) {
      const found = boards.find((b) => b.key === boardKey);
      if (found) return found;
    }
    return boards.find((b) => (b.typeId ?? b.key) === 1) ?? boards[0];
  }, [boards, boardKey]);
  const boardRows = (activeBoard?.rows ?? []).slice(0, 15);

  const groups = useMemo(() => {
    const list = standingsQ.data ?? [];
    const byGroup = new Map<number, { name: string | null; rows: Standing365Row[] }>();
    for (const row of list) {
      const groupNum = Number.isFinite(row.groupNum) ? row.groupNum : 0;
      const g = byGroup.get(groupNum);
      if (g) g.rows.push(row);
      else byGroup.set(groupNum, { name: row.groupName, rows: [row] });
    }
    return [...byGroup.entries()].sort((a, b) => a[0] - b[0]);
  }, [standingsQ.data]);

  const handleToggleFollow = () => {
    if (competitionId <= 0 || followPending) return;
    trigger('medium');
    void toggleFollow({ id: competitionId, name, logo, country });
  };

  const openPlayer = (row: Stat365LeaderRow) => {
    pushPlayerCareer(router, {
      athleteId: row.athleteId,
      name: row.name,
      photo: row.photo,
    });
  };

  const openMatch = (fixtureId: number) => {
    router.push({
      pathname: '/(tabs)/match-details' as any,
      params: { fixtureId: String(fixtureId) },
    } as any);
  };

  const tabKeys: TabKey[] = ['scorers', 'matches', 'table'];
  const tabLabel = (key: TabKey) => {
    if (key === 'scorers') return cp.scorers ?? cp.topScorers;
    if (key === 'matches') return cp.matches;
    return cp.table;
  };

  const showFullScreenLoader =
    competitionId > 0 && infoQ.isLoading && !info && !params.name && !params.logo;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {cp.title}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {showFullScreenLoader ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.purpleSoft} />
          <Text style={styles.muted}>{cp.loading}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          <View style={styles.hero}>
            <View style={styles.crestRing}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.crestImage} resizeMode="contain" />
              ) : (
                <LeagueIcon name={name} logo={undefined} size={72} />
              )}
            </View>
            <Text style={styles.name}>{displayName}</Text>
            {country ? <Text style={styles.meta}>{country}</Text> : null}
            {following ? (
              <Text style={styles.followHint}>{cp.followNotifHint}</Text>
            ) : (
              <Text style={styles.followHintMuted}>{cp.followNotifHintOff}</Text>
            )}
            {competitionId > 0 ? (
              <TouchableOpacity
                style={[styles.followBtn, following && styles.followingBtn]}
                onPress={handleToggleFollow}
                disabled={followPending}
                activeOpacity={0.85}
              >
                {followPending ? (
                  <ActivityIndicator
                    size="small"
                    color={following ? Colors.purpleSoft : Colors.white}
                  />
                ) : (
                  <View style={styles.followInner}>
                    <Ionicons
                      name={following ? 'notifications' : 'add'}
                      size={16}
                      color={following ? Colors.purpleSoft : Colors.white}
                    />
                    <Text style={[styles.followText, following && styles.followingText]}>
                      {following
                        ? cp.following ?? t.teamProfile.following
                        : cp.follow ?? t.teamProfile.follow}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.tabs}>
            {tabKeys.map((key) => {
              const active = tab === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.tabChip, active && styles.tabChipActive]}
                  onPress={() => setTab(key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {tabLabel(key)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {tab === 'scorers' ? (
            <View>
              <Text style={styles.section}>{cp.scorers ?? cp.topScorers}</Text>
              {statsQ.isLoading ? (
                <ActivityIndicator color={Colors.purpleSoft} style={{ marginVertical: 20 }} />
              ) : boards.length === 0 ? (
                <Text style={styles.mutedCenter}>{cp.noScorers}</Text>
              ) : (
                <View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.boardRow}
                  >
                    {boards.map((board, boardIdx) => {
                      const active = activeBoard?.key === board.key;
                      return (
                        <TouchableOpacity
                          key={`board-${board.key}-${board.typeId ?? 'x'}-${boardIdx}`}
                          style={[styles.boardChip, active && styles.boardChipActive]}
                          onPress={() => setBoardKey(board.key)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[styles.boardChipText, active && styles.boardChipTextActive]}
                            numberOfLines={1}
                          >
                            {boardLabel(board, cp.topScorers)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.card}>
                    {boardRows.map((row, idx) => (
                      <TouchableOpacity
                        key={`scorer-${activeBoard?.key ?? 'b'}-${row.athleteId || 'x'}-${idx}`}
                        style={styles.scorerRow}
                        activeOpacity={0.8}
                        onPress={() => openPlayer(row)}
                      >
                        <Text style={styles.scorerRank}>{idx + 1}</Text>
                        <CachedAthletePhoto
                          uri={row.photo}
                          size={40}
                          recyclingKey={row.athleteId}
                        />
                        <View style={styles.scorerInfo}>
                          <Text style={styles.scorerName} numberOfLines={1}>
                            {row.name}
                          </Text>
                          {row.positionName ? (
                            <Text style={styles.scorerPos} numberOfLines={1}>
                              {row.positionName}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.scorerValue}>{row.value}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : null}

          {tab === 'matches' ? (
            matchesQ.isLoading && !matchesQ.data ? (
              <ActivityIndicator color={Colors.purpleSoft} style={{ marginVertical: 24 }} />
            ) : (
              <MatchesTab
                matches={matchesQ.data}
                language={language}
                t={t}
                onOpenMatch={openMatch}
              />
            )
          ) : null}

          {tab === 'table' ? (
            <View>
              <Text style={styles.section}>{cp.table}</Text>
              {!hasStandings ? (
                <Text style={styles.mutedCenter}>{cp.noTable}</Text>
              ) : standingsQ.isLoading ? (
                <ActivityIndicator color={Colors.purpleSoft} style={{ marginTop: 24 }} />
              ) : groups.length === 0 ? (
                <Text style={styles.mutedCenter}>{cp.noTable}</Text>
              ) : (
                groups.map(([groupNum, group]) => (
                  <View key={`standings-group-${groupNum}`} style={styles.tableCard}>
                    {group.name ? <Text style={styles.groupName}>{group.name}</Text> : null}
                    <View style={styles.headerRow}>
                      <Text style={styles.cellPos}>#</Text>
                      <Text style={[styles.teamName, { flex: 1 }]}>{' '}</Text>
                      <Text style={styles.cell}>P</Text>
                      <Text style={styles.cellPts}>Pts</Text>
                    </View>
                    {group.rows.map((row, rowIdx) => (
                      <TouchableOpacity
                        key={`standings-row-${groupNum}-${row.teamId || 't'}-${row.position}-${rowIdx}`}
                        style={styles.row}
                        onPress={() =>
                          router.push({
                            pathname: '/team-profile' as any,
                            params: {
                              id: String(row.teamId),
                              name: row.teamName,
                              logo: row.teamLogo,
                            },
                          } as any)
                        }
                      >
                        <Text style={styles.cellPos}>{row.position}</Text>
                        <View style={styles.teamCell}>
                          <TeamBadge
                            name={row.teamName}
                            logo={row.teamLogo}
                            size={22}
                            color="transparent"
                          />
                          <Text style={styles.teamName} numberOfLines={1}>
                            {getTeamDisplayName(row.teamName, language)}
                          </Text>
                        </View>
                        <Text style={styles.cell}>{row.gamePlayed}</Text>
                        <Text style={styles.cellPts}>{row.points}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.white08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    flex: 1,
    textAlign: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  muted: { color: Colors.textMuted },
  mutedCenter: {
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.base,
  },
  hero: { alignItems: 'center', paddingVertical: Spacing['2xl'], gap: Spacing.sm },
  crestRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surfaceGlass,
    borderWidth: 2,
    borderColor: 'rgba(124,58,237,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  crestImage: { width: 72, height: 72 },
  name: {
    color: Colors.textPrimary,
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  meta: { color: Colors.textSecondary, fontSize: FontSize.lg },
  followHint: {
    color: Colors.purpleSoft,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  followHintMuted: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  followBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.purpleSoft,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.purpleSoft,
  },
  followText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  followingText: { color: Colors.purpleSoft },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.white08,
  },
  tabChipActive: { backgroundColor: Colors.purpleSoft },
  tabText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.md },
  tabTextActive: { color: Colors.white },
  section: {
    color: Colors.textPrimary,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  boardRow: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  boardChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.chip,
    backgroundColor: Colors.white04,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    maxWidth: 180,
  },
  boardChipActive: {
    backgroundColor: Colors.purpleMuted,
    borderColor: Colors.purpleSoft,
  },
  boardChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  boardChipTextActive: {
    color: Colors.purpleSoft,
  },
  card: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surfaceGlass,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
  },
  scorerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  scorerRank: { width: 22, color: Colors.textMuted, fontWeight: FontWeight.bold },
  scorerInfo: { flex: 1, minWidth: 0 },
  scorerName: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  scorerPos: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 1 },
  scorerValue: { color: Colors.purpleSoft, fontWeight: FontWeight.bold, fontSize: FontSize.lg },
  tableCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surfaceGlass,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingVertical: Spacing.sm,
  },
  groupName: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  cellPos: { width: 28, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: { color: Colors.textPrimary, fontSize: FontSize.md, flex: 1 },
  cell: { width: 28, textAlign: 'right', color: Colors.textSecondary },
  cellPts: { width: 36, textAlign: 'right', color: Colors.textPrimary, fontWeight: FontWeight.bold },
});
