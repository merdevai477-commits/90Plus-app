/**
 * Pre-kickoff Statistics tab — Figma 1728:12224 (same shape light + dark).
 */
import React from 'react';
import { View, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './MatchText';
import {
  formatStatAverage,
  type RecentFormAveragesPayload,
  type RecentFormAveragesNumbers,
  type RecentTeamAverages,
  type RecentTrend,
} from '../../utils/recentTeamFormStats';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

const ICON_SOCCER = require('../../assets/images/pre-match-stats/icon-soccer.svg');
const ICON_SHIELD = require('../../assets/images/pre-match-stats/icon-shield.svg');
const ICON_TARGET = require('../../assets/images/pre-match-stats/icon-target.svg');
const ICON_GOALNET = require('../../assets/images/pre-match-stats/icon-goalnet.svg');
const ICON_FLAG = require('../../assets/images/pre-match-stats/icon-flag.svg');
const ICON_CHART = require('../../assets/images/pre-match-stats/icon-chart.svg');
const ICON_INFO = require('../../assets/images/pre-match-stats/icon-info.svg');
const ICON_TARGET_SM = require('../../assets/images/pre-match-stats/icon-target-sm.svg');
const ICON_SOCCER_SM = require('../../assets/images/pre-match-stats/icon-soccer-sm.svg');
const ICON_TROPHY_SM = require('../../assets/images/pre-match-stats/icon-trophy-sm.svg');
const ICON_CLEAN = require('../../assets/images/pre-match-stats/icon-clean-sheet.svg');

const INK = '#24104e';
const PRIMARY = '#6A2BD9';
const PRIMARY_DARK = '#4B1FA3';
const YELLOW_CARD = '#FDAC0C';
const RED_CARD = '#B60606';
const HOME_GOALS_TINT = '#C2D3DA';
const AWAY_GOALS_TINT = '#F5CED3';
const VALUE_SHADOW = {
  shadowColor: '#4B1FA3',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 2,
} as const;

function formatPct(trend: RecentTrend | null | undefined): string {
  if (!trend || !Number.isFinite(trend.pct)) return '—';
  return `${Math.round(trend.pct)}%`;
}

function formatCardAvg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function SectionHeader({
  title,
  icon,
  color,
}: {
  title: string;
  icon: ImageSourcePropType;
  color: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color }]} numberOfLines={1}>
        {title}
      </Text>
      <Image source={icon} style={styles.sectionIcon} contentFit="contain" />
    </View>
  );
}

