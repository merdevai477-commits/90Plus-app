/**
 * Pre-kickoff Statistics tab — Figma 2495:4894 / 2495:5104 / 2495:5030 / 2495:5089.
 */
import React from 'react';
import { View, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './MatchText';
import {
  formatPenaltyPair,
  formatStatAverage,
  pickHighlightSide,
  type RecentFormAveragesPayload,
  type RecentFormAveragesNumbers,
  type RecentTeamAverages,
  type RecentTrend,
} from '../../utils/recentTeamFormStats';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

const ICON_CHART = require('../../assets/images/pre-match-stats/icon-chart.svg');
const ICON_INFO = require('../../assets/images/pre-match-stats/icon-info.svg');
const ICON_TARGET_SM = require('../../assets/images/pre-match-stats/icon-target-sm.svg');
const ICON_SOCCER_SM = require('../../assets/images/pre-match-stats/icon-soccer-sm.svg');
const ICON_TROPHY_SM = require('../../assets/images/pre-match-stats/icon-trophy-sm.svg');
const ICON_CLEAN = require('../../assets/images/pre-match-stats/icon-clean-sheet.svg');

const INK = '#24104e';
const PRIMARY = '#6A2BD9';
const PRIMARY_DARK = '#4B1FA3';
const SUBTLE = '#9CA3AF';
const ROW_BORDER = '#F2F2F2';
const CARD_BG = '#FCFBFE';
const VALUE_SHADOW = {
  shadowColor: '#4B1FA3',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 2,
} as const;
const CARD_SHADOW = {
  shadowColor: '#484848',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
  elevation: 2,
} as const;

function formatPct(trend: RecentTrend | null | undefined): string {
  if (!trend || !Number.isFinite(trend.pct)) return '—';
  return `${Math.round(trend.pct)}%`;
}

function fillN(template: string, n: number): string {
  return template.replace(/\{n\}/g, String(n));
}

function pickPenaltyHighlight(
  homeScored: number | null | undefined,
  homeWon: number | null | undefined,
  awayScored: number | null | undefined,
  awayWon: number | null | undefined,
): 'home' | 'away' | null {
  if (
    homeScored == null &&
    homeWon == null &&
    awayScored == null &&
    awayWon == null
  ) {
    return null;
  }
  const hs = homeScored ?? 0;
  const as = awayScored ?? 0;
  if (hs !== as) return hs > as ? 'home' : 'away';
  const hw = homeWon ?? 0;
  const aw = awayWon ?? 0;
  if (hw === aw) return null;
  return hw > aw ? 'home' : 'away';
}

function SectionHeader({
  title,
  icon,
  color,
}: {
  title: string;
  icon?: ImageSourcePropType;
  color: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color }]} numberOfLines={1}>
        {title}
      </Text>
      {icon ? <Image source={icon} style={styles.sectionIcon} contentFit="contain" /> : null}
    </View>
  );
}

