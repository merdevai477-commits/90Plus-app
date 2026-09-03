/**
 * ISOLATED Skia prototype of Match Momentum.
 * Does not replace production MatchMomentumGraph (SVG).
 * No remote momentum fetch — render-only; use seriesOverride or local buildMomentumFromEvents.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  Canvas,
  Group,
  Line as SkLine,
  LinearGradient,
  Path,
  Rect,
  Circle,
  vec,
  Skia,
  type SkPath,
} from '@shopify/react-native-skia';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { FixtureEvent } from '../../services/apiFootball';
import {
  buildMomentumFromEvents,
  minuteToXRtl,
  type MomentumMarker,
  type MomentumSeries,
} from '../../utils/matchMomentum';
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

type TeamLegend = {
  name: string;
  logo?: string;
};

export type MatchMomentumGraphSkiaProps = {
  events: FixtureEvent[];
  fixtureId?: number | null;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  matchElapsed?: number | null;
  finished?: boolean;
  homeTeam?: TeamLegend;
  awayTeam?: TeamLegend;
  /**
   * Lab / prototype only: inject identical series (skips local rebuild + any fetch).
   * Production MatchMomentumGraph is unchanged and still owns remote fetch.
   */
  seriesOverride?: MomentumSeries | null;
  /** When set with applySkiaMomentumSeries, paths update without React re-render. */
  highFreqPaths?: {
    home: SharedValue<SkPath>;
    away: SharedValue<SkPath>;
    stems: SharedValue<SkPath>;
    duration: SharedValue<number>;
  };
  onRenderPass?: () => void;
};

const AWAY_GREY = '#3A3A42';
const GRID = 'rgba(255,255,255,0.12)';
const AXIS = 'rgba(255,255,255,0.35)';
const STEM = 'rgba(233,213,255,0.55)';
const PAD_X = 14;
const PAD_TOP = 28;
const PAD_BOTTOM = 28;
const CHART_H = 168;

function valueToY(value: number, midY: number, halfH: number, mirrorDown: boolean): number {
  const amp = (Math.min(100, Math.max(0, value)) / 100) * halfH;
  return mirrorDown ? midY + amp : midY - amp;
}

/** Same Bezier formula as production SVG `buildAreaPath` — geometry only. */
export function buildSkiaAreaPath(
  values: number[],
  duration: number,
  innerW: number,
  midY: number,
  halfH: number,
  mirrorDown: boolean,
): SkPath {
  const path = Skia.Path.Make();
  if (values.length < 2) return path;
  const pts = values.map((v, minute) => ({
    x: minuteToXRtl(minute, duration, innerW, PAD_X),
    y: valueToY(v, midY, halfH, mirrorDown),
  }));
  path.moveTo(pts[0].x, midY);
  path.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const cx = (p0.x + p1.x) / 2;
    path.cubicTo(cx, p0.y, cx, p1.y, p1.x, p1.y);
  }
  path.lineTo(pts[pts.length - 1].x, midY);
  path.close();
  return path;
}

function buildStemPath(
  markers: MomentumMarker[],
  duration: number,
  innerW: number,
  midY: number,
  halfH: number,
): SkPath {
  const path = Skia.Path.Make();
  for (const marker of markers) {
    const x = minuteToXRtl(marker.minute, duration, innerW, PAD_X);
    const amp = (Math.min(100, marker.intensity) / 100) * halfH;
    const peakY = marker.side === 'home' ? midY - amp : midY + amp;
    const iconY = marker.side === 'home' ? PAD_TOP - 4 : PAD_TOP + CHART_H + 4;
    path.moveTo(x, peakY);
    path.lineTo(x, iconY);
  }
  return path;
}

export type SkiaMomentumLayout = {
  width: number;
  innerW: number;
  midY: number;
  halfH: number;
  totalH: number;
};

