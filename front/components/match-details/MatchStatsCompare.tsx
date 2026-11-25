/**
 * Match statistics tab — Figma node 1767:13422 (90plus).
 * Layout: possession → simple comparison list → xG card.
 * Section icons live in assets/images/match-stats/.
 */
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './MatchText';
import type { TeamStatistics } from '../../services/apiFootball';
import { getLocalizedStatType } from '../../utils/i18nHelpers';
import { useTranslation } from '../../src/i18n';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

const ICON = {
  possessionChart: require('../../assets/images/match-stats/icon-possession-chart.svg'),
  soccerBall: require('../../assets/images/match-stats/icon-soccer-ball.svg'),
  xg: require('../../assets/images/match-stats/icon-xg.svg'),
  idea: require('../../assets/images/match-stats/icon-idea.svg'),
} as const;

const DESIGN_WIDTH = 405;

const C_DARK = {
  card: '#0B0518',
  cardBorder: '#281359',
  muted: '#B0B0B0',
  insight: '#78679F',
  text: '#FFFFFF',
  textSoft: '#DFD1FD',
  leftValue: '#C4B5FD',
  rightValue: '#A78BFA',
  label: '#FFFFFF',
  ringHome: '#C4B5FD',
  ringAway: '#A78BFA',
  ringTrack: '#2A1B4A',
} as const;

const C_LIGHT = {
  card: '#FFFFFF',
  cardBorder: 'rgba(106,43,217,0.2)',
  muted: '#6B7280',
  insight: '#6B5B95',
  text: '#1A102B',
  textSoft: '#6A2BD9',
  /** Figma left value */
  leftValue: '#8856E1',
  /** Figma right value */
  rightValue: '#4B1FA3',
  label: '#24104E',
  ringHome: '#4B1FA3',
  ringAway: '#8856E1',
  ringTrack: '#F3EDFF',
} as const;

type StatsC = typeof C_LIGHT;

function useStatsC(): StatsC {
  const { isDark } = useMatchDetailsTheme();
  return isDark ? C_DARK : C_LIGHT;
}

type Pair = { home: number | null; away: number | null };

const STAT_KEYS = {
  possession: ['ballpossession', 'possession', 'possessionpercentage'],
  xg: ['expectedgoals', 'xg', 'expectedgoalsxg'],
  totalShots: ['totalshots', 'shotstotal'],
  shotsOn: ['shotsongoal', 'shotsontarget'],
  shotsOff: ['shotsoffgoal', 'shotsofftarget'],
  blocked: ['blockedshots', 'shotsblocked'],
  totalPasses: ['totalpasses', 'passes'],
  passesAccurate: ['passesaccurate', 'accuratepasses'],
  passAccuracy: ['passes%', 'passespercentage', 'passaccuracy'],
  attacks: ['attacks'],
  dangerous: ['dangerousattacks'],
  corners: ['cornerkicks', 'corners'],
  fouls: ['fouls'],
  offsides: ['offsides'],
  yellow: ['yellowcards'],
  red: ['redcards'],
} as const;

function parseStatNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** `null` when the provider didn't send the row at all; a null value means 0. */
function findStat(team: TeamStatistics | undefined, keys: readonly string[]): number | null {
  for (const row of team?.statistics ?? []) {
    const k = (row.type ?? '').toLowerCase().replace(/[^a-z0-9%]/g, '');
    if (keys.includes(k)) return parseStatNum(row.value);
  }
  return null;
}

const has = (p: Pair) => p.home != null || p.away != null;
const n = (v: number | null) => v ?? 0;
const fmt = (v: number | null, decimals = 0) =>
  decimals > 0 ? n(v).toFixed(decimals) : String(Math.round(n(v)));

