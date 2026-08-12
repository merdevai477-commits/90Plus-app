/**
 * =============================================================================
 * QUESTIONS HUB — STATS STRIP CONTENTS
 * =============================================================================
 *
 * Renders, left to right:
 *   [level hexagon] │ XP │ Answered │ Total XP  [star hexagon]
 *
 * Figma "Frame 29" children in node 1:2 — both hexagons are 49 × 49, the
 * hairline dividers are 29 tall.
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   STAR HEXAGON COLOURS ..... POLYGON_STROKE_STOPS / STAR_FILL below
 *   HEXAGON SIZE ............. ../styles.ts → hub.footerIconBadge (49×49)
 *   STAR GLYPH SIZE .......... ../styles.ts → hub.footerIconStar (20×19)
 *   DIVIDER SIZE / COLOUR .... ../styles.ts → hub.divider
 *   LEVEL BADGE .............. ./QuizLevelBadge.tsx
 *   INDIVIDUAL STAT STYLING .. ./StatItem.tsx
 * =============================================================================
 */

import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import type { Stat } from '../data';
import { useQuestionsHubStyles } from '../styles';
import StatItem from './StatItem';
import QuizLevelBadge from './QuizLevelBadge';

/** Gradient stops for the star hexagon's stroke. */
const POLYGON_STROKE_STOPS = [
  { offset: 0, color: '#460BCB' },
  { offset: 0.345447, color: '#BFABED' },
  { offset: 1, color: '#460BCB' },
] as const;

/** Hexagon interior + star glyph colours. */
const POLYGON_FILL = '#0A0213';
const STAR_FILL = '#8351F5';

function BottomNavigation({
  level,
  stats,
  isCompact,
}: {
  level: number;
  stats: Stat[];
  isCompact: boolean;
}) {
  const { hub } = useQuestionsHubStyles();

  const statNodes: React.ReactNode[] = [];
  for (let index = 0; index < stats.length; index += 1) {
    const stat = stats[index];
    statNodes.push(
      <React.Fragment key={stat.id}>
        <StatItem stat={stat} isCompact={isCompact} />
        {index < stats.length - 1 ? <View style={hub.divider} /> : null}
      </React.Fragment>,
    );
  }

  return (
    <>
      {/* Leading: level hexagon */}
      <View style={hub.levelSection}>
        <QuizLevelBadge level={level} isCompact={isCompact} />
      </View>

      <View style={hub.divider} />

      {/* Middle: XP / Answered / Total XP */}
      {statNodes}

      {/* Trailing: star hexagon */}
      <View style={hub.levelSection}>
        <View style={hub.footerIconBadge}>
          <Svg viewBox="0 0 43 48" style={hub.footerIconPolygon}>
            <Defs>
              <SvgLinearGradient
                id="footerPolygonStroke"
                x1="6.51762"
                y1="-0.618805"
                x2="21.2176"
                y2="48.3812"
                gradientUnits="userSpaceOnUse"
              >
                {POLYGON_STROKE_STOPS.map((stop) => (
                  <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
                ))}
              </SvgLinearGradient>
            </Defs>
            <Path
              d="M19.7176 1.4017C20.6458 0.865877 21.7895 0.865877 22.7176 1.4017L39.9354 11.3421C40.8636 11.878 41.4354 12.869 41.4354 13.9408V33.8216C41.4354 34.8934 40.8636 35.8844 39.9354 36.4203L22.7176 46.3607C21.7895 46.8965 20.6458 46.8965 19.7176 46.3607L2.49985 36.4203C1.57165 35.8844 0.999847 34.8934 0.999847 33.8216V13.9408C0.999847 12.869 1.57164 11.878 2.49985 11.3421L19.7176 1.4017Z"
              fill={POLYGON_FILL}
              stroke="url(#footerPolygonStroke)"
              strokeWidth={2}
            />
          </Svg>

          <Svg viewBox="0 0 20 19" style={hub.footerIconStar}>
            <Path
              d="M8.86138 0.690996C9.16074 -0.230315 10.4641 -0.230313 10.7635 0.690998L12.3944 5.71025C12.5282 6.12227 12.9122 6.40123 13.3454 6.40123H18.623C19.5917 6.40123 19.9945 7.64085 19.2107 8.21025L14.9411 11.3123C14.5906 11.567 14.444 12.0183 14.5778 12.4304L16.2087 17.4496C16.5081 18.3709 15.4536 19.137 14.6699 18.5676L10.4002 15.4656C10.0497 15.2109 9.57514 15.2109 9.22465 15.4656L4.95502 18.5676C4.17131 19.137 3.11683 18.3709 3.41618 17.4496L5.04703 12.4304C5.18091 12.0183 5.03425 11.567 4.68376 11.3123L0.414129 8.21025C-0.369584 7.64085 0.0331929 6.40123 1.00192 6.40123H6.27947C6.7127 6.40123 7.09665 6.12227 7.23053 5.71025L8.86138 0.690996Z"
              fill={STAR_FILL}
            />
          </Svg>
        </View>
      </View>
    </>
  );
}

export default memo(BottomNavigation);
