import React, { useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface MatchHeaderProps {
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeScore?: string;
  awayScore?: string;
  status: string;
  league: string;
  date: string;
  time: string;
}

import { useLanguage } from '../../contexts/LanguageContext';

export const MatchHeader: React.FC<MatchHeaderProps> = ({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  homeScore,
  awayScore,
  status,
  league,
  date,
  time,
}) => {
  const { t } = useLanguage();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isLive = status === 'live';

  useEffect(() => {
    if (isLive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isLive]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#0a0a0a']}
        style={styles.gradient}
      >
        {/* League Info */}
        <View style={styles.leagueInfo}>
          <Ionicons name="trophy" size={14} color="#fbbf24" />
          <Text style={styles.leagueText}>{league}</Text>
          <View style={styles.dot} />
          <Text style={styles.dateText}>{date}</Text>
          <Text style={styles.timeText}>{time}</Text>
        </View>

        {/* Match Info */}
        <View style={styles.matchInfo}>
          {/* Home Team */}
          <View style={styles.team}>
            <View style={styles.teamLogoWrapper}>
              <Image source={{ uri: homeLogo }} style={styles.teamLogo} />
            </View>
            <Text style={styles.teamName} numberOfLines={2}>
              {homeTeam}
            </Text>
          </View>

          {/* Score / Status */}
          <View style={styles.scoreContainer}>
            {status === 'upcoming' ? (
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
                <Text style={styles.upcomingText}>{t.matchDetails.statusUpcoming}</Text>
              </View>
            ) : (
              <>
                <View style={styles.scoreWrapper}>
                  <Text style={styles.scoreText}>{homeScore || '0'}</Text>
                  <View style={styles.scoreDivider} />
                  <Text style={styles.scoreText}>{awayScore || '0'}</Text>
                </View>
                {isLive && (
                  <Animated.View
                    style={[
                      styles.liveIndicator,
                      { transform: [{ scale: pulseAnim }] },
                    ]}
                  >
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>{t.matchDetails.statusLive}</Text>
                  </Animated.View>
                )}
                {status === 'finished' && (
                  <View style={styles.finishedBadge}>
                    <Text style={styles.finishedText}>{t.matchDetails.statusFinished}</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Away Team */}
          <View style={styles.team}>
            <View style={styles.teamLogoWrapper}>
              <Image source={{ uri: awayLogo }} style={styles.teamLogo} />
            </View>
            <Text style={styles.teamName} numberOfLines={2}>
              {awayTeam}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  gradient: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  leagueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  leagueText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
  },
  dateText: {
    color: '#888',
    fontSize: 12,
  },
  timeText: {
    color: '#888',
    fontSize: 12,
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  team: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  teamLogoWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  teamLogo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  teamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    gap: 8,
    minWidth: 100,
  },
  vsContainer: {
    alignItems: 'center',
    gap: 4,
  },
  vsText: {
    color: '#666',
    fontSize: 24,
    fontWeight: 'bold',
  },
  upcomingText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  scoreWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  scoreDivider: {
    width: 2,
    height: 30,
    backgroundColor: '#333',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  finishedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  finishedText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