function leader(p: Pair): 'home' | 'away' | null {
  if (!has(p) || n(p.home) === n(p.away)) return null;
  return n(p.home) > n(p.away) ? 'home' : 'away';
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

function SoftCard({
  children,
  s,
  radius = 16,
}: {
  children: React.ReactNode;
  s: number;
  radius?: number;
}) {
  const C = useStatsC();
  const { isDark } = useMatchDetailsTheme();
  return (
    <View
      style={[
        styles.softCard,
        { borderRadius: radius },
        isDark
          ? { backgroundColor: C.card, borderColor: C.cardBorder, borderWidth: 1 }
          : styles.softShadow,
      ]}
    >
      {!isDark ? (
        <LinearGradient
          colors={['#FFFFFF', '#FDFBFF']}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={{ paddingHorizontal: 11 * s, paddingVertical: 17 * s, gap: 13 * s }}>{children}</View>
    </View>
  );
}

function SectionTitle({
  title,
  suffix,
  icon,
  rtl,
  s,
}: {
  title: string;
  suffix?: string;
  icon: number;
  rtl: boolean;
  s: number;
}) {
  const C = useStatsC();
  const { isDark } = useMatchDetailsTheme();
  const titleColor = isDark ? C.text : '#24104E';
  const suffixColor = isDark ? C.textSoft : '#6A2BD9';
  return (
    <View
      style={[
        styles.sectionTitleRow,
        {
          flexDirection: rtl ? 'row' : 'row-reverse',
          alignSelf: rtl ? 'flex-end' : 'flex-start',
          gap: 8 * s,
        },
      ]}
    >
      <Text style={[styles.sectionTitle, { fontSize: 16 * s, color: titleColor }]}>
        {title}
        {suffix ? <Text style={[styles.sectionTitleSuffix, { color: suffixColor }]}>{suffix}</Text> : null}
      </Text>
      <Image
        source={icon}
        style={{ width: 21 * s, height: 21 * s }}
        contentFit="contain"
        tintColor={isDark ? '#C4B5FD' : undefined}
      />
    </View>
  );
}

/** One shared ring — Figma 1767:13395. Home is always on the right. */
function PossessionCard({
  pair,
  title,
  homeName,
  awayName,
  rtl,
  s,
}: {
  pair: Pair;
  title: string;
  homeName: string;
  awayName: string;
  rtl: boolean;
  s: number;
}) {
  const C = useStatsC();
  const { isDark } = useMatchDetailsTheme();
  const size = 88 * s;
  const stroke = 10.83 * s;
  const r = (size - stroke) / 2;
  const center = size / 2;
  const circ = 2 * Math.PI * r;
  const homePct = Math.max(0, n(pair.home));
  const awayPct = Math.max(0, n(pair.away));
  const total = homePct + awayPct;
  const homeShare = total > 0 ? homePct / total : 0;
  const awayShare = total > 0 ? awayPct / total : 0;
  const gap = (8 / 360) * circ;
  const homeLen = Math.max(0, circ * homeShare - gap);
  const awayLen = Math.max(0, circ * awayShare - gap);

  const side = (value: number, name: string, color: string) => (
    <View style={[styles.possessionSide, { gap: 10 * s }]}>
      <Text style={[styles.possessionPct, { color, fontSize: 24 * s, lineHeight: 28 * s }]} numberOfLines={1}>
        {`${Math.round(value)}%`}
      </Text>
      <Text
        style={[styles.possessionName, { color: C.rightValue, fontSize: 16 * s, lineHeight: 20 * s }]}
        numberOfLines={2}
      >
        {name}
      </Text>
    </View>
  );

  return (
    <SoftCard s={s}>
      <SectionTitle title={title} icon={ICON.possessionChart} rtl={rtl} s={s} />
      <View style={[styles.possessionRow, { paddingHorizontal: 12 * s }]}>
        {side(awayPct, awayName, C.leftValue)}
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Circle cx={center} cy={center} r={r} stroke={C.ringTrack} strokeWidth={stroke} fill="transparent" />
            {homeLen > 0 ? (
              <Circle
                cx={center}
                cy={center}
                r={r}
                stroke={C.ringHome}
                strokeWidth={stroke}
                fill="transparent"
                strokeDasharray={`${homeLen} ${circ}`}
                strokeDashoffset={gap / 2}
                transform={`rotate(-90 ${center} ${center})`}
              />
            ) : null}
            {awayLen > 0 ? (
              <Circle
                cx={center}
                cy={center}
                r={r}
                stroke={C.ringAway}
                strokeWidth={stroke}
                fill="transparent"
                strokeDasharray={`${awayLen} ${circ}`}
                strokeDashoffset={awayLen + gap / 2}
                transform={`rotate(-90 ${center} ${center})`}
              />
            ) : null}
          </Svg>
          <Image
            source={ICON.soccerBall}
            style={{ width: 24 * s, height: 24 * s }}
            contentFit="contain"
            tintColor={isDark ? '#F4EEFF' : undefined}
          />
        </View>
        {side(homePct, homeName, C.rightValue)}
      </View>
    </SoftCard>
  );
}

/** Figma 1770:13493 — simple away | label | home rows. */
function StatsListCard({
  rows,
  s,
}: {
  rows: Array<{ key: string; label: string; pair: Pair; decimals?: number; suffix?: string }>;
  s: number;
}) {
  const C = useStatsC();
  const { isDark } = useMatchDetailsTheme();
  if (rows.length === 0) return null;

  const show = (pair: Pair, side: 'home' | 'away', decimals?: number, suffix?: string) =>
    `${fmt(pair[side], decimals ?? 0)}${suffix ?? ''}`;

  return (
    <View
      style={[
        styles.listCard,
        isDark
          ? { backgroundColor: C.card, borderColor: C.cardBorder, borderWidth: 1 }
          : styles.softShadow,
      ]}
    >
      {!isDark ? (
        <LinearGradient
          colors={['#FFFFFF', '#FDFBFF']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={{ paddingVertical: 4 * s }}>
        {rows.map((row, idx) => {
          const last = idx === rows.length - 1;
          const valueWidth = (row.suffix ? 44 : 36) * s;
          return (
            <View
              key={row.key}
              style={[
                styles.listRow,
                {
                  height: 48 * s,
                  paddingHorizontal: 8 * s,
                  borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.95)',
                },
              ]}
            >
              <Text
                style={[styles.listValue, { color: C.leftValue, fontSize: 18 * s, width: valueWidth }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {show(row.pair, 'away', row.decimals, row.suffix)}
              </Text>
              <Text
                style={[styles.listLabel, { color: C.label, fontSize: 15 * s }]}
                numberOfLines={1}
              >
                {row.label}
              </Text>
              <Text
                style={[styles.listValue, { color: C.rightValue, fontSize: 18 * s, width: valueWidth }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {show(row.pair, 'home', row.decimals, row.suffix)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** xG card under the list — same soft shell as possession. */
function XgCard({
  pair,
  title,
  homeName,
  awayName,
  rtl,
  s,
}: {
  pair: Pair;
  title: string;
  homeName: string;
  awayName: string;
  rtl: boolean;
  s: number;
}) {
  const C = useStatsC();
  const { isDark } = useMatchDetailsTheme();
  const dividerColors = isDark
    ? (['rgba(196,181,253,0)', 'rgba(196,181,253,0.45)', 'rgba(196,181,253,0)'] as const)
    : (['rgba(75,31,163,0)', 'rgba(75,31,163,0.28)', 'rgba(75,31,163,0)'] as const);

  const col = (value: number | null, name: string, color: string) => (
    <View style={[styles.xgCol, { gap: 10 * s }]}>
      <Text
        style={[styles.xgValue, { color, fontSize: 28 * s, lineHeight: 34 * s }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {fmt(value, 2)}
      </Text>
      <Text style={[styles.xgName, { color: C.rightValue, fontSize: 15 * s, lineHeight: 20 * s }]} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );

  return (
    <SoftCard s={s}>
      <SectionTitle title={title} suffix=" (xG)" icon={ICON.xg} rtl={rtl} s={s} />
      <View style={[styles.xgRow, { paddingHorizontal: 8 * s, minHeight: 72 * s }]}>
        {col(pair.away, awayName, C.leftValue)}
        <LinearGradient
          colors={[...dividerColors]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ width: 1, alignSelf: 'stretch', marginHorizontal: 8 * s }}
        />
        {col(pair.home, homeName, C.rightValue)}
      </View>
    </SoftCard>
  );
}

export interface MatchStatsCompareProps {
  statistics: TeamStatistics[];
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
}

export function MatchStatsCompare({
  statistics,
  homeName,
  awayName,
}: MatchStatsCompareProps) {
  const C = useStatsC();
  const { t, language } = useTranslation();
  const md = t.matchDetails;
  const rtl = language === 'ar';
  const [width, setWidth] = useState(DESIGN_WIDTH);
  const s = Math.max(0.75, Math.min(1.1, width / DESIGN_WIDTH));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  const home = statistics[0];
  const away = statistics[1];

  const p = useMemo(() => {
    const get = (keys: readonly string[]): Pair => ({
      home: findStat(home, keys),
      away: findStat(away, keys),
    });
    const shotsOn = get(STAT_KEYS.shotsOn);
    const shotsOff = get(STAT_KEYS.shotsOff);
    const blocked = get(STAT_KEYS.blocked);
    let totalShots = get(STAT_KEYS.totalShots);
    if (!has(totalShots) && (has(shotsOn) || has(shotsOff) || has(blocked))) {
      totalShots = {
        home: n(shotsOn.home) + n(shotsOff.home) + n(blocked.home),
        away: n(shotsOn.away) + n(shotsOff.away) + n(blocked.away),
      };
    }
    const totalPasses = get(STAT_KEYS.totalPasses);
    const passesAccurate = get(STAT_KEYS.passesAccurate);
    let passAccuracy = get(STAT_KEYS.passAccuracy);
    if (!has(passAccuracy) && has(passesAccurate) && has(totalPasses)) {
      const ratio = (a: number | null, tot: number | null) =>
        a != null && tot ? Math.round((a / tot) * 100) : null;
      passAccuracy = {
        home: ratio(passesAccurate.home, totalPasses.home),
        away: ratio(passesAccurate.away, totalPasses.away),
      };
    }
    return {
      possession: get(STAT_KEYS.possession),
      xg: get(STAT_KEYS.xg),
      totalShots,
      shotsOn,
      shotsOff,
      blocked,
      totalPasses,
      passesAccurate,
      passAccuracy,
      attacks: get(STAT_KEYS.attacks),
      dangerous: get(STAT_KEYS.dangerous),
      corners: get(STAT_KEYS.corners),
      fouls: get(STAT_KEYS.fouls),
      offsides: get(STAT_KEYS.offsides),
      yellow: get(STAT_KEYS.yellow),
      red: get(STAT_KEYS.red),
    };
  }, [home, away]);

  const listRows = useMemo(() => {
    const L = (type: string) => getLocalizedStatType(type, language);
    const candidates: Array<{ key: string; label: string; pair: Pair; decimals?: number; suffix?: string }> = [
      { key: 'shotsOn', label: L('Shots on Goal'), pair: p.shotsOn },
      { key: 'shotsOff', label: L('Shots off Goal'), pair: p.shotsOff },
      { key: 'blocked', label: L('Blocked Shots'), pair: p.blocked },
      { key: 'totalShots', label: L('Total Shots'), pair: p.totalShots },
      { key: 'corners', label: L('Corner Kicks'), pair: p.corners },
      { key: 'fouls', label: L('Fouls'), pair: p.fouls },
      { key: 'yellow', label: L('Yellow Cards'), pair: p.yellow },
      { key: 'red', label: L('Red Cards'), pair: p.red },
      { key: 'passes', label: L('Total Passes'), pair: p.totalPasses },
      { key: 'passesAccurate', label: L('Passes accurate'), pair: p.passesAccurate },
      { key: 'passAcc', label: L('Pass Accuracy'), pair: p.passAccuracy, suffix: '%' },
      { key: 'offsides', label: L('Offsides'), pair: p.offsides },
      { key: 'attacks', label: L('Attacks'), pair: p.attacks },
      { key: 'dangerous', label: L('Dangerous Attacks'), pair: p.dangerous },
    ];
    return candidates.filter((r) => has(r.pair));
  }, [p, language]);

  const insight = useMemo(() => {
    const teamName = (side: 'home' | 'away') => (side === 'home' ? homeName : awayName);
    const poss = leader(p.possession);
    const shots = leader(p.shotsOn);
    const xg = leader(p.xg);

    let base = '';
    let lead: 'home' | 'away' | null = null;
    if (poss && shots && poss === shots) {
      base = fill(md.statsInsightPossShots, { team: teamName(poss) });
      lead = poss;
    } else if (poss && shots) {
      base = fill(md.statsInsightSplit, { a: teamName(poss), b: teamName(shots) });
    } else if (poss) {
      base = fill(md.statsInsightPoss, { team: teamName(poss) });
      lead = poss;
    } else if (shots) {
      base = fill(md.statsInsightShots, { team: teamName(shots) });
      lead = shots;
    }

    if (!xg) return base;
    if (!base) return fill(md.statsInsightXgOnly, { team: teamName(xg) });
    if (!lead) return base + fill(md.statsInsightXgAlso, { team: teamName(xg) });
    if (xg === lead) return base + md.statsInsightXgSame;
    return base + fill(md.statsInsightXgOther, { team: teamName(xg) });
  }, [p, md, homeName, awayName]);

  return (
    <View style={[styles.root, { gap: 24 * s }]} onLayout={onLayout}>
      {has(p.possession) ? (
        <PossessionCard
          pair={p.possession}
          title={getLocalizedStatType('Ball Possession', language)}
          homeName={homeName}
          awayName={awayName}
          rtl={rtl}
          s={s}
        />
      ) : null}

      <StatsListCard rows={listRows} s={s} />

      {has(p.xg) ? (
        <XgCard
          pair={p.xg}
          title={getLocalizedStatType('Expected Goals', language).replace(/\s*\(xG\)\s*$/i, '') || md.statsXgTitle}
          homeName={homeName}
          awayName={awayName}
          rtl={rtl}
          s={s}
        />
      ) : null}

      {insight ? (
        <LinearGradient
          colors={['rgba(139,92,246,0.14)', 'rgba(62,12,176,0.14)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[
            styles.insight,
            {
              paddingHorizontal: 18 * s,
              paddingVertical: 9 * s,
              gap: 12 * s,
              flexDirection: rtl ? 'row' : 'row-reverse',
            },
          ]}
        >
          <Text
            style={[
              styles.insightText,
              { fontSize: 13 * s, textAlign: rtl ? 'right' : 'left', color: C.insight },
            ]}
          >
            {insight}
          </Text>
          <View style={styles.insightIconBox}>
            <Image source={ICON.idea} style={styles.insightIcon} contentFit="contain" />
          </View>
        </LinearGradient>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  softCard: {
    width: '100%',
    overflow: 'hidden',
  },
  softShadow: {
    shadowColor: '#4B1FA3',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitleRow: {
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '600',
  },
  sectionTitleSuffix: {
    fontWeight: '500',
  },
  possessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  possessionSide: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  possessionPct: {
    fontWeight: '700',
    textAlign: 'center',
  },
  possessionName: {
    fontWeight: '600',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  listCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  listValue: {
    fontWeight: '700',
    textAlign: 'center',
  },
  listLabel: {
    flex: 1,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  xgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  xgCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  xgValue: {
    fontWeight: '700',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  xgName: {
    fontWeight: '600',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  insight: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(78,49,143,0.39)',
  },
  insightText: {
    flex: 1,
    fontWeight: '500',
  },
  insightIconBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightIcon: {
    width: 24.4173,
    height: 25,
  },
});

export default MatchStatsCompare;