export function getSkiaMomentumLayout(width: number): SkiaMomentumLayout {
  const innerW = Math.max(1, width - PAD_X * 2);
  return {
    width,
    innerW,
    midY: PAD_TOP + CHART_H / 2,
    halfH: CHART_H / 2 - 6,
    totalH: PAD_TOP + CHART_H + PAD_BOTTOM,
  };
}

/** Imperative path write for high-frequency lab stress (no React setState). */
export function applySkiaMomentumSeries(
  series: MomentumSeries,
  layout: SkiaMomentumLayout,
  targets: {
    home: SharedValue<SkPath>;
    away: SharedValue<SkPath>;
    stems: SharedValue<SkPath>;
    duration: SharedValue<number>;
  },
): void {
  const { innerW, midY, halfH } = layout;
  targets.home.value = buildSkiaAreaPath(series.home, series.duration, innerW, midY, halfH, false);
  targets.away.value = buildSkiaAreaPath(series.away, series.duration, innerW, midY, halfH, true);
  targets.stems.value = buildStemPath(series.markers, series.duration, innerW, midY, halfH);
  targets.duration.value = series.duration;
}

function markerFill(marker: MomentumMarker): string {
  if (marker.kind === 'goal') {
    if (/own/i.test(marker.detail)) return '#f97316';
    return '#22c55e';
  }
  if (marker.kind === 'card') {
    return /red/i.test(marker.detail) ? '#ef4444' : '#facc15';
  }
  if (marker.kind === 'var') return '#a855f7';
  if (marker.kind === 'corner') return '#f87171';
  return '#3b82f6';
}

function SkiaMarkerGlyph({
  marker,
  cx,
  cy,
}: {
  marker: MomentumMarker;
  cx: number;
  cy: number;
}) {
  const fill = markerFill(marker);
  if (marker.kind === 'card') {
    return <Rect x={cx - 4} y={cy - 6} width={8} height={12} color={fill} />;
  }
  if (marker.kind === 'subst') {
    return (
      <Group>
        <Circle cx={cx - 3} cy={cy} r={3} color="#ef4444" />
        <Circle cx={cx + 3} cy={cy} r={3} color="#22c55e" />
      </Group>
    );
  }
  return <Circle cx={cx} cy={cy} r={5} color={fill} />;
}

function MomentumSkiaChart({
  series,
  width,
  highFreqPaths,
  onRenderPass,
}: {
  series: MomentumSeries;
  width: number;
  highFreqPaths?: MatchMomentumGraphSkiaProps['highFreqPaths'];
  onRenderPass?: () => void;
}) {
  const layout = useMemo(() => getSkiaMomentumLayout(width), [width]);
  const { innerW, midY, halfH, totalH } = layout;

  const homePath = useMemo(
    () => buildSkiaAreaPath(series.home, series.duration, innerW, midY, halfH, false),
    [series.home, series.duration, innerW, midY, halfH],
  );
  const awayPath = useMemo(
    () => buildSkiaAreaPath(series.away, series.duration, innerW, midY, halfH, true),
    [series.away, series.duration, innerW, midY, halfH],
  );
  const stemPath = useMemo(
    () => buildStemPath(series.markers, series.duration, innerW, midY, halfH),
    [series.markers, series.duration, innerW, midY, halfH],
  );

  useEffect(() => {
    onRenderPass?.();
  });

  const gridYs = [midY - halfH * 0.55, midY, midY + halfH * 0.55];
  const labels = [
    { m: series.duration, text: `${series.duration}'` },
    { m: Math.round(series.duration / 2), text: `${Math.round(series.duration / 2)}'` },
    { m: 0, text: "0'" },
  ];

  const drawnHome = highFreqPaths ? highFreqPaths.home : homePath;
  const drawnAway = highFreqPaths ? highFreqPaths.away : awayPath;
  const drawnStems = highFreqPaths ? highFreqPaths.stems : stemPath;

  return (
    <View style={{ width, height: totalH }}>
      <Canvas style={{ width, height: totalH }}>
        <Group>
          {gridYs.map((y, i) => (
            <SkLine
              key={`h-${i}`}
              p1={vec(PAD_X, y)}
              p2={vec(PAD_X + innerW, y)}
              color={GRID}
              strokeWidth={1}
            />
          ))}
          {[0, Math.round(series.duration / 2), series.duration].map((m) => {
            const x = minuteToXRtl(m, series.duration, innerW, PAD_X);
            const mid = m === Math.round(series.duration / 2);
            return (
              <SkLine
                key={`v-${m}`}
                p1={vec(x, PAD_TOP)}
                p2={vec(x, PAD_TOP + CHART_H)}
                color={mid ? AXIS : GRID}
                strokeWidth={mid ? 1.2 : 1}
              />
            );
          })}

          <Path path={drawnAway}>
            <LinearGradient
              start={vec(0, midY)}
              end={vec(0, midY + halfH)}
              colors={['rgba(58,58,66,0.55)', 'rgba(58,58,66,0.95)']}
            />
          </Path>
          <Path path={drawnHome}>
            <LinearGradient
              start={vec(0, midY - halfH)}
              end={vec(0, midY)}
              colors={[`${PURPLE_PRIMARY}F2`, `${PURPLE_DARK}73`]}
            />
          </Path>

          <Path path={drawnStems} style="stroke" strokeWidth={1} color={STEM} />

          {series.markers.map((marker, idx) => {
            const x = minuteToXRtl(marker.minute, series.duration, innerW, PAD_X);
            const cy = marker.side === 'home' ? 14 : PAD_TOP + CHART_H + 12;
            return <SkiaMarkerGlyph key={`mk-${idx}`} marker={marker} cx={x} cy={cy} />;
          })}
        </Group>
      </Canvas>

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
  );
}