function StatPill({
  value,
  highlighted,
  ink,
}: {
  value: string;
  highlighted: boolean;
  ink: string;
}) {
  return (
    <View
      style={[
        styles.statPill,
        highlighted ? styles.statPillHighlighted : null,
      ]}
    >
      <Text
        style={[
          styles.statPillText,
          { color: highlighted ? '#FFFFFF' : ink },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function CompareRow({
  label,
  leftValue,
  rightValue,
  highlight,
  ink,
  borderColor,
  showBorder,
}: {
  label: string;
  leftValue: string;
  rightValue: string;
  /** Which side of the row (visual left = away, visual right = home). */
  highlight: 'left' | 'right' | null;
  ink: string;
  borderColor: string;
  showBorder: boolean;
}) {
  return (
    <View
      style={[
        styles.compareRow,
        showBorder ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor } : null,
      ]}
    >
      <StatPill value={leftValue} highlighted={highlight === 'left'} ink={ink} />
      <Text style={[styles.compareLabel, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
      <StatPill value={rightValue} highlighted={highlight === 'right'} ink={ink} />
    </View>
  );
}

function IndicatorLabel({
  title,
  icon,
  color,
}: {
  title: string;
  icon: ImageSourcePropType;
  color: string;
}) {
  return (
    <View style={styles.indicatorLabel}>
      <Text style={[styles.indicatorLabelText, { color }]} numberOfLines={1}>
        {title}
      </Text>
      <Image source={icon} style={styles.indicatorIcon} contentFit="contain" />
    </View>
  );
}

function DualPercentBar({
  leftPct,
  rightPct,
  leftLogo,
  rightLogo,
  showLogos,
  isDark,
  ink,
}: {
  leftPct: string;
  rightPct: string;
  leftLogo?: string | null;
  rightLogo?: string | null;
  showLogos?: boolean;
  isDark: boolean;
  ink: string;
}) {
  const leftBg = isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  return (
    <View style={styles.percentRow}>
      <View style={[styles.percentLeft, VALUE_SHADOW, { backgroundColor: leftBg }]}>
        {showLogos && leftLogo ? (
          <Image source={{ uri: leftLogo }} style={styles.percentLogo} contentFit="contain" />
        ) : null}
        <Text style={[styles.percentText, { color: ink }]}>{leftPct}</Text>
      </View>
      <LinearGradient
        colors={[PRIMARY, PRIMARY_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.percentRight, VALUE_SHADOW]}
      >
        <Text style={[styles.percentText, { color: '#FFFFFF' }]}>{rightPct}</Text>
        {showLogos && rightLogo ? (
          <Image source={{ uri: rightLogo }} style={styles.percentLogo} contentFit="contain" />
        ) : null}
      </LinearGradient>
    </View>
  );
}

type AvgRow = {
  key: string;
  label: string;
  left: string;
  right: string;
  highlight: 'left' | 'right' | null;
};

function toSideHighlight(
  side: 'home' | 'away' | null,
): 'left' | 'right' | null {
  if (side === 'away') return 'left';
  if (side === 'home') return 'right';
  return null;
}

export function PreMatchRecentStats({
  lastN,
  bannerTitle: _bannerTitle,
  bannerHint,
  title,
  columnLabel,
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
    teamIndicators: string;
    scoring: string;
    indicatorGoals: string;
  };
}) {
  void _bannerTitle;
  void _homeName;
  void _awayName;

  const { colors, isDark } = useMatchDetailsTheme();
  const ink = isDark ? colors.textPrimary : INK;
  const boxBg = isDark ? colors.elevatedBg : CARD_BG;
  const bannerBg = isDark ? colors.primaryMuted : '#EFE7FD';
  const bannerText = isDark ? colors.primarySoft : PRIMARY_DARK;
  const labelAccent = isDark ? colors.primarySoft : PRIMARY;
  const rowBorder = isDark ? colors.divider : ROW_BORDER;
  const subtle = isDark ? colors.textMuted : SUBTLE;

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

  const homeGames =
    enrichment?.home.games || homeScore.played || lastN;
  const awayGames =
    enrichment?.away.games || awayScore.played || lastN;

  const homeBtts = enrichment?.home.trends.btts ?? homeScore.btts;
  const awayBtts = enrichment?.away.trends.btts ?? awayScore.btts;
  const homeOver = enrichment?.home.trends.over25 ?? homeScore.over25;
  const awayOver = enrichment?.away.trends.over25 ?? awayScore.over25;
  const homeDc = enrichment?.home.trends.winOrDraw ?? homeScore.winOrDraw;
  const awayDc = enrichment?.away.trends.winOrDraw ?? awayScore.winOrDraw;
  const homeCs = enrichment?.home.trends.cleanSheets ?? homeScore.cleanSheets;
  const awayCs = enrichment?.away.trends.cleanSheets ?? awayScore.cleanSheets;

  const avgRows: AvgRow[] = [];
  const pushRow = (
    key: string,
    label: string,
    homeVal: number | null,
    awayVal: number | null,
    mode: 'higher' | 'lower',
    force = false,
  ) => {
    if (!force && homeVal == null && awayVal == null) return;
    avgRows.push({
      key,
      label,
      left: formatStatAverage(awayVal),
      right: formatStatAverage(homeVal),
      highlight: toSideHighlight(pickHighlightSide(homeVal, awayVal, mode)),
    });
  };

  pushRow('gf', labels.goalsScored, homeAvg.goalsFor, awayAvg.goalsFor, 'higher', true);
  pushRow('ga', labels.goalsConceded, homeAvg.goalsAgainst, awayAvg.goalsAgainst, 'lower', true);
  pushRow('xg', labels.expectedGoals, homeAvg.xg, awayAvg.xg, 'higher');
  pushRow('xga', labels.expectedGoalsAgainst, homeAvg.xga, awayAvg.xga, 'lower');
  pushRow('shots', labels.shots, homeAvg.shots, awayAvg.shots, 'higher');
  pushRow('sot', labels.shotsOnTarget, homeAvg.shotsOnTarget, awayAvg.shotsOnTarget, 'higher');
  pushRow('corners', labels.corners, homeAvg.corners, awayAvg.corners, 'higher');
  pushRow('cards', labels.cards, homeAvg.cards, awayAvg.cards, 'lower');

  const homePen = formatPenaltyPair(homeAvg.penaltiesScored, homeAvg.penaltiesWon);
  const awayPen = formatPenaltyPair(awayAvg.penaltiesScored, awayAvg.penaltiesWon);
  if (homePen != null || awayPen != null) {
    avgRows.push({
      key: 'pen',
      label: labels.penalties,
      left: awayPen ?? '0/0',
      right: homePen ?? '0/0',
      highlight: toSideHighlight(
        pickPenaltyHighlight(
          homeAvg.penaltiesScored,
          homeAvg.penaltiesWon,
          awayAvg.penaltiesScored,
          awayAvg.penaltiesWon,
        ),
      ),
    });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.banner, { backgroundColor: bannerBg }]}>
        <Text style={[styles.bannerText, { color: bannerText }]}>{bannerHint}</Text>
        <Image source={ICON_INFO} style={styles.infoIcon} contentFit="contain" />
      </View>

      <View style={styles.block}>
        <SectionHeader title={title} color={ink} />
        <View style={[styles.avgCard, CARD_SHADOW, { backgroundColor: boxBg }]}>
          <View style={[styles.avgHeader, { borderBottomColor: rowBorder }]}>
            <Text style={[styles.avgHeaderText, { color: subtle }]} numberOfLines={1}>
              {fillN(columnLabel, awayGames)}
            </Text>
            <Text style={[styles.avgHeaderText, { color: subtle }]} numberOfLines={1}>
              {fillN(columnLabel, homeGames)}
            </Text>
          </View>
          <View style={styles.avgRows}>
            {avgRows.map((row, index) => (
              <CompareRow
                key={row.key}
                label={row.label}
                leftValue={row.left}
                rightValue={row.right}
                highlight={row.highlight}
                ink={ink}
                borderColor={rowBorder}
                showBorder={index < avgRows.length - 1}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.block}>
        <SectionHeader title={labels.teamIndicators} icon={ICON_CHART} color={ink} />
        <View style={[styles.indicatorsCard, VALUE_SHADOW, { backgroundColor: boxBg }]}>
          <View style={styles.indicatorBlock}>
            <IndicatorLabel title={labels.scoring} icon={ICON_TARGET_SM} color={labelAccent} />
            <DualPercentBar
              leftPct={formatPct(awayBtts)}
              rightPct={formatPct(homeBtts)}
              leftLogo={awayLogo}
              rightLogo={homeLogo}
              showLogos
              isDark={isDark}
              ink={ink}
            />
          </View>
          <View style={styles.indicatorBlock}>
            <IndicatorLabel title={labels.indicatorGoals} icon={ICON_SOCCER_SM} color={labelAccent} />
            <DualPercentBar
              leftPct={formatPct(awayOver)}
              rightPct={formatPct(homeOver)}
              isDark={isDark}
              ink={ink}
            />
          </View>
          <View style={styles.indicatorBlock}>
            <IndicatorLabel title={labels.winOrDraw} icon={ICON_TROPHY_SM} color={labelAccent} />
            <DualPercentBar
              leftPct={formatPct(awayDc)}
              rightPct={formatPct(homeDc)}
              isDark={isDark}
              ink={ink}
            />
          </View>
          <View style={styles.indicatorBlock}>
            <IndicatorLabel title={labels.cleanSheets} icon={ICON_CLEAN} color={labelAccent} />
            <DualPercentBar
              leftPct={formatPct(awayCs)}
              rightPct={formatPct(homeCs)}
              isDark={isDark}
              ink={ink}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 22,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 17,
    paddingVertical: 11,
    borderRadius: 12,
    width: '100%',
    direction: 'ltr',
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  infoIcon: {
    width: 21,
    height: 21,
  },
  block: {
    width: '100%',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    width: '100%',
    direction: 'ltr',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionIcon: {
    width: 24,
    height: 24,
  },
  avgCard: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 16,
    alignItems: 'center',
  },
  avgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: 29,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    direction: 'ltr',
  },
  avgHeaderText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  avgRows: {
    width: '100%',
    gap: 4,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: 40,
    paddingHorizontal: 16,
    direction: 'ltr',
  },
  compareLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  statPill: {
    minWidth: 50,
    height: 23,
    paddingHorizontal: 20,
    paddingVertical: 2,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statPillHighlighted: {
    backgroundColor: PRIMARY,
  },
  statPillText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  indicatorsCard: {
    width: '100%',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 8,
  },
  indicatorBlock: {
    width: '100%',
    gap: 8,
  },
  indicatorLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    width: '100%',
    direction: 'ltr',
  },
  indicatorLabelText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  indicatorIcon: {
    width: 16,
    height: 16,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    width: '100%',
    direction: 'ltr',
  },
  percentLeft: {
    flex: 1,
    height: 40,
    marginRight: -38,
    zIndex: 1,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingRight: 23,
    paddingLeft: 12,
  },
  percentRight: {
    flex: 1,
    height: 40,
    borderTopLeftRadius: 500,
    borderBottomLeftRadius: 500,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 23,
    zIndex: 2,
  },
  percentText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  percentLogo: {
    width: 22,
    height: 22,
  },
});
