/**
 * Match statistics tab — Figma node 1408:21303 (90plus).
 * Section icons are the vectors exported from that frame into
 * assets/images/match-stats/ and rendered with expo-image.
 */
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './MatchText';
import TeamBadge from '../common/TeamBadge';
import type { TeamStatistics } from '../../services/apiFootball';
import { getLocalizedStatType } from '../../utils/i18nHelpers';
import { useTranslation } from '../../src/i18n';

const ICON = {
  possession: require('../../assets/images/match-stats/icon-possession.svg'),
  xg: require('../../assets/images/match-stats/icon-xg.svg'),
  shots: require('../../assets/images/match-stats/icon-shots.svg'),
  passes: require('../../assets/images/match-stats/icon-passes.svg'),
  attacks: require('../../assets/images/match-stats/icon-attacks.svg'),
  corners: require('../../assets/images/match-stats/icon-corners.svg'),
  fouls: require('../../assets/images/match-stats/icon-fouls.svg'),
  offsides: require('../../assets/images/match-stats/icon-offsides.svg'),
  summary: require('../../assets/images/match-stats/icon-summary.svg'),
  idea: require('../../assets/images/match-stats/icon-idea.svg'),
} as const;

const DESIGN_WIDTH = 405;

const C = {
  card: '#0B0518',
  cardBorder: '#281359',
  primary: '#8B5CF6',
  secondary: '#A855F7',
  homeRing: '#AB5CF6',
  homeRingTrack: '#1C0E29',
  awayRingTrack: '#170E29',
  barTrack: '#170F29',
  yellow: '#FDAC0B',
  red: '#B60505',
  muted: '#B0B0B0',
  insight: '#78679F',
};

const DIVIDER_V = ['rgba(139,92,246,0)', 'rgba(139,92,246,0.55)', 'rgba(81,54,144,0)'] as const;

type Pair = { home: number | null; away: number | null };

const STAT_KEYS = {
  possession: ['ballpossession', 'possession', 'possessionpercentage'],
  xg: ['expectedgoals', 'xg', 'expectedgoalsxg'],
  totalShots: ['totalshots', 'shotstotal'],
  shotsOn: ['shotsongoal', 'shotsontarget'],
  shotsOff: ['shotsoffgoal', 'shotsofftarget'],
  blocked: ['blockedshots', 'shotsblocked'],
  totalPasses: ['totalpasses'],
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

// ─── Primitives ──────────────────────────────────────────────────────────────

function VDivider({ height }: { height?: number }) {
  return (
    <LinearGradient
      colors={DIVIDER_V}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={height != null ? { width: 1, height } : styles.vDividerStretch}
    />
  );
}

function HDivider() {
  return (
    <LinearGradient
      colors={DIVIDER_V}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.hDivider}
    />
  );
}

function Section({
  title,
  suffix,
  icon,
  iconNode,
  rtl,
  s,
  children,
}: {
  title: string;
  suffix?: string;
  icon?: number;
  iconNode?: React.ReactNode;
  rtl: boolean;
  s: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 20 * s }}>
      <View
        style={[
          styles.sectionTitleRow,
          {
            flexDirection: rtl ? 'row' : 'row-reverse',
            alignSelf: rtl ? 'flex-end' : 'flex-start',
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { fontSize: 18 * s }]}>
          {title}
          {suffix ? <Text style={styles.sectionTitleSuffix}>{` ${suffix}`}</Text> : null}
        </Text>
        {iconNode ?? (icon != null ? <Image source={icon} style={styles.sectionIcon} contentFit="contain" /> : null)}
      </View>
      {children}
    </View>
  );
}

