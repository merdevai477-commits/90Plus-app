/**
 * Pre-kickoff Statistics tab — last-N averages + trends (Figma 1449:3130).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './MatchText';
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

const INFO_ICON = require('../../assets/match-details/info-icon.svg');

const PURPLE = '#8B5CF6';
const PURPLE_SECONDARY = '#A855F7';
const PILL_IDLE = '#1C1C1C';
const PILL_BORDER = '#2B2B2B';
const CARD_BG = '#110C2A';
const LABEL = '#BFBFBF';
const TITLE = '#D7D7D7';

type AvgKey = keyof RecentFormAveragesNumbers;

function ValuePill({
  value,
  highlight,
  side,
  wide,
}: {
  value: string;
  highlight: boolean;
  side: 'home' | 'away';
  wide?: boolean;
}) {
  return (
    <View
      style={[
        styles.pill,
        wide && styles.pillWide,
        highlight
          ? side === 'home'
            ? styles.pillHomeOn
            : styles.pillAwayOn
          : styles.pillIdle,
      ]}
    >
      <Text style={styles.pillText} numberOfLines={1}>
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
  // Figma LTR: home left, away right (matches scoreboard crest order).
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

/** Crest + progress ring under each team (Figma 1454:3652). */
function TrendRing({
  pct,
  logo,
  side,
}: {
  pct: number;
  logo?: string | null;
  side: 'home' | 'away';
}) {
  const size = 64;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const dash = (clamped / 100) * c;
  // Home arc = secondary purple; away = primary (matches Figma).
  const ringColor = side === 'home' ? PURPLE_SECONDARY : PURPLE;

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#1A1421"
          strokeWidth={stroke}
          fill="#1A1421"
          fillOpacity={0.35}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ringColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${Math.max(0.01, c - dash)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.ringLogo} contentFit="contain" />
      ) : (
        <View style={styles.ringLogoPlaceholder} />
      )}
    </View>
  );
}

function TrendCrestRow({
  label,
  homeValue,
  awayValue,
  homePct,
  awayPct,
  homeLogo,
  awayLogo,
}: {
  label: string;
  homeValue: string;
  awayValue: string;
  homePct: number;
  awayPct: number;
  homeLogo?: string | null;
  awayLogo?: string | null;
}) {
  const highlight = pickHighlightSide(homePct, awayPct, 'higher');
  return (
    <View style={styles.trendRow}>
      {/* Home (left): pill then crest ring */}
      <View style={styles.trendSide}>
        <ValuePill value={homeValue} highlight={highlight === 'home'} side="home" wide />
        <TrendRing pct={homePct} logo={homeLogo} side="home" />
      </View>
      <Text style={styles.trendLabel} numberOfLines={2}>
        {label}
      </Text>
      {/* Away (right): crest ring then pill */}
      <View style={[styles.trendSide, styles.trendSideEnd]}>
        <TrendRing pct={awayPct} logo={awayLogo} side="away" />
        <ValuePill value={awayValue} highlight={highlight === 'away'} side="away" wide />
      </View>
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
  columnLabel: _columnLabel,
  homeName: _homeName,
  awayName: _awayName,
  homeLogo,
  awayLogo,
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
  homeLogo?: string | null;
  awayLogo?: string | null;
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
  void lastN;
  void _columnLabel;
  void _homeName;
  void _awayName;

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
    <View style={styles.root}>
      {/* Figma banner: text then info icon on the trailing edge (SwiftUI HStack). */}
      <View style={styles.banner}>
        <View style={styles.bannerTextCol}>
          <Text style={styles.bannerTitle}>{bannerTitle}</Text>
          <Text style={styles.bannerHint}>{bannerHint}</Text>
        </View>
        <Image source={INFO_ICON} style={styles.infoIcon} contentFit="contain" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.card}>
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
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{labels.trendsTitle}</Text>
        {/* Figma 1454:3652 — crest + ring under each team for “won the match” */}
        <View style={styles.trendsCard}>
          <TrendCrestRow
            label={labels.won}
            homeValue={formatTrendValue(homeWins)}
            awayValue={formatTrendValue(awayWins)}
            homePct={homeWins.pct}
            awayPct={awayWins.pct}
            homeLogo={homeLogo}
            awayLogo={awayLogo}
          />
        </View>
        <View style={styles.card}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 24,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    // SwiftUI: top/bottom 25, leading 28–59, trailing 28 — solid primary purple
    paddingTop: 25,
    paddingBottom: 25,
    paddingLeft: 28,
    paddingRight: 28,
    borderRadius: 16,
    backgroundColor: PURPLE,
    width: '100%',
  },
  infoIcon: {
    width: 24,
    height: 24,
    marginTop: 2,
  },
  bannerTextCol: {
    flex: 1,
    gap: 4,
    alignItems: 'flex-end',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },
  bannerHint: {
    color: 'rgba(204,204,204,1)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },
  section: {
    gap: 16,
    width: '100%',
  },
  sectionTitle: {
    color: TITLE,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 24,
    gap: 23,
    width: '100%',
  },
  trendsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 17,
    gap: 20,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  rowLabel: {
    flex: 1,
    color: LABEL,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  trendLabel: {
    flexShrink: 1,
    maxWidth: 110,
    color: LABEL,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  pill: {
    minWidth: 50,
    height: 23,
    paddingHorizontal: 16,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#222223',
  },
  pillWide: {
    minWidth: 67,
    paddingHorizontal: 12,
  },
  pillIdle: {
    backgroundColor: PILL_IDLE,
  },
  pillHomeOn: {
    backgroundColor: PURPLE_SECONDARY,
  },
  pillAwayOn: {
    backgroundColor: PURPLE,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  trendSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  trendSideEnd: {
    justifyContent: 'flex-end',
  },
  ringWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLogo: {
    width: 36,
    height: 36,
  },
  ringLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
