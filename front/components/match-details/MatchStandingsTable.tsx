import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from './MatchText';
import TeamBadge from '../common/TeamBadge';
import type { Standing } from '../../services/apiFootball';
import { displayMatchTeamName, presentTeamLogo } from '../../utils/maskedNationalTeam';
import { standingRowMatchesTeam } from '../../utils/standingsHelpers';
import type { Language } from '../../src/i18n';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

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
    pointsExplain?: string;
    gdExplain?: string;
    formWin?: string;
    formDraw?: string;
    formLoss?: string;
  };
  onPressTeam: (row: Standing) => void;
};

function formatGd(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function MatchStandingsTableComponent({
  rows,
  keyPrefix,
  language,
  homeRef,
  awayRef,
  labels,
  onPressTeam,
}: MatchStandingsTableProps) {
  const { colors, isDark } = useMatchDetailsTheme();
  const { width } = useWindowDimensions();
  const compact = width < 400;
  const colW = compact ? 26 : 30;
  const rankW = compact ? 28 : 32;
  const ptsW = compact ? 36 : 42;
  const header = {
    played: labels.played,
    goalsFor: compact ? labels.goalsForShort : labels.goalsFor,
    goalsAgainst: compact ? labels.goalsAgainstShort : labels.goalsAgainst,
    goalDiff: compact ? labels.goalDiffShort : labels.goalDiff,
    points: compact ? labels.pointsShort : labels.points,
  };

  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : colors.cardBg;
  const cardBorder = isDark ? 'rgba(168,85,247,0.28)' : colors.cardBorder;
  const headerBg = isDark ? '#5B21B6' : colors.primary;
  const rowText = colors.textPrimary;
  const muted = colors.textMuted;
  const highlightBg = isDark ? 'rgba(168,85,247,0.18)' : 'rgba(106,43,217,0.1)';
  const ptsBg = isDark ? 'rgba(168,85,247,0.22)' : '#F2EBFC';
  const ptsColor = isDark ? '#E9D5FF' : '#4B1FA3';
  const rankBg = isDark ? 'rgba(255,255,255,0.08)' : '#F3EDFF';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
          shadowOpacity: isDark ? 0 : 0.14,
          elevation: isDark ? 0 : 3,
        },
      ]}
    >
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <Text style={[styles.headerText, { width: rankW }]} numberOfLines={1}>
          {labels.rank}
        </Text>
        <Text style={[styles.headerText, styles.teamHeader]} numberOfLines={1}>
          {labels.team}
        </Text>
        <Text style={[styles.headerText, { width: colW }]} numberOfLines={1}>
          {header.played}
        </Text>
        <Text style={[styles.headerText, { width: colW }]} numberOfLines={1}>
          {header.goalsFor}
        </Text>
        <Text style={[styles.headerText, { width: colW }]} numberOfLines={1}>
          {header.goalsAgainst}
        </Text>
        <Text style={[styles.headerText, { width: colW + 4 }]} numberOfLines={1}>
          {header.goalDiff}
        </Text>
        <Text style={[styles.headerText, { width: ptsW }]} numberOfLines={1}>
          {header.points}
        </Text>
      </View>

      {rows.map((team, index) => {
        const isHighlighted =
          standingRowMatchesTeam(team, homeRef) || standingRowMatchesTeam(team, awayRef);
        const gd = team.goalsDiff ?? 0;
        const gdColor = gd > 0 ? '#16A34A' : gd < 0 ? '#DC2626' : rowText;

        return (
          <TouchableOpacity
            key={`${keyPrefix}-${team.team.id ?? index}`}
            style={[styles.row, isHighlighted && { backgroundColor: highlightBg }]}
            onPress={() => onPressTeam(team)}
            activeOpacity={0.75}
          >
            <View style={[styles.rankCircle, { width: rankW, height: rankW, backgroundColor: rankBg }]}>
              <Text style={[styles.rankText, { color: rowText }]}>{team.rank}</Text>
            </View>
            <View style={styles.teamCell}>
              <TeamBadge
                name={team.team.name}
                logo={presentTeamLogo(team.team.name, team.team.logo, team.team.id)}
                size={24}
                color="transparent"
              />
              <Text style={[styles.teamName, { color: rowText }]} numberOfLines={1}>
                {displayMatchTeamName(team.team.name, language as Language, team.team.id, team.team.logo)}
              </Text>
            </View>
            <Text style={[styles.cell, { width: colW, color: rowText }]}>{team.all.played}</Text>
            <Text style={[styles.cell, { width: colW, color: rowText }]}>{team.all.goals.for}</Text>
            <Text style={[styles.cell, { width: colW, color: rowText }]}>{team.all.goals.against}</Text>
            <Text style={[styles.cell, { width: colW + 4, color: gdColor, fontWeight: '700' }]}>
              {formatGd(gd)}
            </Text>
            <View style={[styles.pointsPill, { width: ptsW, backgroundColor: ptsBg }]}>
              <Text style={[styles.pointsText, { color: ptsColor }]}>{team.points}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {(labels.pointsExplain || labels.gdExplain || labels.formWin) && (
        <View style={styles.legend}>
          <View style={styles.legendTextCol}>
            {labels.pointsExplain ? (
              <Text style={[styles.legendText, { color: muted }]}>{labels.pointsExplain}</Text>
            ) : null}
            {labels.gdExplain ? (
              <Text style={[styles.legendText, { color: muted }]}>{labels.gdExplain}</Text>
            ) : null}
          </View>
          <View style={styles.formPills}>
            {labels.formWin ? (
              <View style={[styles.formPill, { backgroundColor: '#22C55E' }]}>
                <Text style={styles.formPillText}>{labels.formWin}</Text>
              </View>
            ) : null}
            {labels.formDraw ? (
              <View style={[styles.formPill, { backgroundColor: '#3B82F6' }]}>
                <Text style={styles.formPillText}>{labels.formDraw}</Text>
              </View>
            ) : null}
            {labels.formLoss ? (
              <View style={[styles.formPill, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.formPillText}>{labels.formLoss}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

export const MatchStandingsTable = memo(MatchStandingsTableComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#4B1FA3',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  teamHeader: {
    flex: 1,
    textAlign: 'left',
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(106,43,217,0.12)',
  },
  rankCircle: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  teamCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
  },
  teamName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
  },
  cell: {
    fontSize: 12,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  pointsPill: {
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  legendTextCol: {
    flex: 1,
    gap: 2,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '500',
  },
  formPills: {
    flexDirection: 'row',
    gap: 6,
  },
  formPill: {
    minWidth: 34,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  formPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
