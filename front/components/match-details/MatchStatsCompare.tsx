/**
 * Match statistics comparison — Figma node 550:2626 (90plus).
 * Circular gauges + dual bars for home vs away.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import type { TeamStatistics } from '../../services/apiFootball';
import { getLocalizedStatType } from '../../utils/i18nHelpers';
import type { Language } from '../../src/i18n';

const RING_SIZE = 64;
const RING_STROKE = 7;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

const TRACK_BG = '#1a1a1a';
const HOME_PURPLE = '#630db4';
const HOME_PURPLE_DEEP = '#240145';
const AWAY_GRAY = '#494949';
const AWAY_GRAY_DIM = '#262626';
const RING_TRACK = '#1C0F36';
const CARD_BORDER = '#2d0652';

type StatPair = { home: number; away: number };

function parseStatNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const pct = v.match(/^(\d+(?:\.\d+)?)\s*%$/);
    if (pct) return parseFloat(pct[1]) || 0;
    const n = parseFloat(v.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function findStatValue(
  teamStats: TeamStatistics | undefined,
  typeMatchers: string[],
): number {
  const rows = teamStats?.statistics ?? [];
  for (const row of rows) {
    const t = (row.type ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (typeMatchers.some((m) => t === m || t.includes(m))) {
      return parseStatNum(row.value);
    }
  }
  return 0;
}

function DualRing({
  home,
  away,
  labelLines,
  labelSize = 10,
}: {
  home: number;
  away: number;
  labelLines: string[];
  labelSize?: number;
}) {
  const total = home + away;
  const homePct = total > 0 ? home / total : 0.5;
  const homeLen = homePct * RING_C;
  const awayLen = RING_C - homeLen;

  return (
    <View style={styles.ringWrap}>
      <Text style={styles.ringValue}>{Math.round(home)}</Text>
      <View style={styles.ringCircle}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={RING_TRACK}
            strokeWidth={RING_STROKE}
            fill="transparent"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={AWAY_GRAY}
            strokeWidth={RING_STROKE}
            fill="transparent"
            strokeDasharray={`${awayLen} ${RING_C}`}
            strokeDashoffset={-homeLen}
            strokeLinecap="butt"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={HOME_PURPLE}
            strokeWidth={RING_STROKE}
            fill="transparent"
            strokeDasharray={`${homeLen} ${RING_C}`}
            strokeDashoffset={0}
            strokeLinecap="butt"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.ringLabelBox} pointerEvents="none">
          {labelLines.filter(Boolean).map((line) => (
            <Text
              key={line}
              style={[styles.ringLabel, { fontSize: labelSize }]}
              numberOfLines={1}
            >
              {line}
            </Text>
          ))}
        </View>
      </View>
      <Text style={styles.ringValue}>{Math.round(away)}</Text>
    </View>
  );
}

function DualBar({ home, away }: StatPair) {
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
            style={[
              styles.barHome,
              { flex: homeFlex },
              home === 0 && styles.barZero,
            ]}
          />
          <LinearGradient
            colors={[AWAY_GRAY_DIM, AWAY_GRAY]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[
              styles.barAway,
              { flex: awayFlex },
              away === 0 && styles.barZero,
            ]}
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
        <Text style={styles.barValue}>{Math.round(home)}</Text>
        <DualBar home={home} away={away} />
        <Text style={styles.barValue}>{Math.round(away)}</Text>
      </View>
    </View>
  );
}

export interface MatchStatsCompareProps {
  statistics: TeamStatistics[];
  language: Language;
  title: string;
  possessionLabelLines: string[];
  dangerousAttacksLabelLines: string[];
  attacksLabel: string;
}

export function MatchStatsCompare({
  statistics,
  language,
  title,
  possessionLabelLines,
  dangerousAttacksLabelLines,
  attacksLabel,
}: MatchStatsCompareProps) {
  const home = statistics[0];
  const away = statistics[1];

  const pairs = useMemo(() => {
    const get = (...keys: string[]) => ({
      home: findStatValue(home, keys),
      away: findStatValue(away, keys),
    });
    return {
      possession: get('ballpossession', 'possession'),
      dangerous: get('dangerousattacks', 'dangerousattack'),
      attacks: get('attacks', 'attack'),
      shotsOn: get('shotsongoal', 'shotsontarget'),
      shotsOff: get('shotsoffgoal', 'shotsofftarget'),
      corners: get('cornerkicks', 'corners'),
      fouls: get('fouls'),
      yellow: get('yellowcards'),
      red: get('redcards'),
    };
  }, [home, away]);

  const barRows: Array<{ key: string; label: string; pair: StatPair }> = [
    {
      key: 'shotsOn',
      label: getLocalizedStatType('Shots on Goal', language),
      pair: pairs.shotsOn,
    },
    {
      key: 'shotsOff',
      label: getLocalizedStatType('Shots off Goal', language),
      pair: pairs.shotsOff,
    },
    {
      key: 'corners',
      label: getLocalizedStatType('Corner Kicks', language),
      pair: pairs.corners,
    },
    {
      key: 'fouls',
      label: getLocalizedStatType('Fouls', language),
      pair: pairs.fouls,
    },
    {
      key: 'yellow',
      label: getLocalizedStatType('Yellow Cards', language),
      pair: pairs.yellow,
    },
    {
      key: 'red',
      label: getLocalizedStatType('Red Cards', language),
      pair: pairs.red,
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.ringsRow}>
        <DualRing
          home={pairs.possession.home}
          away={pairs.possession.away}
          labelLines={possessionLabelLines}
          labelSize={10}
        />
        <DualRing
          home={pairs.dangerous.home}
          away={pairs.dangerous.away}
          labelLines={dangerousAttacksLabelLines}
          labelSize={12}
        />
        <DualRing
          home={pairs.attacks.home}
          away={pairs.attacks.away}
          labelLines={[attacksLabel]}
          labelSize={12}
        />
      </View>

      <View style={styles.barsCol}>
        {barRows.map((row) => (
          <BarStatRow
            key={row.key}
            label={row.label}
            home={row.pair.home}
            away={row.pair.away}
          />
        ))}
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
    gap: 24,
    // Soft purple glow (Figma shadow)
    shadowColor: 'rgba(42,4,78,0.48)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 21,
    elevation: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  ringsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 4,
  },
  ringWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ringCircle: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabelBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  ringLabel: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  ringValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 18,
    textAlign: 'center',
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

export default MatchStatsCompare;