function LegendRow({ color, team }: { color: string; team?: TeamLegend }) {
  if (!team?.name) return null;
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <TeamBadge name={team.name} logo={team.logo} size={18} color="transparent" />
      <Text style={styles.legendName} numberOfLines={1}>
        {team.name}
      </Text>
    </View>
  );
}

/**
 * Skia prototype — same props surface as MatchMomentumGraph, no API fetch.
 */
export const MatchMomentumGraphSkia = React.memo(function MatchMomentumGraphSkia(
  props: MatchMomentumGraphSkiaProps,
) {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(screenW - 32, 420);
  const renderCount = useRef(0);

  const localSeries = useMemo(
    () =>
      props.seriesOverride !== undefined
        ? props.seriesOverride
        : buildMomentumFromEvents({
            events: props.events,
            homeTeamId: props.homeTeamId,
            awayTeamId: props.awayTeamId,
            homeGoals: props.homeGoals,
            awayGoals: props.awayGoals,
            matchElapsed: props.matchElapsed,
            finished: props.finished,
          }),
    [
      props.seriesOverride,
      props.events,
      props.homeTeamId,
      props.awayTeamId,
      props.homeGoals,
      props.awayGoals,
      props.matchElapsed,
      props.finished,
    ],
  );

  if (!localSeries) return null;

  return (
    <View style={[styles.card, { width: cardW }]}>
      <MomentumSkiaChart
        series={localSeries}
        width={cardW}
        highFreqPaths={props.highFreqPaths}
        onRenderPass={() => {
          renderCount.current += 1;
          props.onRenderPass?.();
        }}
      />
      {(props.homeTeam || props.awayTeam) && (
        <View style={styles.legend}>
          <LegendRow color={PURPLE_PRIMARY} team={props.homeTeam} />
          <LegendRow color={AWAY_GREY} team={props.awayTeam} />
        </View>
      )}
    </View>
  );
});

/** Shared values for lab high-frequency path updates. */
export function useSkiaMomentumPathTargets() {
  const home = useSharedValue(Skia.Path.Make());
  const away = useSharedValue(Skia.Path.Make());
  const stems = useSharedValue(Skia.Path.Make());
  const duration = useSharedValue(90);
  return useMemo(() => ({ home, away, stems, duration }), [home, away, stems, duration]);
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
