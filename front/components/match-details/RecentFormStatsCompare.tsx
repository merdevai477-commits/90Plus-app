/**
 * Last-N form comparison when this match has no live statistics.
 * Bars follow MatchStatsCompare (Figma 550:2626).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RecentTeamFormSummary } from '../../utils/recentTeamFormStats';

const TRACK_BG = '#1a1a1a';
const HOME_PURPLE = '#630db4';
const HOME_PURPLE_DEEP = '#240145';
const AWAY_GRAY = '#494949';
const AWAY_GRAY_DIM = '#262626';
const CARD_BORDER = '#2d0652';

function DualBar({ home, away }: { home: number; away: number }) {
  const total = home + away;
  const homeFlex = total > 0 ? home : 1;
  const awayFlex = total > 0 ? away : 1;

  return (
    <View style={styles.barTrack}>
      {total === 0 ? (
        <View style={styles.barEmpty} />
      ) : (
        <>
          <LinearGradient
            colors={[HOME_PURPLE, HOME_PURPLE_DEEP]}
            start={{ x: 1, y: 0.5 }}
            end={{ x: 0, y: 0.5 }}
            style={[styles.barHome, { flex: homeFlex }, home === 0 && styles.barZero]}
          />
          <LinearGradient
            colors={[AWAY_GRAY_DIM, AWAY_GRAY]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.barAway, { flex: awayFlex }, away === 0 && styles.barZero]}
          />
        </>
      )}
    </View>
  );
}

function BarStatRow({
  label,
  home,
  away,
}: {
  label: string;
  home: number;
  away: number;
}) {
  return (
    <View style={styles.barBlock}>
      <Text style={styles.barTitle}>{label}</Text>
      <View style={styles.barRow}>
        <Text style={styles.barValue}>{home}</Text>
        <DualBar home={home} away={away} />
        <Text style={styles.barValue}>{away}</Text>
      </View>
    </View>
  );
}

function FormPills({ form }: { form: string }) {
  return (
    <View style={styles.pills}>
      {form.split('').map((letter, index) => (
        <View
          key={`${letter}-${index}`}
          style={[
            styles.pill,
            letter === 'W' && styles.pillWin,
            letter === 'D' && styles.pillDraw,
            letter === 'L' && styles.pillLose,
          ]}
        >
          <Text style={styles.pillText}>{letter}</Text>
        </View>
      ))}
    </View>
  );
}

export function RecentFormStatsCompare({
  title,
  hint,
  homeName,
  awayName,
  home,
  away,
  labels,
}: {
  title: string;
  hint: string;
  homeName: string;
  awayName: string;
  home: RecentTeamFormSummary;
  away: RecentTeamFormSummary;
  labels: {
    wins: string;
    draws: string;
    losses: string;
    goalsFor: string;
    goalsAgainst: string;
  };
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <View style={styles.namesRow}>
        <Text style={[styles.teamName, styles.teamNameHome]} numberOfLines={1}>
          {homeName}
        </Text>
        <Text style={[styles.teamName, styles.teamNameAway]} numberOfLines={1}>
          {awayName}
        </Text>
      </View>
      <View style={styles.formRow}>
        <FormPills form={home.form} />
        <FormPills form={away.form} />
      </View>
      <View style={styles.barsCol}>
        <BarStatRow label={labels.wins} home={home.wins} away={away.wins} />
        <BarStatRow label={labels.draws} home={home.draws} away={away.draws} />
        <BarStatRow label={labels.losses} home={home.losses} away={away.losses} />
        <BarStatRow label={labels.goalsFor} home={home.goalsFor} away={away.goalsFor} />
        <BarStatRow label={labels.goalsAgainst} home={home.goalsAgainst} away={away.goalsAgainst} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#07040d',
    gap: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  hint: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  namesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  teamName: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
  },
  teamNameHome: {
    textAlign: 'left',
  },
  teamNameAway: {
    textAlign: 'right',
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  pills: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  pill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
  },
  pillWin: { backgroundColor: '#15803d' },
  pillDraw: { backgroundColor: '#6b7280' },
  pillLose: { backgroundColor: '#b91c1c' },
  pillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  barsCol: {
    width: '100%',
    gap: 16,
  },
  barBlock: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  barTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 6,
  },
  barValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 22,
    textAlign: 'center',
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 33,
    backgroundColor: TRACK_BG,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barHome: {
    height: 10,
    borderTopLeftRadius: 33,
    borderBottomLeftRadius: 33,
  },
  barAway: {
    height: 10,
    borderTopRightRadius: 33,
    borderBottomRightRadius: 33,
  },
  barZero: {
    flex: 0,
    width: 0,
  },
  barEmpty: {
    flex: 1,
    height: 10,
    backgroundColor: TRACK_BG,
  },
});
