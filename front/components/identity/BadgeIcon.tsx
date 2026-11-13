import React from 'react';
import Svg, { Polygon, Path, Circle } from 'react-native-svg';

export type BadgeIconVariant = 'inline' | 'profile' | 'card' | 'leaderboard' | 'detail';

const SIZE: Record<BadgeIconVariant, number> = {
  inline: 16,
  comment: 14,
  profile: 28,
  card: 36,
  leaderboard: 18,
  detail: 72,
} as unknown as Record<BadgeIconVariant, number>;

function glyph(key: string, color: string) {
  switch (key) {
    case 'king_game':
    case 'ranking_champion':
      return <Path d="M8 18 L10 10 L14 14 L18 8 L22 14 L26 10 L28 18 Z" fill={color} />;
    case 'king_results':
    case 'prediction_accuracy':
      return <Path d="M9 22 V16 H13 V22 Z M15 22 V10 H19 V22 Z M21 22 V13 H25 V22 Z" fill={color} />;
    case 'shares':
      return <Path d="M22 8 a3 3 0 1 1 .1 0 M10 16 a3 3 0 1 1 .1 0 M22 24 a3 3 0 1 1 .1 0 M13 15 L19 10 M13 17 L19 22" stroke={color} strokeWidth={1.6} fill="none" />;
    case 'scorers_overall':
      return <Circle cx="16" cy="16" r="6" stroke={color} strokeWidth={1.6} fill="none" />;
    case 'scorers_europe':
      return <Path d="M16 7 L20 14 H12 Z M12 16 H20 L16 25 Z" fill={color} />;
    case 'scorers_egypt':
      return <Path d="M6 22 L12 12 L16 18 L22 8 L28 22 Z" fill={color} />;
    case 'coach':
    case 'coach_tactics':
      return <Path d="M10 20 H22 M16 20 V10 M12 12 H20" stroke={color} strokeWidth={1.7} fill="none" />;
    case 'daily_streak':
    case 'prediction_streak':
    case 'scorers_streak':
      return <Path d="M16 7 C16 7 10 14 10 18 a6 6 0 0 0 12 0 C22 14 16 7 16 7 Z" fill={color} />;
    case 'activity_streak':
      return <Path d="M18 6 L10 18 H16 L14 26 L24 14 H18 Z" fill={color} />;
    case 'points':
      return <Circle cx="16" cy="16" r="6" fill={color} />;
    case 'community_activity':
      return <Path d="M8 20 a4 4 0 1 1 8 0 M16 20 a4 4 0 1 1 8 0 M12 14 a3 3 0 1 1 6 0" stroke={color} strokeWidth={1.5} fill="none" />;
    default:
      return <Path d="M16 8 L19 14 L26 15 L21 20 L22 27 L16 23 L10 27 L11 20 L6 15 L13 14 Z" fill={color} />;
  }
}

export default function BadgeIcon({
  badgeKey,
  accent = '#f5b942',
  size,
  variant = 'inline',
}: {
  badgeKey: string;
  accent?: string;
  size?: number;
  variant?: BadgeIconVariant | 'comment';
}) {
  const box = size ?? (SIZE as Record<string, number>)[variant] ?? 16;
  return (
    <Svg width={box} height={box} viewBox="0 0 32 32">
      <Polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="#111" stroke={accent} strokeWidth={1.6} />
      {glyph(badgeKey, accent)}
    </Svg>
  );
}
