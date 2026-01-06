import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, StyleSheet as RNStyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { Match } from './matchCardUtils';
import { ApiFootballService, TeamStatistics } from '../../services/apiFootball';
import { useRouter } from 'expo-router';

interface LiveScoreMatchCardProps {
  match: Match;
  index: number;
  onPress?: (matchId: string) => void;
}

interface MatchStatistics {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
}

const LiveScoreMatchCard: React.FC<LiveScoreMatchCardProps> = ({
  match,
  index,
  onPress,
}) => {
  const router = useRouter();
  const [statistics, setStatistics] = useState<MatchStatistics | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isUpcoming = match.status === 'upcoming' || match.status === 'NS' || match.status === 'TBD';

  // Fetch statistics for live matches
  useEffect(() => {
    if (isLive) {
      fetchStatistics();
      
      // Pulse animation for live badge
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Refresh statistics every 30 seconds for live matches
      const interval = setInterval(fetchStatistics, 30000);
      return () => {
        clearInterval(interval);
        pulseAnimation.stop();
      };
    }
  }, [isLive, match.id]);

  const fetchStatistics = async () => {
    if (loadingStats) return;
    
    setLoadingStats(true);
    try {
      const stats = await ApiFootballService.getFixtureStatistics(parseInt(match.id));
      if (stats && stats.length >= 2) {
        const homeStats = stats[0];
        const awayStats = stats[1];

        const getStat = (teamStats: TeamStatistics, statName: string): number => {
          const stat = teamStats.statistics?.find((s) => s.type === statName);
          if (!stat) return 0;
          // Handle percentage values
          if (statName === 'Ball Possession') {
            const value = typeof stat.value === 'string' ? stat.value.replace('%', '') : String(stat.value || '0');
            return parseInt(value) || 0;
          }
          const value = typeof stat.value === 'string' ? stat.value : String(stat.value || '0');
          return parseInt(value) || 0;
        };

        setStatistics({
          possession: {
            home: getStat(homeStats, 'Ball Possession'),
            away: getStat(awayStats, 'Ball Possession'),
          },
          shots: {
            home: getStat(homeStats, 'Total Shots'),
            away: getStat(awayStats, 'Total Shots'),
          },
          shotsOnTarget: {
            home: getStat(homeStats, 'Shots on Goal'),
            away: getStat(awayStats, 'Shots on Goal'),
          },
        });
      }
    } catch (error) {
      // Silent fail - statistics are optional
    } finally {
      setLoadingStats(false);
    }
  };

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

  const renderStatusBadge = () => {
    if (isLive) {
      return (
        <Animated.View
          style={[
            styles.liveBadge,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.liveBadgeGradient}
          >
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{match.minute || "LIVE"}'</Text>
          </LinearGradient>
        </Animated.View>
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
    <Reanimated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={styles.container}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handlePress}
        style={styles.touchable}
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <BlurView intensity={20} tint="dark" style={styles.blurContainer}>
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
            <View style={styles.statusBadgeContainer}>
              {renderStatusBadge()}
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
                  <Text style={styles.upcomingScore}>VS</Text>
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

            {/* Live Statistics (only for live matches) */}
            {isLive && statistics && (
              <View style={styles.statisticsContainer}>
                {/* Possession */}
                <View style={styles.statRow}>
                  <View style={styles.possessionBar}>
                    <LinearGradient
                      colors={['#3B82F6', '#60A5FA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.possessionBarFill, { width: `${statistics.possession.home}%` }]}
                    />
                  </View>
                  <View style={styles.possessionTextContainer}>
                    <Text style={styles.possessionText}>
                      {statistics.possession.home}%
                    </Text>
                    <Text style={styles.possessionText}>
                      {statistics.possession.away}%
                    </Text>
                  </View>
                </View>

                {/* Shots */}
                <View style={styles.shotsRow}>
                  <View style={styles.shotStat}>
                    <Text style={styles.shotNumber}>{statistics.shots.home}</Text>
                    <Text style={styles.shotLabel}>SHOTS</Text>
                  </View>
                  <View style={styles.shotStatCenter}>
                    <Text style={styles.shotNumber}>
                      {statistics.shotsOnTarget.home + statistics.shotsOnTarget.away}
                    </Text>
                    <Text style={styles.shotLabel}>ON TARGET</Text>
                  </View>
                  <View style={styles.shotStat}>
                    <Text style={styles.shotNumber}>{statistics.shots.away}</Text>
                    <Text style={styles.shotLabel}>SHOTS</Text>
                  </View>
                </View>
              </View>
            )}
          </BlurView>
        </LinearGradient>
      </TouchableOpacity>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  touchable: {
    width: '100%',
  },
  cardGradient: {
    borderRadius: 16,
  },
  blurContainer: {
    padding: 16,
    borderRadius: 16,
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
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  liveBadge: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 8,
  },
  liveBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  finishedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  finishedText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  upcomingBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  upcomingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60A5FA',
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  teamLogo: {
    width: 56,
    height: 56,
  },
  teamName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    minWidth: 32,
    textAlign: 'center',
  },
  scoreLive: {
    color: '#60A5FA',
  },
  scoreSeparator: {
    fontSize: 28,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  upcomingScore: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 2,
  },
  statisticsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 16,
  },
  statRow: {
    gap: 8,
  },
  possessionBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  possessionBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  possessionTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  possessionText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  shotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  shotStat: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  shotStatCenter: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shotNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  shotLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default LiveScoreMatchCard;
