import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

/** FIFA pitch: 105m × 68m. Horizontal = goals left/right; vertical = goals top/bottom. */
const L = 105;
const W = 68;
const PAD_X = 4.5;
const PAD_Y = 2.8;
const VW_H = L + PAD_X * 2;
const VH_H = W + PAD_Y * 2;
/** Vertical viewBox: length along height, width along width. */
const VW_V = W + PAD_Y * 2;
const VH_V = L + PAD_X * 2;

export const FOOTBALL_PITCH_ASPECT = VW_H / VH_H;
/** Portrait lineup pitch (taller than wide). */
export const FOOTBALL_PITCH_ASPECT_VERTICAL = VW_V / VH_V;

export type PitchTheme = 'classic' | 'stadium' | 'lineup';
export type PitchOrientation = 'horizontal' | 'vertical';

const PITCH_THEMES: Record<
  PitchTheme,
  { grassLight: string; grassDark: string; grassBase: string; surround: string; tint: string }
> = {
  classic: {
    grassLight: '#529A62',
    grassDark: '#2E6B42',
    grassBase: '#428F54',
    surround: '#080C10',
    tint: 'transparent',
  },
  stadium: {
    grassLight: '#1E5C42',
    grassDark: '#0E3528',
    grassBase: '#143D2E',
    surround: '#04060A',
    tint: 'rgba(88,28,135,0.12)',
  },
  /** Figma lineup grass (node 550:2474 gradient). */
  lineup: {
    grassLight: '#15560A',
    grassDark: '#0D3611',
    grassBase: '#0E490B',
    surround: '#0A1A0C',
    tint: 'transparent',
  },
};

/** Reference pitch greens — solid hex only (no url() fills; Android-safe). */
const GRASS_LIGHT = PITCH_THEMES.classic.grassLight;
const GRASS_DARK = PITCH_THEMES.classic.grassDark;
export const GRASS_BASE = PITCH_THEMES.classic.grassBase;
export const PITCH_SURROUND = PITCH_THEMES.classic.surround;

export const PITCH_INSET_X_RATIO = PAD_X / VW_H;
export const PITCH_INSET_Y_RATIO = PAD_Y / VH_H;
export const PITCH_GRASS_W_RATIO = L / VW_H;
export const PITCH_GRASS_H_RATIO = W / VH_H;

const PITCH_INSET_X_RATIO_V = PAD_Y / VW_V;
const PITCH_INSET_Y_RATIO_V = PAD_X / VH_V;
const PITCH_GRASS_W_RATIO_V = W / VW_V;
const PITCH_GRASS_H_RATIO_V = L / VH_V;

/**
 * Map grass-relative percents to container coords.
 * Horizontal: xPct = depth, yPct = lateral.
 * Vertical: xPct = lateral, yPct = depth (own goal → opposite along height).
 */