function Card({ style, children }: { style?: object; children: React.ReactNode }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function PercentRing({
  pct,
  size,
  color,
  track,
}: {
  pct: number;
  size: number;
  color: string;
  track: string;
}) {
  const stroke = size * 0.1;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  // Round caps add stroke/2 at each end — shorten the dash so the visible arc matches pct.
  const dash = Math.max(0.01, (circ * clamped) / 100 - stroke);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={r} stroke={track} strokeWidth={stroke} fill="transparent" />
        {clamped > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={-stroke / 2}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      <Text style={[styles.ringValue, { fontSize: size / 6 }]}>{`${Math.round(clamped)}%`}</Text>
    </View>
  );
}

function RingPair({
  pair,
  homeName,
  awayName,
  s,
  divider,
}: {
  pair: Pair;
  homeName: string;
  awayName: string;
  s: number;
  divider?: boolean;
}) {
  const size = 144 * s;
  return (
    <View style={[styles.pairRow, { gap: (divider ? 36 : 60) * s }]}>
      <View style={[styles.ringCol, { gap: (divider ? 12 : 16) * s }]}>
        <PercentRing pct={n(pair.home)} size={size} color={C.homeRing} track={C.homeRingTrack} />
        <Text style={[styles.teamName, { fontSize: 18 * s }]} numberOfLines={1}>
          {homeName}
        </Text>
      </View>
      {divider ? <VDivider /> : null}
      <View style={[styles.ringCol, { gap: (divider ? 12 : 16) * s }]}>
        <PercentRing pct={n(pair.away)} size={size} color={C.primary} track={C.awayRingTrack} />
        <Text style={[styles.teamName, { fontSize: 18 * s }]} numberOfLines={1}>
          {awayName}
        </Text>
      </View>
    </View>
  );
}

function BigNumberPair({
  pair,
  homeName,
  awayName,
  s,
  fontSize = 48,
  gap = 12,
  decimals = 0,
}: {
  pair: Pair;
  homeName: string;
  awayName: string;
  s: number;
  fontSize?: number;
  gap?: number;
  decimals?: number;
}) {
  const col = (value: number | null, name: string, color: string) => (
    <View style={[styles.bigCol, { gap: gap * s }]}>
      <Text
        style={[styles.bigValue, { color, fontSize: fontSize * s }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {fmt(value, decimals)}
      </Text>
      <Text style={[styles.teamName, { fontSize: 18 * s }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );

  return (
    <View style={[styles.pairRow, { gap: 36 * s }]}>
      {col(pair.home, homeName, C.secondary)}
      <VDivider />
      {col(pair.away, awayName, C.primary)}
    </View>
  );
}

/** Shared track: home fills from the left, away from the right. */
function DualTrack({ pair, s }: { pair: Pair; s: number }) {
  const total = n(pair.home) + n(pair.away);
  const homePct = total > 0 ? (n(pair.home) / total) * 88 : 0;
  const awayPct = total > 0 ? (n(pair.away) / total) * 88 : 0;
  const h = 11 * s;
  return (
    <View style={[styles.track, { height: h, borderRadius: 9 * s }]}>
      <View style={{ width: `${homePct}%`, height: h, borderRadius: 9 * s, backgroundColor: C.secondary }} />
      <View style={{ width: `${awayPct}%`, height: h, borderRadius: 9 * s, backgroundColor: C.primary }} />
    </View>
  );
}

function ShotsCard({
  total,
  rows,
  homeName,
  awayName,
  s,
}: {
  total: Pair;
  rows: Array<{ key: string; label: string; pair: Pair }>;
  homeName: string;
  awayName: string;
  s: number;
}) {
  return (
    <Card style={{ paddingHorizontal: 16 * s, paddingVertical: 25 * s, gap: 36 * s }}>
      <View style={{ gap: 16 * s }}>
        <View style={styles.spaceBetween}>
          <View style={styles.alignStart}>
            <Text style={[styles.smallValue, { fontSize: 24 * s }]}>{fmt(total.home)}</Text>
            <Text style={[styles.smallName, { fontSize: 13 * s }]} numberOfLines={1}>
              {homeName}
            </Text>
          </View>
          <View style={styles.alignEnd}>
            <Text style={[styles.smallValue, { fontSize: 24 * s }]}>{fmt(total.away)}</Text>
            <Text style={[styles.smallName, { fontSize: 13 * s }]} numberOfLines={1}>
              {awayName}
            </Text>
          </View>
        </View>
        <DualTrack pair={total} s={s} />
      </View>

      {rows.map((row) => (
        <View key={row.key} style={{ gap: 13 * s }}>
          <View style={styles.spaceBetween}>
            <Text style={[styles.rowValue, { fontSize: 22 * s }]}>{fmt(row.pair.home)}</Text>
            <Text style={[styles.rowLabel, { fontSize: 16 * s }]} numberOfLines={1}>
              {row.label}
            </Text>
            <Text style={[styles.rowValue, { fontSize: 22 * s }]}>{fmt(row.pair.away)}</Text>
          </View>
          <DualTrack pair={row.pair} s={s} />
        </View>
      ))}
    </Card>
  );
}

/** Corners / fouls / offsides: each side owns its own track, scaled to the larger value. */
function SideBarsCard({
  pair,
  homeName,
  awayName,
  s,
}: {
  pair: Pair;
  homeName: string;
  awayName: string;
  s: number;
}) {
  const max = Math.max(n(pair.home), n(pair.away));
  const pct = (v: number | null) => (max > 0 ? (n(v) / max) * 100 : 0);
  const h = 11 * s;

  const side = (value: number | null, name: string, color: string, align: 'start' | 'end') => (
    <View style={[styles.flex1, { gap: 16 * s }]}>
      <View style={align === 'start' ? styles.alignStart : styles.alignEnd}>
        <Text style={[styles.smallValue, { fontSize: 24 * s }]}>{fmt(value)}</Text>
        <Text style={[styles.smallName, { fontSize: 13 * s }]} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View
        style={[
          styles.track,
          { height: h, borderRadius: 9 * s, justifyContent: align === 'start' ? 'flex-start' : 'flex-end' },
        ]}
      >
        <View style={{ width: `${pct(value)}%`, height: h, borderRadius: 9 * s, backgroundColor: color }} />
      </View>
    </View>
  );

  return (
    <Card style={{ paddingHorizontal: 16 * s, paddingVertical: 25 * s }}>
      <View style={[styles.pairRow, { gap: 16 * s }]}>
        {side(pair.home, homeName, C.secondary, 'start')}
        <VDivider />
        {side(pair.away, awayName, C.primary, 'end')}
      </View>
    </Card>
  );
}

function CardsCard({
  yellow,
  red,
  homeName,
  awayName,
  s,
}: {
  yellow: Pair;
  red: Pair;
  homeName: string;
  awayName: string;
  s: number;
}) {
  const group = (value: number | null, name: string, color: string) => (
    <View style={[styles.cardGroup, { gap: 7 * s }]}>
      <View style={[styles.cardCountCol, { gap: 8 * s }]}>
        <Text style={[styles.cardCount, { fontSize: 40 * s }]}>{fmt(value)}</Text>
        <Text style={[styles.teamName, { fontSize: 18 * s }]} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View style={{ width: 20 * s, height: 26 * s, borderRadius: 3, backgroundColor: color }} />
    </View>
  );

  const row = (pair: Pair, color: string) => (
    <View style={[styles.pairRow, { gap: 36 * s }]}>
      {group(pair.home, homeName, color)}
      <VDivider />
      {group(pair.away, awayName, color)}
    </View>
  );

  return (
    <Card style={{ paddingHorizontal: 16 * s, paddingVertical: 24 * s, gap: 24 * s }}>
      {row(yellow, C.yellow)}
      <HDivider />
      {row(red, C.red)}
    </Card>
  );
}

function SummarySide({
  name,
  logo,
  metrics,
  align,
  s,
}: {
  name: string;
  logo?: string;
  metrics: Array<{ key: string; value: string; label: string; small?: boolean }>;
  align: 'start' | 'end';
  s: number;
}) {
  const crest = (
    <TeamBadge name={name} logo={logo} size={39 * s} color="transparent" />
  );
  return (
    <View style={[styles.summarySide, { gap: 5 * s, flexDirection: align === 'start' ? 'row' : 'row-reverse' }]}>
      {crest}
      <View style={[styles.flex1, { gap: 24 * s, alignItems: align === 'start' ? 'flex-start' : 'flex-end' }]}>
        <Text
          style={[styles.summaryName, { fontSize: 23 * s, textAlign: align === 'start' ? 'left' : 'right' }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {name}
        </Text>
        <View style={[styles.summaryMetrics, { gap: 12 * s }]}>
          {metrics.map((m) => (
            <View key={m.key} style={[styles.flex1, styles.summaryMetric]}>
              <Text style={[styles.summaryValue, { fontSize: 19 * s }]} numberOfLines={1} adjustsFontSizeToFit>
                {m.value}
              </Text>
              <Text
                style={[styles.summaryLabel, { fontSize: (m.small ? 9 : 11) * s }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {m.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

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
  homeLogo,
  awayLogo,
}: MatchStatsCompareProps) {
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
    let passAccuracy = get(STAT_KEYS.passAccuracy);
    if (!has(passAccuracy)) {
      const accurate = get(STAT_KEYS.passesAccurate);
      const ratio = (a: number | null, tot: number | null) =>
        a != null && tot ? Math.round((a / tot) * 100) : null;
      passAccuracy = {
        home: ratio(accurate.home, totalPasses.home),
        away: ratio(accurate.away, totalPasses.away),
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

  const shotRows = [
    { key: 'on', label: md.statsOnTarget, pair: p.shotsOn },
    { key: 'off', label: md.statsOffTarget, pair: p.shotsOff },
    { key: 'blocked', label: md.statsBlocked, pair: p.blocked },
  ].filter((r) => has(r.pair));

  const summaryMetrics = (side: 'home' | 'away') =>
    [
      has(p.xg) ? { key: 'xg', value: fmt(p.xg[side], 2), label: 'xG' } : null,
      has(p.totalShots) ? { key: 'shots', value: fmt(p.totalShots[side]), label: md.statsSummaryShots } : null,
      has(p.shotsOn) ? { key: 'on', value: fmt(p.shotsOn[side]), label: md.statsOnTarget, small: true } : null,
    ].filter((m): m is NonNullable<typeof m> => m != null);

  const sectionProps = { rtl, s };
  const names = { homeName, awayName, s };

  return (
    <View style={[styles.root, { gap: 28 * s }]} onLayout={onLayout}>
      {has(p.possession) ? (
        <Section title={getLocalizedStatType('Ball Possession', language)} icon={ICON.possession} {...sectionProps}>
          <Card style={{ paddingVertical: 20 * s }}>
            <RingPair pair={p.possession} {...names} />
          </Card>
        </Section>
      ) : null}

      {has(p.xg) ? (
        <Section title={md.statsXgTitle} suffix="(XG)" icon={ICON.xg} {...sectionProps}>
          <Card style={{ paddingHorizontal: 16 * s, paddingVertical: 28 * s }}>
            <BigNumberPair pair={p.xg} decimals={2} gap={24} {...names} />
          </Card>
        </Section>
      ) : null}

      {has(p.totalShots) ? (
        <Section title={md.shots} icon={ICON.shots} {...sectionProps}>
          <ShotsCard total={p.totalShots} rows={shotRows} {...names} />
        </Section>
      ) : null}

      {has(p.totalPasses) || has(p.passAccuracy) ? (
        <Section title={md.passes} icon={ICON.passes} {...sectionProps}>
          <Card style={{ paddingHorizontal: 16 * s, paddingVertical: 24 * s, gap: 24 * s }}>
            {has(p.totalPasses) ? <BigNumberPair pair={p.totalPasses} {...names} /> : null}
            {has(p.totalPasses) && has(p.passAccuracy) ? <HDivider /> : null}
            {has(p.passAccuracy) ? (
              <View style={{ gap: 8 * s, alignItems: 'center' }}>
                <Text style={[styles.subTitle, { fontSize: 18 * s }]}>
                  {getLocalizedStatType('Pass Accuracy', language)}
                </Text>
                <RingPair pair={p.passAccuracy} divider {...names} />
              </View>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {has(p.attacks) || has(p.dangerous) ? (
        <Section title={getLocalizedStatType('Attacks', language)} icon={ICON.attacks} {...sectionProps}>
          <Card style={{ paddingHorizontal: 16 * s, paddingVertical: 24 * s, gap: 24 * s }}>
            {has(p.attacks) ? <BigNumberPair pair={p.attacks} {...names} /> : null}
            {has(p.attacks) && has(p.dangerous) ? <HDivider /> : null}
            {has(p.dangerous) ? (
              <View style={{ gap: 12 * s, alignItems: 'center' }}>
                <Text style={[styles.subTitle, { fontSize: 18 * s }]}>
                  {getLocalizedStatType('Dangerous Attacks', language)}
                </Text>
                <BigNumberPair pair={p.dangerous} fontSize={42} {...names} />
              </View>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {has(p.corners) ? (
        <Section title={md.corners} icon={ICON.corners} {...sectionProps}>
          <SideBarsCard pair={p.corners} {...names} />
        </Section>
      ) : null}

      {has(p.fouls) ? (
        <Section title={md.fouls} icon={ICON.fouls} {...sectionProps}>
          <SideBarsCard pair={p.fouls} {...names} />
        </Section>
      ) : null}

      {has(p.yellow) || has(p.red) ? (
        <Section
          title={md.statsCards}
          iconNode={
            <LinearGradient
              colors={[C.primary, '#513590']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.cardsIcon}
            />
          }
          {...sectionProps}
        >
          <CardsCard yellow={p.yellow} red={p.red} {...names} />
        </Section>
      ) : null}

      {has(p.offsides) ? (
        <Section title={md.offsides} icon={ICON.offsides} {...sectionProps}>
          <SideBarsCard pair={p.offsides} {...names} />
        </Section>
      ) : null}

      {summaryMetrics('home').length > 0 ? (
        <View style={{ gap: 12 * s }}>
          <Section title={md.statsSummary} icon={ICON.summary} {...sectionProps}>
            <Card style={{ padding: 16 * s }}>
              <View style={[styles.pairRow, { gap: 9 * s, alignItems: 'center' }]}>
                <SummarySide name={homeName} logo={homeLogo} metrics={summaryMetrics('home')} align="start" s={s} />
                <VDivider height={72 * s} />
                <SummarySide name={awayName} logo={awayLogo} metrics={summaryMetrics('away')} align="end" s={s} />
              </View>
            </Card>
          </Section>

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
              <Text style={[styles.insightText, { fontSize: 14 * s, textAlign: rtl ? 'right' : 'left' }]}>
                {insight}
              </Text>
              <View style={styles.insightIconBox}>
                <Image source={ICON.idea} style={styles.insightIcon} contentFit="contain" />
              </View>
            </LinearGradient>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  flex1: {
    flex: 1,
  },
  card: {
    width: '100%',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 16,
  },
  sectionTitleRow: {
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  sectionTitleSuffix: {
    color: '#DFD1FD',
    fontWeight: '500',
  },
  sectionIcon: {
    width: 22,
    height: 22,
  },
  cardsIcon: {
    width: 16,
    height: 22,
    borderRadius: 3,
  },
  vDividerStretch: {
    width: 1,
    alignSelf: 'stretch',
  },
  hDivider: {
    width: '100%',
    height: 1,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ringCol: {
    flex: 1,
    alignItems: 'center',
  },
  ringValue: {
    color: '#fff',
    fontWeight: '600',
  },
  teamName: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  bigCol: {
    flex: 1,
    alignItems: 'center',
  },
  bigValue: {
    fontWeight: '700',
    textAlign: 'center',
  },
  subTitle: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  spaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  alignStart: {
    alignItems: 'flex-start',
    gap: 2,
  },
  alignEnd: {
    alignItems: 'flex-end',
    gap: 2,
  },
  smallValue: {
    color: C.primary,
    fontWeight: '700',
  },
  smallName: {
    color: '#fff',
    fontWeight: '600',
  },
  rowValue: {
    color: '#fff',
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  rowLabel: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  track: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: C.barTrack,
    overflow: 'hidden',
  },
  cardGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  cardCountCol: {
    flexShrink: 1,
    alignItems: 'center',
  },
  cardCount: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  summarySide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  summaryName: {
    color: '#fff',
    fontWeight: '700',
    alignSelf: 'stretch',
  },
  summaryMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  summaryMetric: {
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryLabel: {
    color: C.muted,
    fontWeight: '600',
    textAlign: 'center',
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
    color: C.insight,
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
