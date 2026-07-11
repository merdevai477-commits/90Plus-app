/**
 * Segmented 1X2 crowd tip strip (365 community Who Will Win? %).
 */

import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type CrowdOddsStripProps = {
  homePercent: number;
  drawPercent: number;
  awayPercent: number;
  label: string;
  compact?: boolean;
  /** Accent for the label row (defaults to soft purple). */
  labelColor?: string;
};

export const CrowdOddsStrip = memo(function CrowdOddsStrip({
  homePercent,
  drawPercent,
  awayPercent,
  label,
  compact,
  labelColor = 'rgba(233,213,255,0.75)',
}: CrowdOddsStripProps) {
  const home = Math.max(0, homePercent);
  const draw = Math.max(0, drawPercent);
  const away = Math.max(0, awayPercent);
  const lead =
    home >= draw && home >= away ? 'home' : away >= draw && away >= home ? 'away' : 'draw';

  const segments: Array<{
    key: 'home' | 'draw' | 'away';
    pct: number;
    barStyle: object;
    minShowLabel: number;
  }> = [
    { key: 'home', pct: home, barStyle: styles.segHome, minShowLabel: 12 },
    { key: 'draw', pct: draw, barStyle: styles.segDraw, minShowLabel: 10 },
    { key: 'away', pct: away, barStyle: styles.segAway, minShowLabel: 12 },
  ];

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        <View style={styles.legend}>
          <Text style={[styles.legendTxt, lead === 'home' && styles.legendLead]}>{home}%</Text>
          <Text style={styles.legendSep}>·</Text>
          <Text style={[styles.legendTxt, lead === 'draw' && styles.legendLead]}>{draw}%</Text>
          <Text style={styles.legendSep}>·</Text>
          <Text style={[styles.legendTxt, lead === 'away' && styles.legendLead]}>{away}%</Text>
        </View>
      </View>
      <View style={styles.track}>
        {segments.map((seg) =>
          seg.pct <= 0 ? null : (
            <View
              key={seg.key}
              style={[
                styles.seg,
                seg.barStyle,
                lead === seg.key && styles.segLead,
                { flex: Math.max(seg.pct, 1) },
              ]}
            >
              {seg.pct >= seg.minShowLabel ? (
                <Text style={styles.segTxt} numberOfLines={1}>
                  {seg.pct}%
                </Text>
              ) : null}
            </View>
          ),
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  wrapCompact: { marginBottom: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendTxt: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  legendLead: { color: '#fff', fontWeight: '900' },
  legendSep: { color: 'rgba(255,255,255,0.25)', fontSize: 11 },
  track: {
    flexDirection: 'row',
    height: 28,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  seg: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 2,
  },
  segHome: { backgroundColor: 'rgba(37,99,235,0.92)' },
  segDraw: { backgroundColor: 'rgba(100,116,139,0.9)' },
  segAway: { backgroundColor: 'rgba(225,29,72,0.92)' },
  segLead: { opacity: 1 },
  segTxt: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
