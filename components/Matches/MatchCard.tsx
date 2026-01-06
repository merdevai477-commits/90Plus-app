/**
 * Match Card Component
 * Enhanced with animations, haptic feedback, and unified colors
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Match } from '../league-center/matchCardUtils';
import { MATCH_DETAILS_COLORS, ANIMATION_CONFIG } from '../../constants/matchDetailsColors';

interface MatchCardProps {
  match: Match;
  onPress?: (matchId: string) => void;
  index?: number;
}

const MatchCard: React.FC<MatchCardProps> = React.memo(({ match, onPress, index = 0 }) => {
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const glowOpacity = useSharedValue(0.3);

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isUpcoming = match.status === 'upcoming' || match.status === 'NS' || match.status === 'TBD';

  // Entrance animation
  useEffect(() => {
    const delay = index * ANIMATION_CONFIG.staggerDelay;
    setTimeout(() => {
      opacity.value = withTiming(1, { duration: ANIMATION_CONFIG.fadeInDuration });
      translateY.value = withSpring(0, ANIMATION_CONFIG.spring);
    }, delay);
  }, []);

  // Pulse animation for live matches
  useEffect(() => {
    if (isLive) {
      pulseScale.value = withRepeat(
        withTiming(1.02, { duration: ANIMATION_CONFIG.pulseDuration / 2 }),
        -1,
        true
      );
      glowOpacity.value = withRepeat(
        withTiming(0.6, { duration: ANIMATION_CONFIG.pulseDuration }),
        -1,
        true
      );
    }
  }, [isLive]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress(match.id);
    }
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.96, ANIMATION_CONFIG.spring);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, ANIMATION_CONFIG.spring);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * pulseScale.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const renderStatus = () => {
    if (isLive) {
      return (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{match.minute || "LIVE"}'</Text>
        </View>
      );
    } else if (isFinished) {
      return (
        <View style={styles.finishedBadge}>
          <Text style={styles.finishedText}>FT</Text>
        </View>
      );
    } else {
      return (
        <View style={styles.upcomingBadge}>
          <Text style={styles.upcomingText}>{match.time || 'TBD'}</Text>
        </View>
      );
    }
  };

  return (
    <Animated.View style={[animatedStyle, { marginBottom: 12 }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.container, isLive && styles.liveContainer]}
      >
        {/* Glow effect for live matches */}
        {isLive && (
          <Animated.View style={[styles.glowOverlay, glowStyle]} pointerEvents="none">
            <LinearGradient
              colors={['rgba(34, 197, 94, 0.1)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {/* League Header */}
        {match.league?.name && (
          <View style={styles.leagueHeader}>
            {match.league.logo && (
              <Image
                source={{ uri: match.league.logo }}
                style={styles.leagueLogo}
                contentFit="contain"
                transition={200}
                cachePolicy="memory-disk"
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              />
            )}
            <Text style={styles.leagueName} numberOfLines={1}>
              {match.league.name}
            </Text>
          </View>
        )}

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          {renderStatus()}
        </View>

        {/* Teams & Score */}
        <View style={styles.teamsRow}>
          {/* Home Team */}
          <View style={styles.teamSection}>
            <View style={styles.teamLogoContainer}>
              <Image
                source={{ uri: match.homeTeam.logo }}
                style={styles.teamLogo}
                contentFit="contain"
                transition={200}
                cachePolicy="memory-disk"
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              />
            </View>
            <Text style={styles.teamName} numberOfLines={2}>
              {match.homeTeam.name}
            </Text>
          </View>

          {/* Score */}
          <View style={styles.scoreContainer}>
            {isUpcoming ? (
              <Text style={styles.vsText}>VS</Text>
            ) : (
              <View style={styles.scoreRow}>
                <Text style={[styles.score, isLive && styles.scoreLive]}>
                  {match.score.home}
                </Text>
                <Text style={styles.scoreSeparator}>:</Text>
                <Text style={[styles.score, isLive && styles.scoreLive]}>
                  {match.score.away}
                </Text>
              </View>
            )}
          </View>

          {/* Away Team */}
          <View style={styles.teamSection}>
            <View style={styles.teamLogoContainer}>
              <Image
                source={{ uri: match.awayTeam.logo }}
                style={styles.teamLogo}
                contentFit="contain"
                transition={200}
                cachePolicy="memory-disk"
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              />
            </View>
            <Text style={styles.teamName} numberOfLines={2}>
              {match.awayTeam.name}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  return (
    prevProps.match.id === nextProps.match.id &&
    prevProps.match.status === nextProps.match.status &&
    prevProps.match.score.home === nextProps.match.score.home &&
    prevProps.match.score.away === nextProps.match.score.away &&
    prevProps.match.minute === nextProps.match.minute
  );
});

MatchCard.displayName = 'MatchCard';

const styles = StyleSheet.create({
  container: {
    backgroundColor: MATCH_DETAILS_COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  liveContainer: {
    borderColor: MATCH_DETAILS_COLORS.accent,
    shadowColor: MATCH_DETAILS_COLORS.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  leagueLogo: {
    width: 16,
    height: 16,
  },
  leagueName: {
    fontSize: 11,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MATCH_DETAILS_COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MATCH_DETAILS_COLORS.text,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
    letterSpacing: 0.5,
  },
  finishedBadge: {
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.borderLight,
  },
  finishedText: {
    fontSize: 11,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
  upcomingBadge: {
    backgroundColor: `rgba(59, 130, 246, 0.15)`,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `rgba(59, 130, 246, 0.3)`,
  },
  upcomingText: {
    fontSize: 11,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.blue,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  teamLogoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
  },
  teamLogo: {
    width: 44,
    height: 44,
  },
  teamName: {
    fontSize: 13,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
    textAlign: 'center',
    maxWidth: 110,
    lineHeight: 18,
  },
  scoreContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  score: {
    fontSize: 28,
    fontWeight: '900',
    color: MATCH_DETAILS_COLORS.text,
    letterSpacing: 1,
    minWidth: 28,
    textAlign: 'center',
  },
  scoreLive: {
    color: MATCH_DETAILS_COLORS.accent,
  },
  scoreSeparator: {
    fontSize: 24,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.textTertiary,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.textTertiary,
    letterSpacing: 2,
  },
});

export default MatchCard;