function ValueBox({
  value,
  large,
  tint,
  watermark,
  textColor,
  boxBg,
}: {
  value: string;
  large?: boolean;
  tint?: string;
  watermark?: string | null;
  textColor: string;
  boxBg: string;
}) {
  return (
    <View
      style={[
        large ? styles.goalsBox : styles.valueBox,
        VALUE_SHADOW,
        { backgroundColor: tint ?? boxBg },
      ]}
    >
      {watermark ? (
        <Image
          source={{ uri: watermark }}
          style={large ? styles.goalsWatermark : styles.hidden}
          contentFit="contain"
        />
      ) : null}
      <Text
        style={[
          large ? styles.goalsValue : styles.valueText,
          { color: textColor },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function DualValueRow({
  homeValue,
  awayValue,
  homeTint,
  awayTint,
  homeLogo,
  awayLogo,
  large,
  textColor,
  boxBg,
}: {
  homeValue: string;
  awayValue: string;
  homeTint?: string;
  awayTint?: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  large?: boolean;
  textColor: string;
  boxBg: string;
}) {
  return (
    <View style={styles.dualRow}>
      <ValueBox
        value={homeValue}
        large={large}
        tint={homeTint}
        watermark={large ? homeLogo : null}
        textColor={textColor}
        boxBg={boxBg}
      />
      <ValueBox
        value={awayValue}
        large={large}
        tint={awayTint}
        watermark={large ? awayLogo : null}
        textColor={textColor}
        boxBg={boxBg}
      />
    </View>
  );
}

function CardChip({ color }: { color: string }) {
  return <View style={[styles.cardChip, { backgroundColor: color }]} />;
}

function TeamCardsBox({
  yellow,
  red,
  textColor,
  boxBg,
}: {
  yellow: string;
  red: string;
  textColor: string;
  boxBg: string;
}) {
  return (
    <View style={[styles.cardsBox, VALUE_SHADOW, { backgroundColor: boxBg }]}>
      <View style={styles.cardLine}>
        <Text style={[styles.cardValue, { color: textColor }]}>{yellow}</Text>
        <CardChip color={YELLOW_CARD} />
      </View>
      <View style={styles.cardLine}>
        <Text style={[styles.cardValue, { color: textColor }]}>{red}</Text>
        <CardChip color={RED_CARD} />
      </View>
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
  homePct,
  awayPct,
  homeLogo,
  awayLogo,
  showLogos,
  isDark,
  ink,
}: {
  homePct: string;
  awayPct: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  showLogos?: boolean;
  isDark: boolean;
  ink: string;
}) {
  const homeBg = isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  return (
    <View style={styles.percentRow}>
      <View style={[styles.percentHome, VALUE_SHADOW, { backgroundColor: homeBg }]}>
        {showLogos && homeLogo ? (
          <Image source={{ uri: homeLogo }} style={styles.percentLogo} contentFit="contain" />
        ) : null}
        <Text style={[styles.percentText, { color: ink }]}>{homePct}</Text>
      </View>
      <LinearGradient
        colors={[PRIMARY, PRIMARY_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.percentAway, VALUE_SHADOW]}
      >
        <Text style={[styles.percentText, { color: '#FFFFFF' }]}>{awayPct}</Text>
        {showLogos && awayLogo ? (
          <Image source={{ uri: awayLogo }} style={styles.percentLogo} contentFit="contain" />
        ) : null}
      </LinearGradient>
    </View>
  );
}

export function PreMatchRecentStats({
  lastN,
  bannerTitle: _bannerTitle,
  bannerHint,
  title: _title,
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
    teamIndicators: string;
    scoring: string;
    indicatorGoals: string;
  };
}) {
  void lastN;
  void _bannerTitle;
  void _title;
  void _columnLabel;
  void _homeName;
  void _awayName;

  const { colors, isDark } = useMatchDetailsTheme();
  const ink = isDark ? colors.textPrimary : INK;
  const boxBg = isDark ? colors.elevatedBg : '#FFFFFF';
  const bannerBg = isDark ? colors.primaryMuted : '#EFE7FD';
  const bannerText = isDark ? colors.primarySoft : PRIMARY_DARK;
  const homeGoalsTint = isDark ? 'rgba(194,211,218,0.28)' : HOME_GOALS_TINT;
  const awayGoalsTint = isDark ? 'rgba(245,206,211,0.28)' : AWAY_GOALS_TINT;
  const labelAccent = isDark ? colors.primarySoft : PRIMARY;

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

  const showShots = homeAvg.shots != null || awayAvg.shots != null;
  const showSot = homeAvg.shotsOnTarget != null || awayAvg.shotsOnTarget != null;
  const showCorners = homeAvg.corners != null || awayAvg.corners != null;
  const showCards = homeAvg.cards != null || awayAvg.cards != null;

  const homeBtts = enrichment?.home.trends.btts ?? homeScore.btts;
  const awayBtts = enrichment?.away.trends.btts ?? awayScore.btts;
  const homeOver = enrichment?.home.trends.over25 ?? homeScore.over25;
  const awayOver = enrichment?.away.trends.over25 ?? awayScore.over25;
  const homeDc = enrichment?.home.trends.winOrDraw ?? homeScore.winOrDraw;
  const awayDc = enrichment?.away.trends.winOrDraw ?? awayScore.winOrDraw;
  const homeCs = enrichment?.home.trends.cleanSheets ?? homeScore.cleanSheets;
  const awayCs = enrichment?.away.trends.cleanSheets ?? awayScore.cleanSheets;

  return (
    <View style={styles.root}>
      <View style={[styles.banner, { backgroundColor: bannerBg }]}>
        <Text style={[styles.bannerText, { color: bannerText }]}>{bannerHint}</Text>
        <Image source={ICON_INFO} style={styles.infoIcon} contentFit="contain" />
      </View>

      <View style={styles.block}>
        <SectionHeader title={labels.goalsScored} icon={ICON_SOCCER} color={ink} />
        <DualValueRow
          homeValue={formatStatAverage(homeAvg.goalsFor)}
          awayValue={formatStatAverage(awayAvg.goalsFor)}
          homeTint={homeGoalsTint}
          awayTint={awayGoalsTint}
          homeLogo={homeLogo}
          awayLogo={awayLogo}
          large
          textColor={ink}
          boxBg={boxBg}
        />
      </View>

      <View style={styles.statsStack}>
        <View style={styles.block}>
          <SectionHeader title={labels.goalsConceded} icon={ICON_SHIELD} color={ink} />
          <DualValueRow
            homeValue={formatStatAverage(homeAvg.goalsAgainst)}
            awayValue={formatStatAverage(awayAvg.goalsAgainst)}
            textColor={ink}
            boxBg={boxBg}
          />
        </View>

        {showShots ? (
          <View style={styles.block}>
            <SectionHeader title={labels.shots} icon={ICON_TARGET} color={ink} />
            <DualValueRow
              homeValue={formatStatAverage(homeAvg.shots)}
              awayValue={formatStatAverage(awayAvg.shots)}
              textColor={ink}
              boxBg={boxBg}
            />
          </View>
        ) : null}

        {showSot ? (
          <View style={styles.block}>
            <SectionHeader title={labels.shotsOnTarget} icon={ICON_GOALNET} color={ink} />
            <DualValueRow
              homeValue={formatStatAverage(homeAvg.shotsOnTarget)}
              awayValue={formatStatAverage(awayAvg.shotsOnTarget)}
              textColor={ink}
              boxBg={boxBg}
            />
          </View>
        ) : null}

        {showCorners ? (
          <View style={styles.block}>
            <SectionHeader title={labels.corners} icon={ICON_FLAG} color={ink} />
            <DualValueRow
              homeValue={formatStatAverage(homeAvg.corners)}
              awayValue={formatStatAverage(awayAvg.corners)}
              textColor={ink}
              boxBg={boxBg}
            />
          </View>
        ) : null}

        {showCards ? (
          <View style={styles.block}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: ink }]} numberOfLines={1}>
                {labels.cards}
              </Text>
              <View style={styles.cardsHeaderIcon}>
                <View style={[styles.cardChipSmall, styles.cardChipRedTilt, { backgroundColor: RED_CARD }]} />
                <View style={[styles.cardChipSmall, { backgroundColor: YELLOW_CARD }]} />
              </View>
            </View>
            <View style={styles.dualRow}>
              <TeamCardsBox
                yellow={formatCardAvg(homeAvg.cards)}
                red="—"
                textColor={ink}
                boxBg={boxBg}
              />
              <TeamCardsBox
                yellow={formatCardAvg(awayAvg.cards)}
                red="—"
                textColor={ink}
                boxBg={boxBg}
              />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.block}>
        <SectionHeader title={labels.teamIndicators} icon={ICON_CHART} color={ink} />
        <View style={[styles.indicatorsCard, VALUE_SHADOW, { backgroundColor: boxBg }]}>
          <View style={styles.indicatorBlock}>
            <IndicatorLabel title={labels.scoring} icon={ICON_TARGET_SM} color={labelAccent} />
            <DualPercentBar
              homePct={formatPct(homeBtts)}
              awayPct={formatPct(awayBtts)}
              homeLogo={homeLogo}
              awayLogo={awayLogo}
              showLogos
              isDark={isDark}
              ink={ink}
            />
          </View>
          <View style={styles.indicatorBlock}>
            <IndicatorLabel title={labels.indicatorGoals} icon={ICON_SOCCER_SM} color={labelAccent} />
            <DualPercentBar
              homePct={formatPct(homeOver)}
              awayPct={formatPct(awayOver)}
              isDark={isDark}
              ink={ink}
            />
          </View>
          <View style={styles.indicatorBlock}>
            <IndicatorLabel title={labels.winOrDraw} icon={ICON_TROPHY_SM} color={labelAccent} />
            <DualPercentBar
              homePct={formatPct(homeDc)}
              awayPct={formatPct(awayDc)}
              isDark={isDark}
              ink={ink}
            />
          </View>
          <View style={styles.indicatorBlock}>
            <IndicatorLabel title={labels.cleanSheets} icon={ICON_CLEAN} color={labelAccent} />
            <DualPercentBar
              homePct={formatPct(homeCs)}
              awayPct={formatPct(awayCs)}
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
    gap: 14,
  },
  statsStack: {
    width: '100%',
    gap: 22,
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
  dualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
    direction: 'ltr',
  },
  valueBox: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  goalsBox: {
    flex: 1,
    height: 121,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  goalsWatermark: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
    margin: 12,
  },
  hidden: {
    display: 'none',
  },
  goalsValue: {
    fontSize: 48,
    fontWeight: '700',
    textAlign: 'center',
  },
  valueText: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardsBox: {
    flex: 1,
    height: 105,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 23,
    gap: 14,
  },
  cardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
    direction: 'ltr',
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardChip: {
    width: 18,
    height: 23.4,
    borderRadius: 3,
  },
  cardsHeaderIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardChipSmall: {
    width: 15,
    height: 20,
    borderRadius: 3,
    position: 'absolute',
  },
  cardChipRedTilt: {
    transform: [{ rotate: '20deg' }],
    left: 5,
    top: 0,
  },
  indicatorsCard: {
    width: '100%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 20,
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
  percentHome: {
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
  percentAway: {
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