export function pitchPercentToContainer(
  xPct: number,
  yPct: number,
  containerW: number,
  containerH: number,
  orientation: PitchOrientation = 'horizontal',
): { left: number; top: number } {
  if (orientation === 'vertical') {
    return {
      left: (PITCH_INSET_X_RATIO_V + (xPct / 100) * PITCH_GRASS_W_RATIO_V) * containerW,
      top: (PITCH_INSET_Y_RATIO_V + (yPct / 100) * PITCH_GRASS_H_RATIO_V) * containerH,
    };
  }
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

function cxAlongWidth(value: number): number {
  return (W - value) / 2;
}

export interface FootballPitchSvgProps {
  width?: number;
  height?: number;
  style?: ViewStyle;
  lineOpacity?: number;
  variant?: PitchTheme;
  /** `meet` keeps FIFA proportions; `stretch` fills the box (lineup). */
  fit?: 'meet' | 'stretch';
  orientation?: PitchOrientation;
}

function GoalNetHorizontal({
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

function GoalNetVertical({
  side,
  ox,
  oy,
  goalLeft,
  lineColor,
}: {
  side: 'top' | 'bottom';
  ox: number;
  oy: number;
  goalLeft: number;
  lineColor: string;
}) {
  const y0 = side === 'top' ? oy - GOAL_NET_DEPTH : oy + L;
  const y1 = side === 'top' ? oy : oy + L + GOAL_NET_DEPTH;
  const x0 = ox + goalLeft;
  const x1 = ox + goalLeft + GOAL_NET_WIDTH;
  const netLines: React.ReactNode[] = [];
  const stepY = GOAL_NET_DEPTH / 5;
  const stepX = GOAL_NET_WIDTH / 6;

  for (let i = 1; i < 5; i++) {
    const y = side === 'top' ? y0 + i * stepY : y1 - i * stepY;
    netLines.push(
      <Path key={`gh-${side}-${i}`} d={`M ${x0} ${y} L ${x1} ${y}`} stroke="rgba(0,0,0,0.35)" strokeWidth={0.12} />,
    );
  }
  for (let j = 1; j < 6; j++) {
    const x = x0 + j * stepX;
    netLines.push(
      <Path key={`gv-${side}-${j}`} d={`M ${x} ${y0} L ${x} ${y1}`} stroke="rgba(0,0,0,0.35)" strokeWidth={0.12} />,
    );
  }

  return (
    <G stroke={lineColor} strokeWidth={LINE * 1.1} fill="rgba(0,0,0,0.55)">
      <Rect x={x0} y={y0} width={GOAL_NET_WIDTH} height={GOAL_NET_DEPTH} rx={0.15} />
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
function GrassLightingHorizontal({ ox, oy, cx, cyMid }: { ox: number; oy: number; cx: number; cyMid: number }) {
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

function GrassLightingVertical({ ox, oy, cxMid, cy }: { ox: number; oy: number; cxMid: number; cy: number }) {
  return (
    <G>
      <Circle cx={cxMid} cy={cy} r={L * 0.42} fill="rgba(255,255,255,0.07)" />
      <Circle cx={cxMid} cy={cy} r={L * 0.28} fill="rgba(255,255,255,0.05)" />
      <Rect x={ox} y={oy} width={W * 0.14} height={L} fill="rgba(0,0,0,0.16)" />
      <Rect x={ox + W * 0.86} y={oy} width={W * 0.14} height={L} fill="rgba(0,0,0,0.16)" />
      <Rect x={ox} y={oy} width={W} height={L * 0.1} fill="rgba(0,0,0,0.12)" />
      <Rect x={ox} y={oy + L * 0.9} width={W} height={L * 0.1} fill="rgba(0,0,0,0.12)" />
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
  variant = 'classic',
  fit = 'meet',
  orientation = 'horizontal',
}: FootballPitchSvgProps) {
  const theme = PITCH_THEMES[variant];
  const grassLight = theme.grassLight;
  const grassDark = theme.grassDark;
  const grassBase = theme.grassBase;
  const pitchSurround = theme.surround;
  const vertical = orientation === 'vertical';
  const aspect = vertical ? FOOTBALL_PITCH_ASPECT_VERTICAL : FOOTBALL_PITCH_ASPECT;
  const vbW = vertical ? VW_V : VW_H;
  const vbH = vertical ? VH_V : VH_H;

  const layout = useMemo(() => {
    if (width && height) return { w: width, h: height };
    if (width) return { w: width, h: width / aspect };
    if (height) return { w: height * aspect, h: height };
    return { w: vbW, h: vbH };
  }, [width, height, aspect, vbW, vbH]);

  const lineColor = `rgba(255,255,255,${lineOpacity})`;
  const lineGlow = `rgba(255,255,255,${lineOpacity * 0.22})`;
  const preserveAspectRatio = fit === 'stretch' ? 'none' : 'xMidYMid meet';

  const oxH = PAD_X;
  const oyH = PAD_Y;
  const textureLines = useMemo(() => {
    if (vertical) return null;
    const lines: React.ReactNode[] = [];
    const step = 1.35;
    for (let y = oyH + step; y < oyH + W; y += step) {
      lines.push(
        <Path
          key={`tex-${y}`}
          d={`M ${oxH} ${y} L ${oxH + L} ${y}`}
          stroke="rgba(0,0,0,0.04)"
          strokeWidth={0.16}
        />,
      );
    }
    return lines;
  }, [vertical, oxH, oyH]);

  if (vertical) {
    const ox = PAD_Y;
    const oy = PAD_X;
    const penLeft = cxAlongWidth(PEN_WIDTH);
    const goalAreaLeft = cxAlongWidth(GOAL_AREA_WIDTH);
    const goalNetLeft = cxAlongWidth(GOAL_NET_WIDTH);
    const stripeH = L / STRIPE_COUNT;
    const cxMid = ox + W / 2;
    const cy = oy + L / 2;

    return (
      <View style={[styles.wrap, style, { width: layout.w, height: layout.h, backgroundColor: grassBase }]}>
        <Svg
          width={layout.w}
          height={layout.h}
          viewBox={`0 0 ${VW_V} ${VH_V}`}
          preserveAspectRatio={preserveAspectRatio}
        >
          <Rect x={0} y={0} width={VW_V} height={VH_V} fill={pitchSurround} rx={1.4} ry={1.4} />
          <Rect x={ox} y={oy} width={W} height={L} fill={grassBase} rx={1.1} ry={1.1} />

          {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
            <Rect
              key={`stripe-v-${i}`}
              x={ox}
              y={oy + i * stripeH}
              width={W}
              height={stripeH + 0.02}
              fill={i % 2 === 0 ? grassLight : grassDark}
            />
          ))}

          {theme.tint !== 'transparent' ? (
            <Rect x={ox} y={oy} width={W} height={L} fill={theme.tint} rx={1.1} ry={1.1} />
          ) : null}

          <GrassLightingVertical ox={ox} oy={oy} cxMid={cxMid} cy={cy} />

          <GoalNetVertical side="top" ox={ox} oy={oy} goalLeft={goalNetLeft} lineColor={lineColor} />
          <GoalNetVertical side="bottom" ox={ox} oy={oy} goalLeft={goalNetLeft} lineColor={lineColor} />

          <G stroke={lineGlow} strokeWidth={LINE * 2.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <Rect x={ox + LINE / 2} y={oy + LINE / 2} width={W - LINE} height={L - LINE} rx={1} ry={1} />
            <Path d={`M ${ox + LINE / 2} ${cy} L ${ox + W - LINE / 2} ${cy}`} />
            <Circle cx={cxMid} cy={cy} r={CENTER_R} />
            <Rect x={ox + penLeft} y={oy} width={PEN_WIDTH} height={PEN_DEPTH} />
            <Rect x={ox + goalAreaLeft} y={oy} width={GOAL_AREA_WIDTH} height={GOAL_AREA_DEPTH} />
            <Rect x={ox + penLeft} y={oy + L - PEN_DEPTH} width={PEN_WIDTH} height={PEN_DEPTH} />
            <Rect x={ox + goalAreaLeft} y={oy + L - GOAL_AREA_DEPTH} width={GOAL_AREA_WIDTH} height={GOAL_AREA_DEPTH} />
          </G>

          <G stroke={lineColor} strokeWidth={LINE} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <Rect x={ox + LINE / 2} y={oy + LINE / 2} width={W - LINE} height={L - LINE} rx={1} ry={1} />
            <Path d={`M ${ox + LINE / 2} ${cy} L ${ox + W - LINE / 2} ${cy}`} />
            <Circle cx={cxMid} cy={cy} r={CENTER_R} />
            <Circle cx={cxMid} cy={cy} r={0.55} fill={lineColor} stroke="none" />

            <Rect x={ox + penLeft} y={oy} width={PEN_WIDTH} height={PEN_DEPTH} />
            <Rect x={ox + goalAreaLeft} y={oy} width={GOAL_AREA_WIDTH} height={GOAL_AREA_DEPTH} />
            <Circle cx={cxMid} cy={oy + PEN_SPOT} r={1.1} fill="rgba(255,255,255,0.18)" stroke="none" />
            <Circle cx={cxMid} cy={oy + PEN_SPOT} r={0.48} fill={lineColor} stroke="none" />
            <Path d={`M ${cxMid - 9.15} ${oy + PEN_DEPTH} A 9.15 9.15 0 0 0 ${cxMid + 9.15} ${oy + PEN_DEPTH}`} />

            <Rect x={ox + penLeft} y={oy + L - PEN_DEPTH} width={PEN_WIDTH} height={PEN_DEPTH} />
            <Rect x={ox + goalAreaLeft} y={oy + L - GOAL_AREA_DEPTH} width={GOAL_AREA_WIDTH} height={GOAL_AREA_DEPTH} />
            <Circle cx={cxMid} cy={oy + L - PEN_SPOT} r={1.1} fill="rgba(255,255,255,0.18)" stroke="none" />
            <Circle cx={cxMid} cy={oy + L - PEN_SPOT} r={0.48} fill={lineColor} stroke="none" />
            <Path d={`M ${cxMid - 9.15} ${oy + L - PEN_DEPTH} A 9.15 9.15 0 0 1 ${cxMid + 9.15} ${oy + L - PEN_DEPTH}`} />

            <Path d={`M ${ox} ${oy + CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 1 ${ox + CORNER_R} ${oy}`} />
            <Path d={`M ${ox + W - CORNER_R} ${oy} A ${CORNER_R} ${CORNER_R} 0 0 1 ${ox + W} ${oy + CORNER_R}`} />
            <Path d={`M ${ox} ${oy + L - CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 0 ${ox + CORNER_R} ${oy + L}`} />
            <Path d={`M ${ox + W - CORNER_R} ${oy + L} A ${CORNER_R} ${CORNER_R} 0 0 0 ${ox + W} ${oy + L - CORNER_R}`} />

            <Path d={`M ${cxMid - 3.66} ${oy} L ${cxMid + 3.66} ${oy}`} strokeWidth={LINE * 2.2} />
            <Path d={`M ${cxMid - 3.66} ${oy + L} L ${cxMid + 3.66} ${oy + L}`} strokeWidth={LINE * 2.2} />
          </G>

          <CornerFlag x={ox} y={oy} dir="tl" />
          <CornerFlag x={ox + W} y={oy} dir="tr" />
          <CornerFlag x={ox} y={oy + L} dir="bl" />
          <CornerFlag x={ox + W} y={oy + L} dir="br" />
        </Svg>
      </View>
    );
  }

  const ox = oxH;
  const oy = oyH;
  const penTop = cy(PEN_WIDTH);
  const goalAreaTop = cy(GOAL_AREA_WIDTH);
  const goalNetTop = cy(GOAL_NET_WIDTH);
  const stripeW = L / STRIPE_COUNT;
  const cx = ox + L / 2;
  const cyMid = oy + W / 2;

  return (
    <View style={[styles.wrap, style, { width: layout.w, height: layout.h, backgroundColor: grassBase }]}>
      <Svg
        width={layout.w}
        height={layout.h}
        viewBox={`0 0 ${VW_H} ${VH_H}`}
        preserveAspectRatio={preserveAspectRatio}
      >
        <Rect x={0} y={0} width={VW_H} height={VH_H} fill={pitchSurround} rx={1.4} ry={1.4} />

        <Rect x={ox} y={oy} width={L} height={W} fill={grassBase} rx={1.1} ry={1.1} />

        {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
          <Rect
            key={`stripe-${i}`}
            x={ox + i * stripeW}
            y={oy}
            width={stripeW + 0.02}
            height={W}
            fill={i % 2 === 0 ? grassLight : grassDark}
          />
        ))}

        {theme.tint !== 'transparent' ? (
          <Rect x={ox} y={oy} width={L} height={W} fill={theme.tint} rx={1.1} ry={1.1} />
        ) : null}

        {textureLines}
        <GrassLightingHorizontal ox={ox} oy={oy} cx={cx} cyMid={cyMid} />

        <GoalNetHorizontal side="left" ox={ox} oy={oy} goalTop={goalNetTop} lineColor={lineColor} />
        <GoalNetHorizontal side="right" ox={ox} oy={oy} goalTop={goalNetTop} lineColor={lineColor} />

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
