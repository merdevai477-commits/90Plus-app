import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

/** FIFA pitch: 105m × 68m, horizontal. */
const L = 105;
const W = 68;
const PAD_X = 4.5;
const PAD_Y = 2.8;
const VW = L + PAD_X * 2;
const VH = W + PAD_Y * 2;
export const FOOTBALL_PITCH_ASPECT = VW / VH;

/** Reference pitch greens — solid hex only (no url() fills; Android-safe). */
const GRASS_LIGHT = '#529A62';
const GRASS_DARK = '#2E6B42';
export const GRASS_BASE = '#428F54';
export const PITCH_SURROUND = '#080C10';

export const PITCH_INSET_X_RATIO = PAD_X / VW;
export const PITCH_INSET_Y_RATIO = PAD_Y / VH;
export const PITCH_GRASS_W_RATIO = L / VW;
export const PITCH_GRASS_H_RATIO = W / VH;

export function pitchPercentToContainer(
  xPct: number,
  yPct: number,
  containerW: number,
  containerH: number,
): { left: number; top: number } {
  return {
    left: (PITCH_INSET_X_RATIO + (xPct / 100) * PITCH_GRASS_W_RATIO) * containerW,
    top: (PITCH_INSET_Y_RATIO + (yPct / 100) * PITCH_GRASS_H_RATIO) * containerH,
  };
}

const PEN_DEPTH = 16.5;
const PEN_WIDTH = 40.32;
const GOAL_AREA_DEPTH = 5.5;
const GOAL_AREA_WIDTH = 18.32;
const GOAL_NET_DEPTH = 2.44;
const GOAL_NET_WIDTH = 7.32;
const CENTER_R = 9.15;
const PEN_SPOT = 11;
const CORNER_R = 1;
const LINE = 0.42;
const STRIPE_COUNT = 18;
const FLAG = 1.35;

function cy(value: number): number {
  return (W - value) / 2;
}

export interface FootballPitchSvgProps {
  width?: number;
  height?: number;
  style?: ViewStyle;
  lineOpacity?: number;
}

function GoalNet({
  side,
  ox,
  oy,
  goalTop,
  lineColor,
}: {
  side: 'left' | 'right';
  ox: number;
  oy: number;
  goalTop: number;
  lineColor: string;
}) {
  const x0 = side === 'left' ? ox - GOAL_NET_DEPTH : ox + L;
  const x1 = side === 'left' ? ox : ox + L + GOAL_NET_DEPTH;
  const y0 = oy + goalTop;
  const y1 = oy + goalTop + GOAL_NET_WIDTH;
  const netLines: React.ReactNode[] = [];
  const stepX = GOAL_NET_DEPTH / 5;
  const stepY = GOAL_NET_WIDTH / 6;

  for (let i = 1; i < 5; i++) {
    const x = side === 'left' ? x0 + i * stepX : x1 - i * stepX;
    netLines.push(
      <Path key={`gv-${side}-${i}`} d={`M ${x} ${y0} L ${x} ${y1}`} stroke="rgba(0,0,0,0.35)" strokeWidth={0.12} />,
    );
  }
  for (let j = 1; j < 6; j++) {
    const y = y0 + j * stepY;
    netLines.push(
      <Path key={`gh-${side}-${j}`} d={`M ${x0} ${y} L ${x1} ${y}`} stroke="rgba(0,0,0,0.35)" strokeWidth={0.12} />,
    );
  }

  return (
    <G stroke={lineColor} strokeWidth={LINE * 1.1} fill="rgba(0,0,0,0.55)">
      <Rect x={x0} y={y0} width={GOAL_NET_DEPTH} height={GOAL_NET_WIDTH} rx={0.15} />
      {netLines}
    </G>
  );
}

