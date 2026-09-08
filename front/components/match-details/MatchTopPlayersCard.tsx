/**
 * Pre-kickoff Events tab: home vs away featured players by position
 * (attack / midfield / defense), from 365 competitor leaderboards.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
import { useCompetitorSquad, useCompetitorStats } from '../../hooks/useTeamProfile';
import {
  BLUE_ELECTRIC,
  GLASS_BORDER_BOTTOM,
  GLASS_BORDER_SIDE,
  GLASS_BORDER_TOP,
  TEXT_PRIMARY,
} from '../../constants/tokens';
import {
  formatTopPlayerStat,
  pickMatchTopPlayer,
  type MatchTopPlayer,
  type MatchTopPlayersTab,
} from '../../utils/matchTopPlayers';

type TeamRef = {
  id: number;
  name: string;
  logo?: string | null;
};

export type MatchTopPlayersLabels = {
  title: string;
  attack: string;
  midfield: string;
  defense: string;
  goals: string;
  assists: string;
  rating: string;
};

type Props = {
  homeCompetitorId: number;
  awayCompetitorId: number;
  competitionId: number;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  rtl: boolean;
  labels: MatchTopPlayersLabels;
  onOpenPlayer: (player: MatchTopPlayer, team: TeamRef) => void;
};

const TABS: MatchTopPlayersTab[] = ['attack', 'midfield', 'defense'];

function tabLabel(tab: MatchTopPlayersTab, labels: MatchTopPlayersLabels): string {
  if (tab === 'attack') return labels.attack;
  if (tab === 'midfield') return labels.midfield;
  return labels.defense;
}

function StatBox({ value }: { value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function PlayerColumn({
  player,
  onPress,
}: {
  player: MatchTopPlayer | null;
  onPress: () => void;
}) {
  const inner = (
    <>
      <View style={styles.photoRing}>
        <CachedAthletePhoto
          uri={player?.photo}
          size={64}
          recyclingKey={player?.athleteId ?? 'empty'}
        />
      </View>
      <Text style={styles.playerName} numberOfLines={2}>
        {player?.name ?? '—'}
      </Text>
    </>
  );

  if (!player) {
    return <View style={styles.playerCol}>{inner}</View>;
  }

  return (
    <TouchableOpacity
      style={styles.playerCol}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={player.name}
    >
      {inner}
    </TouchableOpacity>
  );
}

export function MatchTopPlayersCard({
  homeCompetitorId,
  awayCompetitorId,
  competitionId,
  homeTeam,
  awayTeam,
  rtl,
  labels,
  onOpenPlayer,
}: Props) {
  const [tab, setTab] = useState<MatchTopPlayersTab>('attack');
  const enabled = homeCompetitorId > 0 && awayCompetitorId > 0 && competitionId > 0;
  const homeStats = useCompetitorStats(homeCompetitorId, competitionId, enabled);
  const awayStats = useCompetitorStats(awayCompetitorId, competitionId, enabled);
  const homeSquad = useCompetitorSquad(homeCompetitorId, enabled);
  const awaySquad = useCompetitorSquad(awayCompetitorId, enabled);

  const homePlayer = useMemo(
    () => pickMatchTopPlayer(homeStats.data, homeSquad.data, homeCompetitorId, tab),
    [homeStats.data, homeSquad.data, homeCompetitorId, tab],
  );
  const awayPlayer = useMemo(
    () => pickMatchTopPlayer(awayStats.data, awaySquad.data, awayCompetitorId, tab),
    [awayStats.data, awaySquad.data, awayCompetitorId, tab],
  );
  const hasAnyPlayer = useMemo(() => {
    return TABS.some(
      (item) =>
        !!pickMatchTopPlayer(homeStats.data, homeSquad.data, homeCompetitorId, item) ||
        !!pickMatchTopPlayer(awayStats.data, awaySquad.data, awayCompetitorId, item),
    );
  }, [
    homeStats.data,
    homeSquad.data,
    homeCompetitorId,
    awayStats.data,
    awaySquad.data,
    awayCompetitorId,
  ]);

  if (!enabled || !hasAnyPlayer) return null;

  const rowDir = rtl ? 'row-reverse' : 'row';
  const titleAlign = rtl ? 'right' : 'left';

  return (
    <View style={styles.wrap} testID="match-top-players">
      <View style={styles.card}>
        <LinearGradient
          colors={['rgba(124,58,237,0.16)', 'rgba(59,130,246,0.08)', 'rgba(10,6,18,0.20)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Text style={[styles.title, { textAlign: titleAlign }]}>{labels.title}</Text>
        <View style={styles.titleRule} />

        <View style={[styles.tabs, { flexDirection: rowDir }]}>
          {TABS.map((item) => {
            const selected = item === tab;
            return (
              <TouchableOpacity
                key={item}
                testID={`top-players-tab-${item}`}
                style={[styles.tab, selected && styles.tabSelected]}
                onPress={() => setTab(item)}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                  {tabLabel(item, labels)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.compare, { flexDirection: rowDir }]}>
          <PlayerColumn
            player={homePlayer}
            onPress={() => homePlayer && onOpenPlayer(homePlayer, homeTeam)}
          />
          <View style={styles.statCol}>
            <StatBox value={formatTopPlayerStat(homePlayer?.goals ?? 0, 'int')} />
            <StatBox value={formatTopPlayerStat(homePlayer?.assists ?? 0, 'int')} />
            <StatBox value={formatTopPlayerStat(homePlayer?.rating ?? 0, 'rating')} />
          </View>
          <View style={styles.labelCol}>
            <Text style={styles.statLabel}>{labels.goals}</Text>
            <Text style={styles.statLabel}>{labels.assists}</Text>
            <Text style={styles.statLabel}>{labels.rating}</Text>
          </View>
          <View style={styles.statCol}>
            <StatBox value={formatTopPlayerStat(awayPlayer?.goals ?? 0, 'int')} />
            <StatBox value={formatTopPlayerStat(awayPlayer?.assists ?? 0, 'int')} />
            <StatBox value={formatTopPlayerStat(awayPlayer?.rating ?? 0, 'rating')} />
          </View>
          <PlayerColumn
            player={awayPlayer}
            onPress={() => awayPlayer && onOpenPlayer(awayPlayer, awayTeam)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER_SIDE,
    borderTopColor: GLASS_BORDER_TOP,
    borderBottomColor: GLASS_BORDER_BOTTOM,
    padding: 16,
    gap: 14,
    backgroundColor: 'rgba(12,8,20,0.92)',
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
  titleRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: -6,
  },
  tabs: {
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,6,16,0.85)',
    borderWidth: 1,
    borderColor: BLUE_ELECTRIC,
    paddingHorizontal: 6,
  },
  tabSelected: {
    backgroundColor: BLUE_ELECTRIC,
    borderColor: BLUE_ELECTRIC,
  },
  tabText: {
    color: BLUE_ELECTRIC,
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextSelected: {
    color: TEXT_PRIMARY,
  },
  compare: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    gap: 6,
  },
  playerCol: {
    width: 78,
    alignItems: 'center',
    gap: 8,
  },
  photoRing: {
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.88)',
    padding: 1,
  },
  playerName: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  statCol: {
    gap: 10,
    alignItems: 'center',
  },
  labelCol: {
    flex: 1,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  statBox: {
    minWidth: 36,
    minHeight: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '600',
    minHeight: 32,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 32,
  },
});
