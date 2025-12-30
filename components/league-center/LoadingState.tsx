/**
 * Loading state component for League Center
 * Displays skeleton placeholders while data is being fetched
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MatchCardSkeleton from './MatchCardSkeleton';

interface LoadingStateProps {
  skeletonCount?: number;
}

const LoadingState: React.FC<LoadingStateProps> = ({ skeletonCount = 3 }) => {
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Games</Text>
        <Text style={styles.seeAllText}>See All</Text>
      </View>

      {/* Skeleton Cards */}
      <View style={styles.skeletonList}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <MatchCardSkeleton key={index} gradientIndex={index} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  seeAllText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  skeletonList: {
    gap: 14,
  },
});

export default LoadingState;

