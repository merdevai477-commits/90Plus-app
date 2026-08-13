/**
 * Squad tab: current players for a 365 competitor, grouped by position.
 * Tapping a player opens Player Career (not match statistics).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import type { TranslationKeys } from '../../src/i18n/utils';
import type { Competitor365Squad, Squad365Player, SquadPositionGroup } from '../../services/apiFootball';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
import { Card, EmptyState, SectionTitle } from './shared';

interface SquadTabProps {
  squad: Competitor365Squad | null | undefined;
  loading?: boolean;
  t: TranslationKeys;
  onOpenPlayer: (player: Squad365Player) => void;
}

const GROUP_ORDER: SquadPositionGroup[] = [
  'goalkeeper',
  'defender',
  'midfielder',
  'forward',
  'other',
];

function groupLabel(group: SquadPositionGroup, t: TranslationKeys): string {
  switch (group) {
    case 'goalkeeper':
      return t.teamProfile.goalkeepers;
    case 'defender':
      return t.teamProfile.defenders;
    case 'midfielder':
      return t.teamProfile.midfielders;
    case 'forward':
      return t.teamProfile.forwards;
    default:
      return t.teamProfile.otherPlayers;
  }
}

function PlayerCard({
  player,
  onPress,
}: {
  player: Squad365Player;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <CachedAthletePhoto uri={player.photo} size={56} recyclingKey={player.athleteId} />
      {player.jerseyNumber != null ? (
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{player.jerseyNumber}</Text>
        </View>
      ) : null}
      <Text style={styles.name} numberOfLines={2}>
        {player.shortName || player.name}
      </Text>
      {player.position ? (
        <Text style={styles.position} numberOfLines={1}>
          {player.position}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function SquadTab({ squad, loading, t, onOpenPlayer }: SquadTabProps) {
  if (loading && !squad) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.purpleSoft} />
      </View>
    );
  }

  const players = squad?.players ?? [];
  if (players.length === 0) {
    return (
      <View style={styles.container}>
        <Card>
          <EmptyState text={t.teamProfile.noSquadData} icon="people-outline" />
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {GROUP_ORDER.map((group) => {
        const list = squad?.groups?.[group] ?? [];
        if (list.length === 0) return null;
        return (
          <View key={group} style={styles.section}>
            <SectionTitle title={`${groupLabel(group, t)}  ${list.length}`} />
            <View style={styles.grid}>
              {list.map((player) => (
                <PlayerCard
                  key={player.athleteId}
                  player={player}
                  onPress={() => onOpenPlayer(player)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    gap: Spacing.lg,
  },
  loading: {
    paddingVertical: Spacing['5xl'],
    alignItems: 'center',
  },
  section: {
    gap: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  card: {
    width: '31%',
    flexGrow: 1,
    maxWidth: '32%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.white04,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: Spacing.xs,
  },
  numberBadge: {
    marginTop: -Spacing.md,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.purplePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  position: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
