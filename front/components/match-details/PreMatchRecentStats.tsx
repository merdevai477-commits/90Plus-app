/**
 * Pre-kickoff Statistics tab: last-N averages + trends on a 90Plus
 * liquid-glass surface (purple / electric blue / gold).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassWrapper, glassProps } from '../../constants/ui';
import { isLiquidGlassSupported } from '../../utils/liquidGlassSafe';
import {
  BLUE_ELECTRIC,
  GLASS_BORDER_BOTTOM,
  GLASS_BORDER_SIDE,
  GLASS_BORDER_TOP,
  GOLD_PRIMARY,
  PURPLE_GLOW,
  PURPLE_SOFT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../constants/tokens';
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
        highlight
          ? side === 'home'
            ? styles.pillHome
            : styles.pillAway
          : styles.pillIdle,
      ]}
    >
      {highlight ? (
        <LinearGradient
          colors={
            side === 'home'
              ? ['rgba(167,139,250,0.55)', 'rgba(124,58,237,0.22)']
              : ['rgba(96,165,250,0.50)', 'rgba(59,130,246,0.20)']
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Text
        style={[styles.valueText, highlight && styles.valueTextOn]}
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

  const lastLabel = columnLabel.replace('{n}', String(lastN));

  const avgRow = (
    key: AvgKey,
    rowLabel: string,
    mode: 'higher' | 'lower',
  ) => (
    <CompareRow
      key={key}
      label={rowLabel}
      homeValue={formatStatAverage(homeAvg[key])}
      awayValue={formatStatAverage(awayAvg[key])}
      homeNum={numOrNull(homeAvg[key])}
      awayNum={numOrNull(awayAvg[key])}
      mode={mode}
    />
  );

  return (
    <View style={styles.cardOuter}>
      <GlassWrapper {...(glassProps.card as object)} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(124,58,237,0.16)', 'rgba(59,130,246,0.08)', 'rgba(10,6,18,0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.banner}>
        <LinearGradient
          colors={['rgba(124,58,237,0.38)', 'rgba(59,130,246,0.22)', 'rgba(91,33,182,0.16)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.goldHairline} />
        <Text style={styles.bannerTitle}>{bannerTitle}</Text>
        <Text style={styles.bannerHint}>{bannerHint}</Text>
      </View>

      <View style={styles.body}>
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
          <Text style={styles.columnLabel}>{lastLabel}</Text>
          <Text style={styles.columnLabel}>{lastLabel}</Text>
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

        <View style={styles.trendsHead}>
          <LinearGradient
            colors={['transparent', PURPLE_SOFT, BLUE_ELECTRIC, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.trendsRule}
          />
          <Text style={styles.trendsTitle}>{labels.trendsTitle}</Text>
          <LinearGradient
            colors={['transparent', BLUE_ELECTRIC, PURPLE_SOFT, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.trendsRule}
          />
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderTopColor: GLASS_BORDER_TOP,
    borderLeftColor: GLASS_BORDER_SIDE,
    borderRightColor: GLASS_BORDER_SIDE,
    borderBottomColor: GLASS_BORDER_BOTTOM,
    backgroundColor: isLiquidGlassSupported ? 'transparent' : 'rgba(12,8,22,0.72)',
    shadowColor: PURPLE_GLOW,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  banner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  goldHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: GOLD_PRIMARY,
    opacity: 0.9,
  },
  bannerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  bannerHint: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
  },
  body: {
    paddingBottom: 8,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
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
    fontSize: 13,
    fontWeight: '700',
  },
  teamNameHome: {
    color: PURPLE_SOFT,
    textAlign: 'left',
  },
  teamNameAway: {
    color: BLUE_ELECTRIC,
    textAlign: 'right',
  },
  columnHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  columnLabel: {
    color: GOLD_PRIMARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    opacity: 0.85,
  },
  trendsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  trendsRule: {
    flex: 1,
    height: 1,
  },
  trendsTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  rowLabel: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  valueSlot: {
    minWidth: 68,
    maxWidth: 96,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  pillIdle: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pillHome: {
    backgroundColor: 'rgba(124,58,237,0.22)',
    borderColor: 'rgba(167,139,250,0.55)',
  },
  pillAway: {
    backgroundColor: 'rgba(59,130,246,0.20)',
    borderColor: 'rgba(96,165,250,0.50)',
  },
  valueText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '700',
    zIndex: 1,
  },
  valueTextOn: {
    color: TEXT_PRIMARY,
  },
});
