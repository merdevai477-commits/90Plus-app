/**
 * Pre-kickoff Highlights: top players by position — Figma 1700:11644 / 1700:11836.
 */
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './MatchText';
import { LinearGradient } from 'expo-linear-gradient';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
import { useCompetitorSquad, useCompetitorStats } from '../../hooks/useTeamProfile';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';
import {
  formatTopPlayerRole,
  pickMatchTopPlayer,
  pickMatchTopPlayers,
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
  byPosition: string;
  hint: string;
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

const TABS: MatchTopPlayersTab[] = ['defense', 'midfield', 'attack'];

const CARD_SHADOW = {
  shadowColor: '#4B1FA3',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
  elevation: 2,
} as const;

function tabLabel(tab: MatchTopPlayersTab, labels: MatchTopPlayersLabels): string {
  if (tab === 'attack') return labels.attack;
  if (tab === 'midfield') return labels.midfield;
  return labels.defense;
}

function PlayerMiniCard({
  player,
  role,
  ink,
  accent,
  photoBg,
  cardBg,
  onPress,
}: {
  player: MatchTopPlayer | null;
  role: string;
  ink: string;
  accent: string;
  photoBg: string;
  cardBg: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={styles.playerHeader}>
        <View style={styles.jerseyBadge}>
          <Text style={styles.jerseyText}>
            {player?.jerseyNumber != null ? String(player.jerseyNumber) : '—'}
          </Text>
        </View>
        <View style={[styles.photoWrap, { backgroundColor: photoBg }]}>
          <CachedAthletePhoto
            uri={player?.photo}
            size={52}
            recyclingKey={player?.athleteId ?? 'empty'}
          />
        </View>
      </View>
      <View style={styles.playerDetails}>
        <Text style={[styles.playerName, { color: ink }]} numberOfLines={1}>
          {player?.name ?? '—'}
        </Text>
        <Text style={[styles.playerRole, { color: accent }]} numberOfLines={1}>
          {role}
        </Text>
      </View>
    </>
  );

  if (!player || !onPress) {
    return <View style={[styles.playerCard, CARD_SHADOW, { backgroundColor: cardBg }]}>{body}</View>;
  }

  return (
    <TouchableOpacity
      style={[styles.playerCard, CARD_SHADOW, { backgroundColor: cardBg }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={player.name}
    >
      {body}
    </TouchableOpacity>
  );
}

export function MatchTopPlayersCard({
  homeCompetitorId,
  awayCompetitorId,
  competitionId,
  homeTeam,
  awayTeam,
  rtl: _rtl,
  labels,
  onOpenPlayer,
}: Props) {
  void _rtl;
  const { colors, isDark } = useMatchDetailsTheme();
  const [tab, setTab] = useState<MatchTopPlayersTab>('attack');
  const enabled = homeCompetitorId > 0 && awayCompetitorId > 0 && competitionId > 0;
  const homeStats = useCompetitorStats(homeCompetitorId, competitionId, enabled, { roster: true });
  const awayStats = useCompetitorStats(awayCompetitorId, competitionId, enabled, { roster: true });
  const homeSquad = useCompetitorSquad(homeCompetitorId, enabled);
  const awaySquad = useCompetitorSquad(awayCompetitorId, enabled);

  const homePlayers = useMemo(
    () => pickMatchTopPlayers(homeStats.data, homeSquad.data, homeCompetitorId, tab, 2),
    [homeStats.data, homeSquad.data, homeCompetitorId, tab],
  );
  const awayPlayers = useMemo(
    () => pickMatchTopPlayers(awayStats.data, awaySquad.data, awayCompetitorId, tab, 2),
    [awayStats.data, awaySquad.data, awayCompetitorId, tab],
  );

  const hasAnyPlayer = useMemo(() => {
    return (['attack', 'midfield', 'defense'] as MatchTopPlayersTab[]).some(
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

  const ink = isDark ? colors.textPrimary : '#24104E';
  const titleInk = isDark ? colors.textPrimary : '#30135F';
  const accent = isDark ? colors.primarySoft : '#6A2BD9';
  const muted = isDark ? colors.textMuted : '#6B7280';
  const tabBarBg = isDark ? colors.elevatedBg : '#FDFAFF';
  const tabIdleBg = isDark ? colors.primaryMuted : '#F7F1FF';
  const tabIdleText = isDark ? colors.primarySoft : '#4B1FA3';
  const compareBg = isDark ? colors.elevatedBg : '#FFFFFF';
  const miniCardBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const photoBg = isDark ? 'rgba(168,85,247,0.18)' : '#F6EFFF';
  const fallbackPos = tabLabel(tab, labels);

  const slots: Array<{ player: MatchTopPlayer | null; team: TeamRef }> = [
    { player: homePlayers[0] ?? null, team: homeTeam },
    { player: awayPlayers[0] ?? null, team: awayTeam },
    { player: homePlayers[1] ?? null, team: homeTeam },
    { player: awayPlayers[1] ?? null, team: awayTeam },
  ];

  return (
    <View style={styles.wrap} testID="match-top-players">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionHint, { color: accent }]} numberOfLines={1}>
          {labels.byPosition}
        </Text>
        <Text style={[styles.sectionTitle, { color: titleInk }]} numberOfLines={1}>
          {labels.title}
        </Text>
      </View>

      <View style={[styles.tabsBar, CARD_SHADOW, { backgroundColor: tabBarBg }]}>
        {TABS.map((item) => {
          const selected = item === tab;
          return (
            <TouchableOpacity
              key={item}
              testID={`top-players-tab-${item}`}
              style={[styles.tab, { backgroundColor: selected ? 'transparent' : tabIdleBg }]}
              onPress={() => setTab(item)}
              activeOpacity={0.85}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              {selected ? (
                <LinearGradient
                  colors={['#AE62FF', '#6226CB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text
                style={[
                  styles.tabText,
                  { color: selected ? '#FFFFFF' : tabIdleText },
                ]}
              >
                {tabLabel(item, labels)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.compareCard, CARD_SHADOW, { backgroundColor: compareBg }]}>
        <View style={styles.teamHeaders}>
          <Text style={[styles.teamName, { color: accent }]} numberOfLines={1}>
            {homeTeam.name}
          </Text>
          <Text style={[styles.teamName, { color: accent }]} numberOfLines={1}>
            {awayTeam.name}
          </Text>
        </View>

        <View style={styles.playerGrid}>
          {slots.map((slot, index) => (
            <PlayerMiniCard
              key={`${slot.team.id}-${slot.player?.athleteId ?? index}`}
              player={slot.player}
              role={
                slot.player
                  ? formatTopPlayerRole(slot.player, tab, labels, fallbackPos)
                  : fallbackPos
              }
              ink={ink}
              accent={accent}
              photoBg={photoBg}
              cardBg={miniCardBg}
              onPress={
                slot.player ? () => onOpenPlayer(slot.player!, slot.team) : undefined
              }
            />
          ))}
        </View>

        <Text style={[styles.footerHint, { color: muted }]}>{labels.hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 2,
    paddingBottom: 24,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    direction: 'ltr',
  },
  sectionHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tabsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 16,
    width: '100%',
    direction: 'ltr',
  },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  compareCard: {
    width: '100%',
    borderRadius: 21,
    paddingHorizontal: 19,
    paddingVertical: 17,
    gap: 12,
  },
  teamHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
    paddingHorizontal: 12,
    width: '100%',
    direction: 'ltr',
  },
  teamName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    rowGap: 10,
    width: '100%',
    direction: 'ltr',
  },
  playerCard: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 120,
    borderRadius: 17,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 10,
    justifyContent: 'center',
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 16,
    width: '100%',
    direction: 'ltr',
  },
  jerseyBadge: {
    minWidth: 33,
    height: 19,
    borderRadius: 35,
    backgroundColor: '#4B1FA3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  jerseyText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  photoWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
  },
  playerDetails: {
    width: '100%',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 6,
  },
  playerName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
  },
  playerRole: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  footerHint: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    width: '100%',
  },
});
