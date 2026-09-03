/**
 * Dev-only SVG chart driven by MomentumSeries (no API).
 * Mirrors production MatchMomentumGraph chart geometry for fair lab comparison.
 * Not used by production match-details.
 */

import React, { useEffect, useId, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import {
  minuteToXRtl,
  type MomentumMarker,
  type MomentumSeries,
} from '../../utils/matchMomentum';
import { MatchEventIcon } from './MatchEventIcon';
import TeamBadge from '../common/TeamBadge';
import {
  PURPLE_PRIMARY,
  PURPLE_DARK,
  GLASS_BORDER_SIDE,
  GLASS_BORDER_TOP,
  BG_MID,
  TEXT_PRIMARY,
  TEXT_MUTED,
  RADIUS_LG,
} from '../../constants/tokens';

const AWAY_GREY = '#3A3A42';
const GRID = 'rgba(255,255,255,0.12)';
const AXIS = 'rgba(255,255,255,0.35)';
const PAD_X = 14;
const PAD_TOP = 28;
const PAD_BOTTOM = 28;
const CHART_H = 168;

function MarkerGlyph({ marker }: { marker: MomentumMarker }) {
  if (marker.kind === 'goal') {
    return <MatchEventIcon type="Goal" detail={marker.detail} size={16} />;
  }
  if (marker.kind === 'card') {
    return <MatchEventIcon type="Card" detail={marker.detail} size={16} />;
  }
  if (marker.kind === 'var') {
    return <Ionicons name="tv-outline" size={14} color="#e9d5ff" />;
  }
  if (marker.kind === 'corner') {
    return <MatchEventIcon type="Corner" detail={marker.detail} size={14} />;
  }
  return <MatchEventIcon type="subst" detail={marker.detail} size={14} />;
}

function valueToY(value: number, midY: number, halfH: number, mirrorDown: boolean): number {
  const amp = (Math.min(100, Math.max(0, value)) / 100) * halfH;
  return mirrorDown ? midY + amp : midY - amp;
}

function buildAreaPath(
  values: number[],
  duration: number,
  innerW: number,
  midY: number,
  halfH: number,
  mirrorDown: boolean,
): string {
  if (values.length < 2) return '';
  const pts = values.map((v, minute) => ({
    x: minuteToXRtl(minute, duration, innerW, PAD_X),
    y: valueToY(v, midY, halfH, mirrorDown),
  }));
  let d = `M ${pts[0].x} ${midY} L ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y} ${cx} ${p1.y} ${p1.x} ${p1.y}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${midY} Z`;
  return d;
}

type Props = {
  series: MomentumSeries;
  homeTeam?: { name: string; logo?: string };
  awayTeam?: { name: string; logo?: string };
  onRenderPass?: () => void;
};

export function MatchMomentumGraphSvgLab({ series, homeTeam, awayTeam, onRenderPass }: Props) {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(screenW - 32, 420);
  const uid = useId().replace(/:/g, '');
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    onRenderPass?.();
  });

  const innerW = Math.max(1, cardW - PAD_X * 2);
  const midY = PAD_TOP + CHART_H / 2;
  const halfH = CHART_H / 2 - 6;
  const totalH = PAD_TOP + CHART_H + PAD_BOTTOM;
  const homeGrad = `homeFill-${uid}`;
  const awayGrad = `awayFill-${uid}`;

  const homePath = useMemo(
    () => buildAreaPath(series.home, series.duration, innerW, midY, halfH, false),
    [series.home, series.duration, innerW, midY, halfH],
  );
  const awayPath = useMemo(
    () => buildAreaPath(series.away, series.duration, innerW, midY, halfH, true),
    [series.away, series.duration, innerW, midY, halfH],
  );

  const gridYs = [midY - halfH * 0.55, midY, midY + halfH * 0.55];
  const labels = [
    { m: series.duration, text: `${series.duration}'` },
    { m: Math.round(series.duration / 2), text: `${Math.round(series.duration / 2)}'` },
    { m: 0, text: "0'" },
  ];

  return (
    <View style={[styles.card, { width: cardW }]}>
      <View style={{ width: cardW, height: totalH }}>
        <Svg width={cardW} height={totalH}>
          <Defs>
            <LinearGradient id={homeGrad} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={PURPLE_PRIMARY} stopOpacity="0.95" />
              <Stop offset="1" stopColor={PURPLE_DARK} stopOpacity="0.45" />
            </LinearGradient>
            <LinearGradient id={awayGrad} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={AWAY_GREY} stopOpacity="0.55" />
              <Stop offset="1" stopColor={AWAY_GREY} stopOpacity="0.95" />
            </LinearGradient>
          </Defs>
          {gridYs.map((y, i) => (
            <Line
              key={`h-${i}`}
              x1={PAD_X}
              y1={y}
              x2={PAD_X + innerW}
              y2={y}
              stroke={GRID}
              strokeWidth={1}
            />
          ))}
          {[0, Math.round(series.duration / 2), series.duration].map((m) => {
            const x = minuteToXRtl(m, series.duration, innerW, PAD_X);
            return (
              <Line
                key={`v-${m}`}
                x1={x}
                y1={PAD_TOP}
                x2={x}
                y2={PAD_TOP + CHART_H}
                stroke={m === Math.round(series.duration / 2) ? AXIS : GRID}
                strokeWidth={m === Math.round(series.duration / 2) ? 1.2 : 1}
              />
            );
          })}
          {awayPath ? <Path d={awayPath} fill={`url(#${awayGrad})`} /> : null}
          {homePath ? <Path d={homePath} fill={`url(#${homeGrad})`} /> : null}
          {series.markers.map((marker, idx) => {
            const x = minuteToXRtl(marker.minute, series.duration, innerW, PAD_X);
            const amp = (Math.min(100, marker.intensity) / 100) * halfH;
            const peakY = marker.side === 'home' ? midY - amp : midY + amp;
            const iconY = marker.side === 'home' ? PAD_TOP - 4 : PAD_TOP + CHART_H + 4;
            return (
              <Line
                key={`stem-${idx}`}
                x1={x}
                y1={peakY}
                x2={x}
                y2={iconY}
                stroke="rgba(233,213,255,0.55)"
                strokeWidth={1}
              />
            );
          })}
        </Svg>
        {series.markers.map((marker, idx) => {
          const x = minuteToXRtl(marker.minute, series.duration, innerW, PAD_X);
          const top = marker.side === 'home' ? 6 : PAD_TOP + CHART_H + 2;
          return (
            <View
              key={`mk-${idx}-${marker.minute}-${marker.kind}`}
              style={[styles.marker, { left: x - 10, top }]}
              pointerEvents="none"
            >
              <MarkerGlyph marker={marker} />
            </View>
          );
        })}
        <View style={styles.axisRow} pointerEvents="none">
          {labels.map((l) => (
            <Text
              key={l.text}
              style={[
                styles.axisLabel,
                { left: minuteToXRtl(l.m, series.duration, innerW, PAD_X) - 14, width: 28 },
              ]}
            >
              {l.text}
            </Text>
          ))}
        </View>
      </View>
      {(homeTeam || awayTeam) && (
        <View style={styles.legend}>
          {homeTeam?.name ? (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PURPLE_PRIMARY }]} />
              <TeamBadge name={homeTeam.name} logo={homeTeam.logo} size={18} color="transparent" />
              <Text style={styles.legendName} numberOfLines={1}>
                {homeTeam.name}
              </Text>
            </View>
          ) : (
            <View style={styles.legendItem} />
          )}
          {awayTeam?.name ? (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: AWAY_GREY }]} />
              <TeamBadge name={awayTeam.name} logo={awayTeam.logo} size={18} color="transparent" />
              <Text style={styles.legendName} numberOfLines={1}>
                {awayTeam.name}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 14,
    borderRadius: RADIUS_LG,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS_BORDER_SIDE,
    borderTopColor: GLASS_BORDER_TOP,
    backgroundColor: BG_MID,
  },
  marker: {
    position: 'absolute',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  axisRow: {
    ...StyleSheet.absoluteFillObject,
    top: undefined,
    bottom: 6,
    height: 18,
  },
  axisLabel: {
    position: 'absolute',
    color: TEXT_PRIMARY,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 12,
  },
  legendItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    flex: 1,
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '600',
  },
});
