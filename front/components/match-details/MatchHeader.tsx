import React, { useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LiveTimer } from '../common/LiveTimer';
import { useLanguage } from '../../contexts/LanguageContext';

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
  startTimestamp?: number;
  statusShort?: string;
}

export const MatchHeader: React.FC<MatchHeaderProps> = ({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  homeScore,
  awayScore,
  status,
  league,
  startTimestamp,
  statusShort,
}) => {
  const { t } = useLanguage();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isLive = status === 'live' || statusShort?.includes('1H') || statusShort?.includes('2H');

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
      {/* Title Header is handled in parent, this is the Score Card */}
      <LinearGradient
        colors={['#4c1d95', '#2e1065', '#0f0720']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Top Status */}
        <View style={styles.topStatus}>
          {isLive && (
            <View style={styles.liveContainer}>
              <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Teams and Score Row */}
        <View style={styles.matchRow}>
          {/* Home Team */}
          <View style={styles.teamContainer}>
            <View style={styles.logoContainer}>
              <Image source={{ uri: homeLogo }} style={styles.teamLogo} />
            </View>
            <Text style={styles.teamName} numberOfLines={1}>{homeTeam}</Text>
          </View>

          {/* Center Info */}
          <View style={styles.centerInfo}>
            {isLive ? (
              <View style={styles.timeInfo}>
                <Text style={styles.periodText}>{statusShort || '1ST'}</Text>
                {!!startTimestamp && (
                  <LiveTimer startTime={startTimestamp} status={statusShort || ''} style={styles.timerText} />
                )}
              </View>
            ) : status === 'finished' ? (
              <Text style={styles.periodText}>{t.matchDetails.statusFinished}</Text>
            ) : (
              <Text style={styles.periodText}>{t.matchDetails.statusUpcoming}</Text>
            )}

            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>{homeScore || '0'}</Text>
              <Text style={styles.scoreDivider}>:</Text>
              <Text style={styles.scoreText}>{awayScore || '0'}</Text>
            </View>
          </View>

          {/* Away Team */}
          <View style={styles.teamContainer}>
            <View style={styles.logoContainer}>
              <Image source={{ uri: awayLogo }} style={styles.teamLogo} />
            </View>
            <Text style={styles.teamName} numberOfLines={1}>{awayTeam}</Text>
          </View>
        </View>


      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    width: '100%',
    shadowColor: '#4c1d95',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  topStatus: {
    alignItems: 'center',
    marginBottom: 10,
    height: 20,
  },
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamContainer: {
    alignItems: 'center',
    width: '30%',
    gap: 8,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  teamLogo: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  teamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  centerInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '40%',
    gap: 4,
  },
  timeInfo: {
    alignItems: 'center',
  },
  periodText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  timerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  scoreDivider: {
    color: '#9ca3af',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: -4,
  },
});
