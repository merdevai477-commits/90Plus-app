import React, { useEffect, useId, useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from './MatchText';
import Svg, { Defs, LinearGradient, Path, Stop, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { FixtureEvent } from '../../services/apiFootball';
import ApiFootballService from '../../services/apiFootball';
import {
  buildMomentumFromEvents,
  minuteToXRtl,
  momentumSeriesFromPayload,
  type MomentumMarker,
  type MomentumSeries,
} from '../../utils/matchMomentum';
import { MatchEventIcon } from './MatchEventIcon';
import TeamBadge from '../common/TeamBadge';
import {
  PURPLE_PRIMARY,
  PURPLE_DARK,
  RADIUS_LG,
} from '../../constants/tokens';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

type TeamLegend = {
  name: string;
  logo?: string;
};

type Props = {
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
};

const AWAY_GREY_DARK = '#3A3A42';
const AWAY_GREY_LIGHT = '#6B6B73';
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

/** Smooth filled area without d3 — Metro cannot resolve ESM-only d3-shape. */
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

function MomentumChart({
  series,
  width,
  uid,
  isDark,
  axisColor,
  gridColor,
  axisMidColor,
  stemColor,
  awayFill,
}: {
  series: MomentumSeries;
  width: number;
  uid: string;
  isDark: boolean;
  axisColor: string;
  gridColor: string;
  axisMidColor: string;
  stemColor: string;
  awayFill: string;
}) {
  const innerW = Math.max(1, width - PAD_X * 2);
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
    <View style={{ width, height: totalH }}>
      <Svg width={width} height={totalH}>
        <Defs>
          <LinearGradient id={homeGrad} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={isDark ? PURPLE_PRIMARY : '#A78BFA'} stopOpacity={isDark ? 0.95 : 0.9} />
            <Stop offset="1" stopColor={isDark ? PURPLE_DARK : '#6A2BD9'} stopOpacity={isDark ? 0.45 : 0.95} />
          </LinearGradient>
          <LinearGradient id={awayGrad} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={awayFill} stopOpacity={isDark ? 0.55 : 0.7} />
            <Stop offset="1" stopColor={awayFill} stopOpacity={isDark ? 0.95 : 0.95} />
          </LinearGradient>
        </Defs>

        {gridYs.map((y, i) => (
          <Line
            key={`h-${i}`}
            x1={PAD_X}
            y1={y}
            x2={PAD_X + innerW}
            y2={y}
            stroke={gridColor}
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
              stroke={m === Math.round(series.duration / 2) ? axisMidColor : gridColor}
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
              stroke={stemColor}
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
              { left: minuteToXRtl(l.m, series.duration, innerW, PAD_X) - 14, width: 28, color: axisColor },
            ]}
          >
            {l.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

function LegendRow({
  color,
  team,
  labelColor,
}: {
  color: string;
  team?: TeamLegend;
  labelColor: string;
}) {
  if (!team?.name) return null;
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <TeamBadge name={team.name} logo={team.logo} size={18} color="transparent" />
      <Text style={[styles.legendName, { color: labelColor }]} numberOfLines={1}>
        {team.name}
      </Text>
    </View>
  );
}

/**
 * Figma-style match rhythm card. Returns null when event coverage is incomplete.
 */
export function MatchMomentumGraph(props: Props) {
  const { width: screenW } = useWindowDimensions();
  const { colors, isDark } = useMatchDetailsTheme();
  const cardW = Math.min(Math.max(0, screenW - 56), 400);
  const uid = useId().replace(/:/g, '');
  const [remote, setRemote] = useState<MomentumSeries | null | undefined>(undefined);
  const awayFill = isDark ? AWAY_GREY_DARK : AWAY_GREY_LIGHT;
  const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(106,43,217,0.16)';
  const axisMidColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(106,43,217,0.45)';
  const stemColor = isDark ? 'rgba(233,213,255,0.55)' : 'rgba(106,43,217,0.45)';

  const localSeries = useMemo(
    () =>
      buildMomentumFromEvents({
        events: props.events,
        homeTeamId: props.homeTeamId,
        awayTeamId: props.awayTeamId,
        homeGoals: props.homeGoals,
        awayGoals: props.awayGoals,
        matchElapsed: props.matchElapsed,
        finished: props.finished,
      }),
    [
      props.events,
      props.homeTeamId,
      props.awayTeamId,
      props.homeGoals,
      props.awayGoals,
      props.matchElapsed,
      props.finished,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    const id = props.fixtureId;
    if (id == null) {
      setRemote(undefined);
      return;
    }
    setRemote(undefined);
    ApiFootballService.getFixtureMomentum(id)
      .then((payload) => {
        if (cancelled) return;
        if (payload == null) {
          setRemote(undefined);
          return;
        }
        setRemote(momentumSeriesFromPayload(payload));
      })
      .catch(() => {
        if (!cancelled) setRemote(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [props.fixtureId, props.events.length, props.finished]);

  // Prefer API series when loaded; if API marks unavailable (null), fall back to local build.
  const series = remote === undefined ? localSeries : remote ?? localSeries;
  if (!series) return null;

  return (
    <View
      style={[
        styles.card,
        {
          width: cardW,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardBg,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.cardBorder,
          shadowOpacity: isDark ? 0 : 0.18,
          elevation: isDark ? 0 : 3,
        },
      ]}
    >
      <MomentumChart
        series={series}
        width={cardW}
        uid={uid}
        isDark={isDark}
        axisColor={colors.textPrimary}
        gridColor={gridColor}
        axisMidColor={axisMidColor}
        stemColor={stemColor}
        awayFill={awayFill}
      />
      {(props.homeTeam || props.awayTeam) && (
        <View style={styles.legend}>
          <LegendRow color={PURPLE_PRIMARY} team={props.homeTeam} labelColor={colors.textSecondary} />
          <LegendRow color={awayFill} team={props.awayTeam} labelColor={colors.textSecondary} />
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
    shadowColor: '#4B1FA3',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
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
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
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
    fontSize: 11,
    fontWeight: '600',
  },
});
