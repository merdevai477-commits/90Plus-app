/**
 * Empty state component for League Center
 * Displays when no matches are available for the selected filters
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  message?: string;
  suggestion?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'No matches available',
  suggestion = 'Try selecting a different date or league filter',
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Empty Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="football-outline" size={56} color="rgba(255, 255, 255, 0.3)" />
        </View>

        {/* Empty Message */}
        <Text style={styles.title}>{message}</Text>
        <Text style={styles.suggestion}>{suggestion}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderStyle: 'dashed',
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    textAlign: 'center',
  },
  suggestion: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default EmptyState;

