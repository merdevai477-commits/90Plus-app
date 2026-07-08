/**
 * Custom tab icons for the prediction-groups liquid glass nav bar.
 */

import { FontAwesome } from '@expo/vector-icons';
import React, { memo } from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

type IconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

export const GroupTabIcon = memo(function GroupTabIcon({
  color = '#FFFFFF',
  size = 22,
}: IconProps) {
  return <FontAwesome name="group" size={size} color={color} />;
});

/** Four players meeting — rounds / collaboration tab. */
export const RoundsTabIcon = memo(function RoundsTabIcon({
  color = '#FFFFFF',
  size = 22,
}: IconProps) {
  // Full 24×24 viewBox so the glyph isn't cropped (old viewBox clipped heads/bodies).
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="5.5" cy="9" r="2.2" fill={color} />
      <Path
        d="M2.8 15.2c0-1.5 1.2-2.7 2.7-2.7h0"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="9.2" cy="9" r="2.2" fill={color} />
      <Path
        d="M6.4 15.2c0-1.5 1.2-2.7 2.8-2.7"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />

      <Circle cx="14.8" cy="9" r="2.2" fill={color} />
      <Path
        d="M12 15.2c0-1.5 1.2-2.7 2.8-2.7"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="18.5" cy="9" r="2.2" fill={color} />
      <Path
        d="M15.8 15.2c0-1.5 1.2-2.7 2.7-2.7h0"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />

      <Line x1="10.6" y1="14.6" x2="13.4" y2="14.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1="12" y1="4.2" x2="12" y2="7" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1="10" y1="5.2" x2="11.2" y2="7" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1="14" y1="5.2" x2="12.8" y2="7" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
});

/** Podium with star — group rank tab. */
export const RankPodiumTabIcon = memo(function RankPodiumTabIcon({
  color = '#FFFFFF',
  size = 22,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3.5" y="15" width="5" height="5.5" rx="1" fill={color} />
      <Rect x="9.5" y="9" width="5" height="11.5" rx="1" fill={color} />
      <Rect x="15.5" y="12" width="5" height="8.5" rx="1" fill={color} />
      <Path
        d="M12 3.2l1.05 2.15 2.35.35-1.7 1.62.4 2.33L12 8.55 9.9 9.65l.4-2.33-1.7-1.62 2.35-.35L12 3.2z"
        fill={color}
      />
    </Svg>
  );
});
