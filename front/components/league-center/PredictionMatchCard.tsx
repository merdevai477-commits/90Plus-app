import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, Alert, StyleSheet as RNStyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Handshake, TrendingDown, ChevronRight } from 'lucide-react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Match } from './matchCardUtils';
import { useRouter } from 'expo-router';

interface PredictionMatchCardProps {
  match: Match;
  index: number;
  userPrediction?: {
    type: 'home' | 'draw' | 'away';
    points?: number;
  };
  onPredictionSubmit?: (matchId: string, prediction: { type: 'home' | 'draw' | 'away' }) => void;
  odds?: {
    home: number;
    draw: number;
    away: number;
  };
}

// Mock odds if not provided - in production, fetch from API
const getMockOdds = (): { home: number; draw: number; away: number } => {
  const base = 2.0 + Math.random() * 1.5;
  return {
    home: Number((base + (Math.random() - 0.5) * 0.5).toFixed(2)),
    draw: Number((base + 0.5 + (Math.random() - 0.5) * 0.5).toFixed(2)),
    away: Number((base + (Math.random() - 0.5) * 0.5).toFixed(2)),
  };
};

const PredictionMatchCard: React.FC<PredictionMatchCardProps> = ({
  match,
  index,
  userPrediction,
  onPredictionSubmit,
  odds: providedOdds,
}) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scaleAnims = useRef(
    ['home', 'draw', 'away'].map(() => new Animated.Value(1))
  ).current;

  const odds = providedOdds || getMockOdds();

  const handlePredictionPress = async (type: 'home' | 'draw' | 'away') => {
    if (userPrediction) {
      Alert.alert('تم التوقع', 'لقد قمت بالتوقع على هذه المباراة بالفعل');
      return;
    }

    if (match.status !== 'upcoming' && match.status !== 'NS' && match.status !== 'TBD') {
      Alert.alert('غير متاح', 'يمكنك التوقع فقط على المباريات القادمة');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Scale animation
    const animIndex = type === 'home' ? 0 : type === 'draw' ? 1 : 2;
    Animated.sequence([
      Animated.timing(scaleAnims[animIndex], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnims[animIndex], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (onPredictionSubmit) {
      setIsSubmitting(true);
      try {
        await onPredictionSubmit(match.id, { type });
      } catch (error) {
        Alert.alert('خطأ', 'فشل في حفظ التوقع');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleViewDetails = () => {
    router.push({
      pathname: '/(tabs)/match-details',
      params: {
        fixtureId: match.id,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeLogo: match.homeTeam.logo,
        awayLogo: match.awayTeam.logo,
        league: match.league?.name || '',
        leagueLogo: match.league?.logo || '',
        date: match.fixtureDate || '',
        time: match.time || '',
        status: match.status,
      },
    });
  };

  const predictionButtons = [
    {
      type: 'home' as const,
      icon: Trophy,
      label: 'فوز',
      odds: odds.home,
      color: '#3B82F6',
    },
    {
      type: 'draw' as const,
      icon: Handshake,
      label: 'تعادل',
      odds: odds.draw,
      color: '#60A5FA',
    },
    {
      type: 'away' as const,
      icon: TrendingDown,
      label: 'خسارة',
      odds: odds.away,
      color: '#3B82F6',
    },
  ];

  return (
    <Reanimated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={styles.container}
    >
      <BlurView intensity={25} tint="dark" style={styles.blurContainer}>
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'transparent', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={RNStyleSheet.absoluteFill}
          />

        {/* Top Row - Status & Time */}
        <View style={styles.topRow}>
          <View style={styles.statusContainer}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>UPCOMING</Text>
          </View>
          <Text style={styles.matchTime}>{match.time || 'TBD'}</Text>
        </View>

        {/* Teams */}
        <View style={styles.teamsRow}>
          <View style={styles.teamContainer}>
            <View style={styles.logoSquare}>
              <Image
                source={{ uri: match.homeTeam.logo }}
                style={styles.teamLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.teamName} numberOfLines={1}>
              {match.homeTeam.name}
            </Text>
          </View>

          <Text style={styles.vsText}>VS</Text>

          <View style={styles.teamContainer}>
            <View style={styles.logoSquare}>
              <Image
                source={{ uri: match.awayTeam.logo }}
                style={styles.teamLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.teamName} numberOfLines={1}>
              {match.awayTeam.name}
            </Text>
          </View>
        </View>

        {/* Prediction Buttons */}
        <View style={styles.predictionButtonsRow}>
          {predictionButtons.map((button, idx) => {
            const isSelected = userPrediction?.type === button.type;
            const Icon = button.icon;
            const animIndex = idx;

            return (
              <Animated.View
                key={button.type}
                style={[
                  styles.predictionButtonWrapper,
                  { transform: [{ scale: scaleAnims[animIndex] }] },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.predictionButton,
                    isSelected && styles.predictionButtonSelected,
                  ]}
                  onPress={() => handlePredictionPress(button.type)}
                  activeOpacity={0.8}
                  disabled={isSubmitting || !!userPrediction}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={[button.color, `${button.color}CC`]}
                      style={styles.predictionButtonGradient}
                    >
                      <Icon size={20} color="#FFFFFF" />
                      <Text style={styles.predictionButtonText}>{button.label}</Text>
                      <Text style={styles.oddsText}>{button.odds}x</Text>
                    </LinearGradient>
                  ) : (
                    <>
                      <Icon size={20} color={button.color} />
                      <Text style={styles.predictionButtonText}>{button.label}</Text>
                      <Text style={styles.oddsText}>{button.odds}x</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Bottom Row - League & View Details */}
        <View style={styles.bottomRow}>
          <Text style={styles.leagueName}>{match.league?.name || 'League'}</Text>
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={handleViewDetails}
            activeOpacity={0.7}
          >
            <Text style={styles.viewDetailsText}>View Details</Text>
            <ChevronRight size={16} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      </BlurView>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  blurContainer: {
    padding: 16,
    borderRadius: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  matchTime: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  logoSquare: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  teamLogo: {
    width: '100%',
    height: '100%',
  },
  teamName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    maxWidth: 100,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 12,
  },
  predictionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  predictionButtonWrapper: {
    flex: 1,
  },
  predictionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 80,
  },
  predictionButtonSelected: {
    borderColor: '#3B82F6',
    borderWidth: 2,
  },
  predictionButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    position: 'absolute',
  },
  predictionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  oddsText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  leagueName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
});

export default PredictionMatchCard;

