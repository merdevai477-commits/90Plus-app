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
  matches: Match[];
  onMatchPress?: (matchId: string) => void;
  index?: number;
  isExpandedByDefault?: boolean;
}

const LeagueSection: React.FC<LeagueSectionProps> = React.memo(({
  leagueId,
  leagueName,
  leagueLogo,
  matches,
  onMatchPress,
  index = 0,
  isExpandedByDefault = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(isExpandedByDefault);
  const [shouldRenderContent, setShouldRenderContent] = useState(isExpandedByDefault);
  const rotation = useSharedValue(isExpandedByDefault ? 90 : 0);

  // Simplified entrance animation - only for header, no delay
  useEffect(() => {
    if (isExpandedByDefault && !shouldRenderContent) {
      setShouldRenderContent(true);
    }
  }, []);

  // Fast toggle animation
  useEffect(() => {
    rotation.value = withSpring(isExpanded ? 90 : 0, {
      damping: 15,
      stiffness: 200,
    });
    
    // Only render content when expanded (lazy loading)
    if (isExpanded && !shouldRenderContent) {
      setShouldRenderContent(true);
    }
  }, [isExpanded]);

  const toggleExpanded = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(prev => !prev);
  }, []);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));


  // Don't render if no matches
  if (matches.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* League Header - Clickable */}
      <TouchableOpacity
        style={styles.header}
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
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          />
        )}
        <Text style={styles.leagueName} numberOfLines={1}>
          {leagueName}
        </Text>
        <View style={styles.matchCountBadge}>
          <Text style={styles.matchCountText}>{matches.length}</Text>
        </View>
        <Animated.View style={arrowStyle}>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={MATCH_DETAILS_COLORS.textSecondary}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Matches List - Lazy rendered only when expanded - Using map instead of FlatList for better performance */}
      {shouldRenderContent && isExpanded && (
        <View style={styles.matchesContainer}>
          {matches.map((match, matchIndex) => (
            <View key={match.id} style={{ marginBottom: 12 }}>
              <GradientMatchCard
                match={match}
                gradientIndex={matchIndex}
                onPress={() => onMatchPress?.(match.id)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  // More detailed comparison to reduce re-renders
  if (prevProps.leagueId !== nextProps.leagueId) return false;
  if (prevProps.leagueName !== nextProps.leagueName) return false;
  if (prevProps.leagueLogo !== nextProps.leagueLogo) return false;
  if (prevProps.matches.length !== nextProps.matches.length) return false;
  if (prevProps.isExpandedByDefault !== nextProps.isExpandedByDefault) return false;
  
  // Check if matches actually changed by comparing IDs
  if (prevProps.matches.length > 0 && nextProps.matches.length > 0) {
    const prevIds = prevProps.matches.map(m => m.id).join(',');
    const nextIds = nextProps.matches.map(m => m.id).join(',');
    if (prevIds !== nextIds) return false;
  }
  
  return true;
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
