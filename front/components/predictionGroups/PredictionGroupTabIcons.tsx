/**
 * Custom tab icons for the prediction-groups liquid glass nav bar.
 */

import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { memo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

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

/** Matchday round / predictions — bold soccer ball, readable at small sizes. */
export const RoundsTabIcon = memo(function RoundsTabIcon({
  color = '#FFFFFF',
  size = 26,
}: IconProps) {
  return <MaterialCommunityIcons name="soccer" size={size} color={color} />;
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
