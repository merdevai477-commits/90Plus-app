/**
 * Player season / highlight stats — rings + bars.
 * Uses the new 90Plus purple palette and elevated card treatment.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import { getPPColors } from '../PlayerProfile/theme';

const RING_SIZE = 64;
const RING_STROKE = 7;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

export type PlayerStatRingItem = {
  label: string;
  value: number;
  display?: string;
};

export type PlayerStatBarItem = {
  label: string;
  value: number;
  display?: string;
  /** Optional scale ceiling; defaults to max across all bars. */
  max?: number;
};

export function parsePlayerStatNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const pct = v.match(/^(\d+(?:\.\d+)?)\s*%$/);
    if (pct) return parseFloat(pct[1]) || 0;
    const n = parseFloat(v.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function StatRing({
  value,
  max,
  label,
  display,
  track,
  fill,
}: {
  value: number;
  max: number;
  label: string;
  display?: string;
  track: string;
  fill: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const fillLen = pct * RING_C;
  const lines = label.split(/\s+/).filter(Boolean).slice(0, 2);

  return (
    <View style={styles.ringWrap}>
      <View style={styles.ringCircle}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={track}
            strokeWidth={RING_STROKE}
            fill="transparent"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={fill}
            strokeWidth={RING_STROKE}
            fill="transparent"
            strokeDasharray={`${fillLen} ${RING_C}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter} pointerEvents="none">
          <Text style={styles.ringValue} numberOfLines={1}>
            {display ?? String(Math.round(value))}
          </Text>
        </View>
      </View>
      <View style={styles.ringLabelBox}>
        {lines.map((line) => (
          <Text key={line} style={styles.ringLabel} numberOfLines={1}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

function StatBarRow({
  label,
  value,
  max,
  display,
  track,
}: {
  label: string;
  value: number;
  max: number;
  display?: string;
  track: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <View style={styles.barBlock}>
      <Text style={styles.barTitle}>{label}</Text>
      <View style={styles.barRow}>
        <Text style={styles.barValue}>{display ?? String(Math.round(value))}</Text>
        <View style={[styles.barTrack, { backgroundColor: track }]}>
          {pct > 0 ? (
            <LinearGradient
              colors={['#8b5cf6', '#5422ae', '#230e48']}
              start={{ x: 1, y: 0.5 }}
              end={{ x: 0, y: 0.5 }}
              style={[styles.barFill, { flex: Math.max(pct, 0.02) }]}
            />
          ) : null}
          <View style={{ flex: Math.max(1 - pct, 0.001) }} />
        </View>
      </View>
    </View>
  );
}

export type PlayerSeasonStatsCardProps = {
  title: string;
  rings: PlayerStatRingItem[];
  bars: PlayerStatBarItem[];
};

export function PlayerSeasonStatsCard({
  title,
  rings,
  bars,
}: PlayerSeasonStatsCardProps): React.ReactElement | null {
  const { isDark } = useResolvedAppScheme();
  const C = getPPColors(isDark);

  const ringMax = useMemo(() => {
    const m = Math.max(0, ...rings.map((r) => r.value));
    return m > 0 ? m : 1;
  }, [rings]);

  const barMax = useMemo(() => {
    const m = Math.max(0, ...bars.map((b) => b.max ?? b.value));
    return m > 0 ? m : 1;
  }, [bars]);

  if (rings.length === 0 && bars.length === 0) return null;

  const cardBg = isDark ? '#120a22' : '#1a0b33';
  const border = isDark ? C.border : '#3b1d6e';
  const track = isDark ? '#2a2040' : '#2c1548';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: border,
          shadowColor: C.primaryDark,
        },
      ]}
    >
      <Text style={styles.title}>{title}</Text>

      {rings.length > 0 ? (
        <View style={styles.ringsRow}>
          {rings.slice(0, 3).map((r) => (
            <StatRing
              key={r.label}
              value={r.value}
              max={ringMax}
              label={r.label}
              display={r.display}
              track={track}
              fill={C.primarySoft}
            />
          ))}
        </View>
      ) : null}

      {bars.length > 0 ? (
        <View style={styles.barsCol}>
          {bars.map((b) => (
            <StatBarRow
              key={b.label}
              label={b.label}
              value={b.value}
              max={b.max != null && b.max > 0 ? b.max : barMax}
              display={b.display}
              track={track}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 24,
    marginTop: 12,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    gap: 8,
  },
  ringWrap: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  ringCircle: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  ringLabelBox: {
    alignItems: 'center',
    minHeight: 28,
  },
  ringLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  barsCol: {
    gap: 16,
  },
  barBlock: {
    gap: 10,
  },
  barTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 33,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: 10,
    borderRadius: 33,
  },
});
