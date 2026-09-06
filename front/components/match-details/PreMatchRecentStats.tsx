/**
 * Pre-kickoff Statistics tab: last-N averages + trends, with a colored banner
 * so users do not confuse this with live match stats (possession / passes).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  formatPenaltyPair,
  formatStatAverage,
  formatTrendValue,
  pickHighlightSide,
  type RecentFormAveragesPayload,
  type RecentFormAveragesNumbers,
  type RecentTeamAverages,
  type RecentTrend,
} from '../../utils/recentTeamFormStats';

const CARD_BORDER = '#2d0652';
const ROW_LINE = '#2a2a2a';
const HOME_PILL_BG = '#ffffff';
const HOME_PILL_TEXT = '#111111';
const AWAY_PILL_BG = '#dc2626';
const AWAY_PILL_TEXT = '#ffffff';

type AvgKey = keyof RecentFormAveragesNumbers;

function ValuePill({
  value,
  highlight,
  side,
}: {
  value: string;
  highlight: boolean;
  side: 'home' | 'away';
}) {
  return (
    <View
      style={[
        styles.valueSlot,
        highlight && (side === 'home' ? styles.pillHome : styles.pillAway),
      ]}
    >
      <Text
        style={[
          styles.valueText,
          highlight && (side === 'home' ? styles.pillHomeText : styles.pillAwayText),
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function CompareRow({
  label,
  homeValue,
  awayValue,
  homeNum,
  awayNum,
  mode,
}: {
  label: string;
  homeValue: string;
  awayValue: string;
  homeNum: number | null;
  awayNum: number | null;
  mode: 'higher' | 'lower' | 'none';
}) {
  const highlight = mode === 'none' ? null : pickHighlightSide(homeNum, awayNum, mode);
  return (
    <View style={styles.row}>
      <ValuePill value={homeValue} highlight={highlight === 'home'} side="home" />
      <Text style={styles.rowLabel} numberOfLines={2}>
        {label}
      </Text>
      <ValuePill value={awayValue} highlight={highlight === 'away'} side="away" />
    </View>
  );
}

function numOrNull(value: number | null | undefined): number | null {
  return value == null || !Number.isFinite(value) ? null : value;
}

export function PreMatchRecentStats({
  lastN,
  bannerTitle,
  bannerHint,
  title,
  columnLabel,
  homeName,
  awayName,
  homeScore,
  awayScore,
  enrichment,
  labels,
}: {
  lastN: number;
  bannerTitle: string;
  bannerHint: string;
  title: string;
  columnLabel: string;
  homeName: string;
  awayName: string;
  homeScore: RecentTeamAverages;
  awayScore: RecentTeamAverages;
  enrichment: RecentFormAveragesPayload | null;
  labels: {
    goalsScored: string;
    goalsConceded: string;
    expectedGoals: string;
    expectedGoalsAgainst: string;
    shots: string;
    shotsOnTarget: string;
    corners: string;
    cards: string;
    penalties: string;
    won: string;
    btts: string;
    over25: string;
    winOrDraw: string;
    cleanSheets: string;
    trendsTitle: string;
  };
}) {
  const homeAvg: RecentFormAveragesNumbers = {
    goalsFor: enrichment?.home.averages.goalsFor ?? homeScore.avgGoalsFor,
    goalsAgainst: enrichment?.home.averages.goalsAgainst ?? homeScore.avgGoalsAgainst,
    xg: enrichment?.home.averages.xg ?? null,
    xga: enrichment?.home.averages.xga ?? null,
    shots: enrichment?.home.averages.shots ?? null,
    shotsOnTarget: enrichment?.home.averages.shotsOnTarget ?? null,
    corners: enrichment?.home.averages.corners ?? null,
    cards: enrichment?.home.averages.cards ?? null,
    penaltiesScored: enrichment?.home.averages.penaltiesScored ?? null,
    penaltiesWon: enrichment?.home.averages.penaltiesWon ?? null,
  };
  const awayAvg: RecentFormAveragesNumbers = {
    goalsFor: enrichment?.away.averages.goalsFor ?? awayScore.avgGoalsFor,
    goalsAgainst: enrichment?.away.averages.goalsAgainst ?? awayScore.avgGoalsAgainst,
    xg: enrichment?.away.averages.xg ?? null,
    xga: enrichment?.away.averages.xga ?? null,
    shots: enrichment?.away.averages.shots ?? null,
    shotsOnTarget: enrichment?.away.averages.shotsOnTarget ?? null,
    corners: enrichment?.away.averages.corners ?? null,
    cards: enrichment?.away.averages.cards ?? null,
    penaltiesScored: enrichment?.away.averages.penaltiesScored ?? null,
    penaltiesWon: enrichment?.away.averages.penaltiesWon ?? null,
  };

  const homePens = formatPenaltyPair(homeAvg.penaltiesScored, homeAvg.penaltiesWon);
  const awayPens = formatPenaltyPair(awayAvg.penaltiesScored, awayAvg.penaltiesWon);
  const showXg = homeAvg.xg != null || awayAvg.xg != null;
  const showXga = homeAvg.xga != null || awayAvg.xga != null;
  const showShots = homeAvg.shots != null || awayAvg.shots != null;
  const showSot = homeAvg.shotsOnTarget != null || awayAvg.shotsOnTarget != null;
  const showCorners = homeAvg.corners != null || awayAvg.corners != null;
  const showCards = homeAvg.cards != null || awayAvg.cards != null;
  const showPens = homePens != null || awayPens != null;

  const homeWins: RecentTrend = enrichment?.home.trends.wins ?? {
    count: homeScore.wins,
    pct: homeScore.played ? Math.round((homeScore.wins / homeScore.played) * 100) : 0,
  };
  const awayWins: RecentTrend = enrichment?.away.trends.wins ?? {
    count: awayScore.wins,
    pct: awayScore.played ? Math.round((awayScore.wins / awayScore.played) * 100) : 0,
  };
  const homeBtts = enrichment?.home.trends.btts ?? homeScore.btts;
  const awayBtts = enrichment?.away.trends.btts ?? awayScore.btts;
  const homeOver = enrichment?.home.trends.over25 ?? homeScore.over25;
  const awayOver = enrichment?.away.trends.over25 ?? awayScore.over25;
  const homeDc = enrichment?.home.trends.winOrDraw ?? homeScore.winOrDraw;
  const awayDc = enrichment?.away.trends.winOrDraw ?? awayScore.winOrDraw;
  const homeCs = enrichment?.home.trends.cleanSheets ?? homeScore.cleanSheets;
  const awayCs = enrichment?.away.trends.cleanSheets ?? awayScore.cleanSheets;

  const avgRow = (
    key: AvgKey,
    label: string,
    mode: 'higher' | 'lower',
  ) => (
    <CompareRow
      key={key}
      label={label}
      homeValue={formatStatAverage(homeAvg[key])}
      awayValue={formatStatAverage(awayAvg[key])}
      homeNum={numOrNull(homeAvg[key])}
      awayNum={numOrNull(awayAvg[key])}
      mode={mode}
    />
  );

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#7c3aed', '#4c1d95']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <Text style={styles.bannerTitle}>{bannerTitle}</Text>
        <Text style={styles.bannerHint}>{bannerHint}</Text>
      </LinearGradient>

      <Text style={styles.title}>{title}</Text>
      <View style={styles.namesRow}>
        <Text style={[styles.teamName, styles.teamNameHome]} numberOfLines={1}>
          {homeName}
        </Text>
        <Text style={[styles.teamName, styles.teamNameAway]} numberOfLines={1}>
          {awayName}
        </Text>
      </View>
      <View style={styles.columnHeaders}>
        <Text style={styles.columnLabel}>{columnLabel.replace('{n}', String(lastN))}</Text>
        <Text style={styles.columnLabel}>{columnLabel.replace('{n}', String(lastN))}</Text>
      </View>

      {avgRow('goalsFor', labels.goalsScored, 'higher')}
      {avgRow('goalsAgainst', labels.goalsConceded, 'lower')}
      {showXg ? avgRow('xg', labels.expectedGoals, 'higher') : null}
      {showXga ? avgRow('xga', labels.expectedGoalsAgainst, 'lower') : null}
      {showShots ? avgRow('shots', labels.shots, 'higher') : null}
      {showSot ? avgRow('shotsOnTarget', labels.shotsOnTarget, 'higher') : null}
      {showCorners ? avgRow('corners', labels.corners, 'higher') : null}
      {showCards ? avgRow('cards', labels.cards, 'lower') : null}
      {showPens ? (
        <CompareRow
          label={labels.penalties}
          homeValue={homePens ?? '—'}
          awayValue={awayPens ?? '—'}
          homeNum={numOrNull((homeAvg.penaltiesScored ?? 0) + (homeAvg.penaltiesWon ?? 0))}
          awayNum={numOrNull((awayAvg.penaltiesScored ?? 0) + (awayAvg.penaltiesWon ?? 0))}
          mode="higher"
        />
      ) : null}

      <Text style={styles.trendsTitle}>{labels.trendsTitle}</Text>
      <CompareRow
        label={labels.won}
        homeValue={formatTrendValue(homeWins)}
        awayValue={formatTrendValue(awayWins)}
        homeNum={homeWins.pct}
        awayNum={awayWins.pct}
        mode="higher"
      />
      <CompareRow
        label={labels.btts}
        homeValue={formatTrendValue(homeBtts)}
        awayValue={formatTrendValue(awayBtts)}
        homeNum={homeBtts.pct}
        awayNum={awayBtts.pct}
        mode="higher"
      />
      <CompareRow
        label={labels.over25}
        homeValue={formatTrendValue(homeOver)}
        awayValue={formatTrendValue(awayOver)}
        homeNum={homeOver.pct}
        awayNum={awayOver.pct}
        mode="higher"
      />
      <CompareRow
        label={labels.winOrDraw}
        homeValue={formatTrendValue(homeDc)}
        awayValue={formatTrendValue(awayDc)}
        homeNum={homeDc.pct}
        awayNum={awayDc.pct}
        mode="higher"
      />
      <CompareRow
        label={labels.cleanSheets}
        homeValue={formatTrendValue(homeCs)}
        awayValue={formatTrendValue(awayCs)}
        homeNum={homeCs.pct}
        awayNum={awayCs.pct}
        mode="higher"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    backgroundColor: '#07040d',
  },
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  bannerHint: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  namesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    marginBottom: 2,
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
  columnHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  columnLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  trendsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ROW_LINE,
    gap: 6,
  },
  rowLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  valueSlot: {
    minWidth: 64,
    maxWidth: 88,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  pillHome: {
    backgroundColor: HOME_PILL_BG,
  },
  pillHomeText: {
    color: HOME_PILL_TEXT,
  },
  pillAway: {
    backgroundColor: AWAY_PILL_BG,
  },
  pillAwayText: {
    color: AWAY_PILL_TEXT,
  },
});