function CornerFlag({ x, y, dir }: { x: number; y: number; dir: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s = FLAG;
  const paths: Record<string, string> = {
    tl: `M ${x} ${y} L ${x - s} ${y - s * 0.35} L ${x} ${y - s * 0.65} Z`,
    tr: `M ${x} ${y} L ${x + s} ${y - s * 0.35} L ${x} ${y - s * 0.65} Z`,
    bl: `M ${x} ${y} L ${x - s} ${y + s * 0.35} L ${x} ${y + s * 0.65} Z`,
    br: `M ${x} ${y} L ${x + s} ${y + s * 0.35} L ${x} ${y + s * 0.65} Z`,
  };
  return (
    <G>
      <Path d={`M ${x} ${y} L ${x} ${y + (dir.startsWith('b') ? s * 0.9 : -s * 0.9)}`} stroke="#DDD" strokeWidth={0.14} />
      <Path d={paths[dir]} fill="#E53935" stroke="#B71C1C" strokeWidth={0.08} />
    </G>
  );
}

/** Spotlight + edge darkening without gradient url() — works on Android. */
function GrassLighting({ ox, oy, cx, cyMid }: { ox: number; oy: number; cx: number; cyMid: number }) {
  return (
    <G>
      <Circle cx={cx} cy={cyMid} r={L * 0.42} fill="rgba(255,255,255,0.07)" />
      <Circle cx={cx} cy={cyMid} r={L * 0.28} fill="rgba(255,255,255,0.05)" />
      <Rect x={ox} y={oy} width={L} height={W * 0.14} fill="rgba(0,0,0,0.16)" />
      <Rect x={ox} y={oy + W * 0.86} width={L} height={W * 0.14} fill="rgba(0,0,0,0.16)" />
      <Rect x={ox} y={oy} width={L * 0.1} height={W} fill="rgba(0,0,0,0.12)" />
      <Rect x={ox + L * 0.9} y={oy} width={L * 0.1} height={W} fill="rgba(0,0,0,0.12)" />
    </G>
  );
}

/**
 * Broadcast-style vector pitch — 100% solid fills (no Pattern, no url()).
 */
export function FootballPitchSvg({
  width,
  height,
  style,
  lineOpacity = 0.92,
}: FootballPitchSvgProps) {
  const layout = useMemo(() => {
    if (width && height) return { w: width, h: height };
    if (width) return { w: width, h: width / FOOTBALL_PITCH_ASPECT };
    if (height) return { w: height * FOOTBALL_PITCH_ASPECT, h: height };
    return { w: VW, h: VH };
  }, [width, height]);

  const ox = PAD_X;
  const oy = PAD_Y;
  const penTop = cy(PEN_WIDTH);
  const goalAreaTop = cy(GOAL_AREA_WIDTH);
  const goalNetTop = cy(GOAL_NET_WIDTH);
  const lineColor = `rgba(255,255,255,${lineOpacity})`;
  const lineGlow = `rgba(255,255,255,${lineOpacity * 0.22})`;
  const stripeW = L / STRIPE_COUNT;
  const cx = ox + L / 2;
  const cyMid = oy + W / 2;

  const textureLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const step = 1.35;
    for (let y = oy + step; y < oy + W; y += step) {
      lines.push(
        <Path
          key={`tex-${y}`}
          d={`M ${ox} ${y} L ${ox + L} ${y}`}
          stroke="rgba(0,0,0,0.04)"
          strokeWidth={0.16}
        />,
      );
    }
    return lines;
  }, [ox, oy]);

  return (
    <View style={[styles.wrap, style, { width: layout.w, height: layout.h }]}>
      <Svg
        width={layout.w}
        height={layout.h}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <Rect x={0} y={0} width={VW} height={VH} fill={PITCH_SURROUND} rx={1.4} ry={1.4} />

        <Rect x={ox} y={oy} width={L} height={W} fill={GRASS_BASE} rx={1.1} ry={1.1} />

        {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
          <Rect
            key={`stripe-${i}`}
            x={ox + i * stripeW}
            y={oy}
            width={stripeW + 0.02}
            height={W}
            fill={i % 2 === 0 ? GRASS_LIGHT : GRASS_DARK}
          />
        ))}

        {textureLines}
        <GrassLighting ox={ox} oy={oy} cx={cx} cyMid={cyMid} />

        <GoalNet side="left" ox={ox} oy={oy} goalTop={goalNetTop} lineColor={lineColor} />
        <GoalNet side="right" ox={ox} oy={oy} goalTop={goalNetTop} lineColor={lineColor} />

        <G stroke={lineGlow} strokeWidth={LINE * 2.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Rect x={ox + LINE / 2} y={oy + LINE / 2} width={L - LINE} height={W - LINE} rx={1} ry={1} />
          <Path d={`M ${cx} ${oy + LINE / 2} L ${cx} ${oy + W - LINE / 2}`} />
          <Circle cx={cx} cy={cyMid} r={CENTER_R} />
          <Rect x={ox} y={oy + penTop} width={PEN_DEPTH} height={PEN_WIDTH} />
          <Rect x={ox} y={oy + goalAreaTop} width={GOAL_AREA_DEPTH} height={GOAL_AREA_WIDTH} />
          <Rect x={ox + L - PEN_DEPTH} y={oy + penTop} width={PEN_DEPTH} height={PEN_WIDTH} />
          <Rect x={ox + L - GOAL_AREA_DEPTH} y={oy + goalAreaTop} width={GOAL_AREA_DEPTH} height={GOAL_AREA_WIDTH} />
        </G>

        <G stroke={lineColor} strokeWidth={LINE} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Rect x={ox + LINE / 2} y={oy + LINE / 2} width={L - LINE} height={W - LINE} rx={1} ry={1} />
          <Path d={`M ${cx} ${oy + LINE / 2} L ${cx} ${oy + W - LINE / 2}`} />
          <Circle cx={cx} cy={cyMid} r={CENTER_R} />
          <Circle cx={cx} cy={cyMid} r={0.55} fill={lineColor} stroke="none" />

          <Rect x={ox} y={oy + penTop} width={PEN_DEPTH} height={PEN_WIDTH} />
          <Rect x={ox} y={oy + goalAreaTop} width={GOAL_AREA_DEPTH} height={GOAL_AREA_WIDTH} />
          <Circle cx={ox + PEN_SPOT} cy={cyMid} r={1.1} fill="rgba(255,255,255,0.18)" stroke="none" />
          <Circle cx={ox + PEN_SPOT} cy={cyMid} r={0.48} fill={lineColor} stroke="none" />
          <Path d={`M ${ox + PEN_DEPTH} ${cyMid - 9.15} A 9.15 9.15 0 0 1 ${ox + PEN_DEPTH} ${cyMid + 9.15}`} />

          <Rect x={ox + L - PEN_DEPTH} y={oy + penTop} width={PEN_DEPTH} height={PEN_WIDTH} />
          <Rect x={ox + L - GOAL_AREA_DEPTH} y={oy + goalAreaTop} width={GOAL_AREA_DEPTH} height={GOAL_AREA_WIDTH} />
          <Circle cx={ox + L - PEN_SPOT} cy={cyMid} r={1.1} fill="rgba(255,255,255,0.18)" stroke="none" />
          <Circle cx={ox + L - PEN_SPOT} cy={cyMid} r={0.48} fill={lineColor} stroke="none" />
          <Path d={`M ${ox + L - PEN_DEPTH} ${cyMid - 9.15} A 9.15 9.15 0 0 0 ${ox + L - PEN_DEPTH} ${cyMid + 9.15}`} />

          <Path d={`M ${ox} ${oy + CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 0 ${ox + CORNER_R} ${oy}`} />
          <Path d={`M ${ox + L - CORNER_R} ${oy} A ${CORNER_R} ${CORNER_R} 0 0 0 ${ox + L} ${oy + CORNER_R}`} />
          <Path d={`M ${ox} ${oy + W - CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 1 ${ox + CORNER_R} ${oy + W}`} />
          <Path d={`M ${ox + L - CORNER_R} ${oy + W} A ${CORNER_R} ${CORNER_R} 0 0 1 ${ox + L} ${oy + W - CORNER_R}`} />

          <Path d={`M ${ox} ${cyMid - 3.66} L ${ox} ${cyMid + 3.66}`} strokeWidth={LINE * 2.2} />
          <Path d={`M ${ox + L} ${cyMid - 3.66} L ${ox + L} ${cyMid + 3.66}`} strokeWidth={LINE * 2.2} />
        </G>

        <CornerFlag x={ox} y={oy} dir="tl" />
        <CornerFlag x={ox + L} y={oy} dir="tr" />
        <CornerFlag x={ox} y={oy + W} dir="bl" />
        <CornerFlag x={ox + L} y={oy + W} dir="br" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: GRASS_BASE,
  },
});
