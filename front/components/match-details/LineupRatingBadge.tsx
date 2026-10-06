import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './MatchText';
import { LinearGradient } from 'expo-linear-gradient';
import { ratingBadgeColor } from '../../utils/lineupMatchState';

const GREEN_STOPS = ['#1E742E', '#124D1D', '#145821', '#165021', '#1D7730'] as const;
const GREEN_LOCATIONS = [0, 0.239, 0.469, 0.717, 1] as const;
const STANDOUT = '#733AF5';

interface LineupRatingBadgeProps {
  rating: number;
  /** Multiplier applied to the 36×14 Figma pill. */
  scale?: number;
}

export function LineupRatingBadge({ rating, scale = 1 }: LineupRatingBadgeProps) {
  const box = {
    width: 36 * scale,
    height: 14 * scale,
    borderRadius: 7 * scale,
  };
  const label = (
    <Text style={[styles.text, { fontSize: 10 * scale }]} maxFontSizeMultiplier={1.1}>
      {rating.toFixed(1)}
    </Text>
  );

  if (rating >= 8 || rating < 6) {
    return (
      <View
        style={[
          styles.pill,
          box,
          { backgroundColor: rating >= 8 ? STANDOUT : ratingBadgeColor(rating) },
        ]}
      >
        {label}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={GREEN_STOPS}
      locations={GREEN_LOCATIONS}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 0 }}
      style={[styles.pill, box]}
    >
      {label}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
    includeFontPadding: false,
  },
});

export default LineupRatingBadge;
