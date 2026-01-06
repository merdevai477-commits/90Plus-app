/**
 * League Section Component
 * Enhanced with animations and unified colors
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Match } from '../league-center/matchCardUtils';
import { MATCH_DETAILS_COLORS, ANIMATION_CONFIG } from '../../constants/matchDetailsColors';
import MatchCard from './MatchCard';

export interface LeagueSectionProps {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  matches: Match[];
  onMatchPress?: (matchId: string) => void;
  index?: number;
}

const LeagueSection: React.FC<LeagueSectionProps> = React.memo(({
  leagueId,
  leagueName,
  leagueLogo,
  matches,
  onMatchPress,
  index = 0,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    const delay = index * 30; // Slight delay for stagger effect
    setTimeout(() => {
      opacity.value = withTiming(1, { duration: ANIMATION_CONFIG.fadeInDuration });
      translateY.value = withSpring(0, ANIMATION_CONFIG.spring);
    }, delay);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (matches.length === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* League Header */}
      <View style={styles.header}>
        {leagueLogo && (
          <Image
            source={{ uri: leagueLogo }}
            style={styles.leagueLogo}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          />
        )}
        <Text style={styles.leagueName} numberOfLines={1}>
          {leagueName}
        </Text>
        <View style={styles.matchCountBadge}>
          <Text style={styles.matchCountText}>{matches.length}</Text>
        </View>
      </View>

      {/* Matches List */}
      <View style={styles.matchesList}>
        {matches.map((match, matchIndex) => (
          <MatchCard
            key={match.id}
            match={match}
            onPress={onMatchPress}
            index={matchIndex}
          />
        ))}
      </View>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.leagueId === nextProps.leagueId &&
    prevProps.matches.length === nextProps.matches.length &&
    prevProps.matches.every((match, index) => match.id === nextProps.matches[index]?.id)
  );
});

LeagueSection.displayName = 'LeagueSection';

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 10,
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
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
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
  matchesList: {
    gap: 12,
  },
});

export default LeagueSection;
