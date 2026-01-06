/**
 * Quick Indicators Row
 * Shows matches count (🔴) and leagues count (🟢)
 * Lightweight, informative design
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../reels/constants';

interface QuickIndicatorsProps {
  matchesCount: number;
  leaguesCount: number;
}

const QuickIndicators: React.FC<QuickIndicatorsProps> = ({
  matchesCount,
  leaguesCount,
}) => {
  return (
    <View style={styles.container}>
      {/* Matches Count */}
      <View style={styles.indicator}>
        <View style={styles.redDot} />
        <Text style={styles.countText}>{matchesCount}</Text>
        <Text style={styles.labelText}>Matches</Text>
      </View>

      {/* Leagues Count */}
      <View style={styles.indicator}>
        <View style={styles.greenDot} />
        <Text style={styles.countText}>{leaguesCount}</Text>
        <Text style={styles.labelText}>Leagues</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 24,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.neonRed,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.neonGreen,
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});

export default QuickIndicators;

