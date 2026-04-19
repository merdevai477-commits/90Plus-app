/**
 * Profile Tasks Badge Component
 * Shows remaining profile completion tasks with color-coded indicator
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface ProfileTasksBadgeProps {
  remainingTasks: number;
  totalTasks: number;
  percentage: number;
  onPress: () => void;
}

export const ProfileTasksBadge: React.FC<ProfileTasksBadgeProps> = ({
  remainingTasks,
  totalTasks,
  percentage,
  onPress,
}) => {
  // Don't show if profile is 100% complete
  if (percentage >= 100 || remainingTasks === 0) {
    return null;
  }

  // Get colors based on completion percentage
  const getColors = () => {
    if (percentage >= 80) return ['#22c55e', '#16a34a'] as const; // Green (almost done)
    if (percentage >= 50) return ['#eab308', '#ca8a04'] as const; // Yellow (halfway)
    if (percentage >= 30) return ['#f97316', '#ea580c'] as const; // Orange (getting started)
    return ['#ef4444', '#dc2626'] as const; // Red (just started)
  };

  const colors = getColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badge}
      >
        <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
        <Text style={styles.text}>{remainingTasks}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
