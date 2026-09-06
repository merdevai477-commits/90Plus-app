import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, useWindowDimensions } from 'react-native';
import type { Standing } from '../../services/apiFootball';
import { getTeamDisplayName } from '../../utils/i18nHelpers';
import { standingRowMatchesTeam } from '../../utils/standingsHelpers';

type TeamRef = { id?: number | null; name?: string | null };

export type MatchStandingsTableProps = {
  rows: Standing[];
  keyPrefix: string;
  language: string;
  homeRef: TeamRef;
  awayRef: TeamRef;
  labels: {
    rank: string;
    team: string;
    played: string;
    goalsFor: string;
    goalsAgainst: string;
    goalsForShort: string;
    goalsAgainstShort: string;
    goalDiff: string;
    goalDiffShort: string;
    points: string;
    pointsShort: string;
  };
  onPressTeam: (row: Standing) => void;
};

function MatchStandingsTableComponent({
  rows,
  keyPrefix,
  language,
  homeRef,
  awayRef,
  labels,
  onPressTeam,
}: MatchStandingsTableProps) {
  const { width } = useWindowDimensions();
  const compact = width < 400;
  const colW = compact ? 28 : 34;
  const rankW = compact ? 22 : 26;
  const header = {
    played: labels.played,
    goalsFor: compact ? labels.goalsForShort : labels.goalsFor,
    goalsAgainst: compact ? labels.goalsAgainstShort : labels.goalsAgainst,
    goalDiff: compact ? labels.goalDiffShort : labels.goalDiff,
    points: compact ? labels.pointsShort : labels.points,
  };

  return (
    <>
      <View style={styles.header}>
        <Text style={[styles.headerText, { width: rankW }]}>{labels.rank}</Text>
        <Text style={[styles.headerText, styles.teamHeader]}>{labels.team}</Text>
        <Text style={[styles.headerText, { width: colW }]} numberOfLines={1}>
          {header.played}
        </Text>
        <Text style={[styles.headerText, { width: colW }]} numberOfLines={1}>
          {header.goalsFor}
        </Text>
        <Text style={[styles.headerText, { width: colW }]} numberOfLines={1}>
          {header.goalsAgainst}
        </Text>
        <Text style={[styles.headerText, { width: colW }]} numberOfLines={1}>
          {header.goalDiff}
        </Text>
        <Text style={[styles.headerText, { width: colW }]} numberOfLines={1}>
          {header.points}
        </Text>
      </View>
      {rows.map((team, index) => {
        const isHighlighted =
          standingRowMatchesTeam(team, homeRef) || standingRowMatchesTeam(team, awayRef);

        return (
          <TouchableOpacity
            key={`${keyPrefix}-${team.team.id ?? index}`}
            style={[styles.row, isHighlighted && styles.rowHighlighted]}
            onPress={() => onPressTeam(team)}
            activeOpacity={0.75}
          >
            <Text style={[styles.text, styles.num, { width: rankW }]}>{team.rank}</Text>
            <View style={styles.teamCell}>
              <Image source={{ uri: team.team.logo }} style={styles.logo} />
              <Text style={[styles.text, styles.teamName]} numberOfLines={1}>
                {getTeamDisplayName(team.team.name, language)}
              </Text>
            </View>
            <Text style={[styles.text, styles.num, { width: colW }]}>{team.all.played}</Text>
            <Text style={[styles.text, styles.num, { width: colW }]}>{team.all.goals.for}</Text>
            <Text style={[styles.text, styles.num, { width: colW }]}>{team.all.goals.against}</Text>
            <Text style={[styles.text, styles.num, { width: colW }]}>{team.goalsDiff}</Text>
            <Text style={[styles.text, styles.num, styles.points, { width: colW }]}>{team.points}</Text>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

export const MatchStandingsTable = memo(MatchStandingsTableComponent);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 10,
  },
  headerText: {
    color: '#888',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  teamHeader: {
    flex: 1,
    textAlign: 'left',
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  rowHighlighted: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 8,
    marginHorizontal: -5,
    paddingHorizontal: 5,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  num: {
    fontVariant: ['tabular-nums'],
  },
  teamCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  teamName: {
    flex: 1,
    textAlign: 'left',
  },
  logo: {
    width: 20,
    height: 20,
  },
  points: {
    fontWeight: 'bold',
  },
});
