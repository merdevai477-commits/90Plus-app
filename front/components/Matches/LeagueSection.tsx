/**
 * League Section Component
 * Optimized with lazy loading and faster animations
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Match } from '../league-center/matchCardUtils';
import { MATCH_DETAILS_COLORS, ANIMATION_CONFIG } from '../../constants/matchDetailsColors';
import GradientMatchCard from '../league-center/GradientMatchCard';

export interface LeagueSectionProps {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  matchCount?: number;
  matches?: Match[]; // Kept for compatibility if passed
  isExpanded?: boolean;
  onToggle?: (leagueId: number) => void;
}

const LeagueSection: React.FC<LeagueSectionProps> = React.memo(({
  leagueId,
  leagueName,
  leagueLogo,
  matchCount,
  matches,
  isExpanded = false,
  onToggle,
}) => {
  // Removed internal state, relying on props now.
  const rotation = useSharedValue(isExpanded ? 90 : 0);

  useEffect(() => {
    rotation.value = withSpring(isExpanded ? 90 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [isExpanded]);

  const toggleExpanded = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onToggle) {
        onToggle(leagueId);
    }
  }, [leagueId, onToggle]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      {/* League Header - Clickable */}
      <TouchableOpacity
        style={[styles.header, { marginBottom: isExpanded ? 12 : 4 }]}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
        {leagueLogo && (
          <Image
            source={{ uri: leagueLogo }}
            style={styles.leagueLogo}
            contentFit="contain"
            transition={100}
            cachePolicy="memory-disk"
          />
        )}
        <Text style={styles.leagueName} numberOfLines={1}>
          {leagueName}
        </Text>
        <View style={styles.matchCountBadge}>
          <Text style={styles.matchCountText}>{matchCount || matches?.length || 0}</Text>
        </View>
        <Animated.View style={arrowStyle}>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={MATCH_DETAILS_COLORS.textSecondary}
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}, (prevProps, nextProps) => {
  return prevProps.isExpanded === nextProps.isExpanded && 
         prevProps.leagueId === nextProps.leagueId &&
         prevProps.matchCount === nextProps.matchCount;
});

LeagueSection.displayName = 'LeagueSection';

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  leagueLogo: {
    width: 24,
    height: 24,
  },
  leagueName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
    letterSpacing: 0.2,
  },
  matchCountBadge: {
    backgroundColor: MATCH_DETAILS_COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
  },
  matchCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
  },
  matchesContainer: {
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  matchesList: {
    gap: 12,
    paddingTop: 8,
  },
});

export default LeagueSection;
