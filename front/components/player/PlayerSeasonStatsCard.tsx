/**
 * Player season / highlight stats — Figma-inspired card (rings + bars),
 * adapted for a single athlete (not home/away comparison).
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const RING_SIZE = 64;
const RING_STROKE = 7;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

const TRACK_BG = '#1a1a1a';
const FILL_PURPLE = '#630db4';
const FILL_PURPLE_DEEP = '#240145';
const RING_TRACK = '#1C0F36';
const CARD_BORDER = '#2d0652';
const CARD_BG = '#07040D';

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
}: {
  value: number;
  max: number;
  label: string;
  display?: string;
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
            stroke={RING_TRACK}
            strokeWidth={RING_STROKE}
            fill="transparent"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={FILL_PURPLE}
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
}: {
  label: string;
  value: number;
  max: number;
  display?: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <View style={styles.barBlock}>
      <Text style={styles.barTitle}>{label}</Text>
      <View style={styles.barRow}>
        <Text style={styles.barValue}>{display ?? String(Math.round(value))}</Text>
        <View style={styles.barTrack}>
          {pct > 0 ? (
            <LinearGradient
              colors={[FILL_PURPLE, FILL_PURPLE_DEEP]}
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
  const ringMax = useMemo(() => {
    const m = Math.max(0, ...rings.map((r) => r.value));
    return m > 0 ? m : 1;
  }, [rings]);

  const barMax = useMemo(() => {
    const m = Math.max(0, ...bars.map((b) => b.max ?? b.value));
    return m > 0 ? m : 1;
  }, [bars]);

  if (rings.length === 0 && bars.length === 0) return null;

  return (
    <View style={styles.card}>
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
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 24,
    marginTop: 12,
    shadowColor: '#29054F',
    shadowOpacity: 0.48,
    shadowRadius: 21,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'center',
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 33,
    backgroundColor: TRACK_BG,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: 10,
    borderRadius: 33,
  },
});
