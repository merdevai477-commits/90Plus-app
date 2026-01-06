/**
 * Match Card Component
 * 365Scores style - Lightweight, clickable, zero visual noise
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Match } from '../league-center/matchCardUtils';
import { COLORS } from '../reels/constants';
import { useRouter } from 'expo-router';

interface MatchCardProps {
  match: Match;
  onPress?: (matchId: string) => void;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, onPress }) => {
  const router = useRouter();
  const scale = useSharedValue(1);

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isUpcoming = match.status === 'upcoming' || match.status === 'NS' || match.status === 'TBD';

  const handlePress = () => {
    if (onPress) {
      onPress(match.id);
    } else {
      router.push({
        pathname: '/(tabs)/match-details',
        params: {
          fixtureId: match.id,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          homeLogo: match.homeTeam.logo,
          awayLogo: match.awayTeam.logo,
          homeScore: match.score.home?.toString() || '',
          awayScore: match.score.away?.toString() || '',
          league: match.league?.name || '',
          leagueLogo: match.league?.logo || '',
          date: match.fixtureDate || '',
          time: match.time || '',
          status: match.status,
        },
      });
    }
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
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
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.container, isLive && styles.liveContainer]}
      >
        {/* League Header */}
        {match.league?.name && (
          <View style={styles.leagueHeader}>
            {match.league.logo && (
              <Image
                source={{ uri: match.league.logo }}
                style={styles.leagueLogo}
                resizeMode="contain"
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
                resizeMode="contain"
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
                resizeMode="contain"
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
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.darkGray,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  liveContainer: {
    borderColor: 'rgba(255, 59, 48, 0.3)',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  leagueLogo: {
    width: 16,
    height: 16,
  },
  leagueName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textTertiary,
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
    backgroundColor: COLORS.neonRed,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  finishedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  finishedText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  upcomingBadge: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.3)',
  },
  upcomingText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.neonBlue,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  teamLogoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  teamLogo: {
    width: 44,
    height: 44,
  },
  teamName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
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
    color: COLORS.white,
    letterSpacing: 1,
    minWidth: 28,
    textAlign: 'center',
  },
  scoreLive: {
    color: COLORS.neonBlue,
  },
  scoreSeparator: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  vsText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textTertiary,
    letterSpacing: 2,
  },
});

export default MatchCard;

