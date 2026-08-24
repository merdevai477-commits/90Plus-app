import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
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
    goalDiff: string;
    points: string;
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
  return (
    <>
      <View style={styles.header}>
        <Text style={[styles.headerText, { width: 30 }]}>{labels.rank}</Text>
        <Text style={[styles.headerText, { flex: 1, textAlign: 'left' }]}>{labels.team}</Text>
        <Text style={[styles.headerText, { width: 30 }]}>{labels.played}</Text>
        <Text style={[styles.headerText, { width: 30 }]}>{labels.goalDiff}</Text>
        <Text style={[styles.headerText, { width: 30 }]}>{labels.points}</Text>
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
            <Text style={[styles.text, { width: 30 }]}>{team.rank}</Text>
            <View style={styles.teamCell}>
              <Image source={{ uri: team.team.logo }} style={styles.logo} />
              <Text style={[styles.text, styles.teamName]} numberOfLines={1}>
                {getTeamDisplayName(team.team.name, language)}
              </Text>
            </View>
            <Text style={[styles.text, { width: 30 }]}>{team.all.played}</Text>
            <Text style={[styles.text, { width: 30 }]}>{team.goalsDiff}</Text>
            <Text style={[styles.text, styles.points, { width: 30 }]}>{team.points}</Text>
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
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
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
  teamCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
