import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Zap } from 'lucide-react-native';
import { useHaptic } from '../../hooks/useHaptic';
import { useTranslation } from '../../src/i18n';
import { getTeamDisplayName, getLeagueDisplayName } from '../../utils/i18nHelpers';
import { resolveLiveMinuteLabel } from './leagueApiUtils';
import TeamBadge from '../common/TeamBadge';
import LeagueIcon from '../common/LeagueIcon';
import {
  Match,
  getGradientColors,
  getTeamGradients,
  extractTeamDisplayData,
  extractLiveIndicatorData,
  GRADIENT_SCHEMES,
} from './matchCardUtils';

// Re-export types and utilities for backwards compatibility
export {
  getGradientColors,
  getTeamGradients,
  extractTeamDisplayData,
  extractLiveIndicatorData,
  GRADIENT_SCHEMES,
} from './matchCardUtils';
export type { Match, TeamInfo } from './matchCardUtils';

export interface UserPrediction {
  type: 'home' | 'draw' | 'away';
  points?: number;
}

export interface GradientMatchCardProps {
  match: Match;
  gradientIndex: number;
  onPress: () => void;
  onFavoritePress?: (match: Match) => void; // ✅ Changed to pass match object
  showFavorite?: boolean;
  isFavorite?: boolean;
  showPrediction?: boolean;
  userPrediction?: UserPrediction;
  onPredictionSubmit?: (matchId: string, prediction: UserPrediction) => void;
}

const GradientMatchCard: React.FC<GradientMatchCardProps> = ({
  match,
  gradientIndex,
  onPress,
  onFavoritePress,
  showFavorite = false,
  isFavorite = false,
  showPrediction = false,
  userPrediction,
  onPredictionSubmit,
}) => {
  const { trigger } = useHaptic();
  const { t, language } = useTranslation();
  const scaleAnim = useSharedValue(1);
  const modalScaleAnim = useSharedValue(0);

  // Use team-based gradients with fallback for undefined teams - memoized for performance
  const gradientColors = React.useMemo(() => getTeamGradients(
    match.homeTeam?.name || 'Team 1',
    match.awayTeam?.name || 'Team 2'
  ), [match.homeTeam?.name, match.awayTeam?.name]);

  const localizedHomeName = getTeamDisplayName(match.homeTeam?.name, language);
  const localizedAwayName = getTeamDisplayName(match.awayTeam?.name, language);
  const localizedLeagueName = getLeagueDisplayName(
    match.league?.name,
    language,
    match.league?.id,
    match.league?.country,
  );
  const homeFallback = t.matches.prediction.homeLabelFallback ?? 'Home';
  const awayFallback = t.matches.prediction.awayLabelFallback ?? 'Away';
  const winLabel = t.predictions.homeWin ?? 'Win';
  const drawLabel = t.predictions.draw ?? 'Draw';

  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<'home' | 'draw' | 'away' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const handlePressIn = () => {
    scaleAnim.value = withSpring(0.98, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = () => {
    scaleAnim.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handleFavoritePress = () => {
    if (onFavoritePress) {
      trigger('selection');
      onFavoritePress(match);
    }
  };

  // Use prop isFavorite if provided, otherwise fallback to match.isFavorited
  const matchIsFavorite = showFavorite ? isFavorite : (match.isFavorited || false);

  const handlePress = () => {
    trigger('selection');
    onPress();
  };

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalScaleAnim.value }],
    opacity: modalScaleAnim.value,
  }));

  const openPredictionModal = () => {
    trigger('selection');
    setShowPredictionModal(true);
    modalScaleAnim.value = 0;
    modalScaleAnim.value = withSpring(1, {
      damping: 12,
      stiffness: 200,
    });
  };

  const handleSubmitPrediction = async () => {
    if (!selectedPrediction || !onPredictionSubmit) return;

    if (match.status !== 'upcoming') {
      Alert.alert(t.predictions.alertTitle, t.predictions.cannotPredictLive);
      return;
    }

    setIsSubmitting(true);
    trigger('heavy');

    try {
      await onPredictionSubmit(match.id, {
        type: selectedPrediction,
        points: 5,
      });
      setShowPredictionModal(false);
      setSelectedPrediction(null);
    } catch (error) {
      Alert.alert(t.predictions.errorTitle, t.predictions.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLive = match.status === 'live';
  const isUpcoming = match.status === 'upcoming';
  const canPredict = showPrediction && isUpcoming && !userPrediction && onPredictionSubmit;

  const getPredictionLabel = (type: string) => {
    switch (type) {
      case 'home': return `${localizedHomeName || homeFallback} ${winLabel}`;
      case 'away': return `${localizedAwayName || awayFallback} ${winLabel}`;
      case 'draw': return drawLabel;
      default: return '';
    }
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <View style={styles.cardWrapper}>
            <LinearGradient
              colors={gradientColors as [string, string]}
              start={{ x: 0, y: 0.4 }}
              end={{ x: 1, y: 0.6 }}
              style={styles.gradientBase}
            />

            <BlurView intensity={18} tint="dark" style={styles.container}>
              {/* Visual Glass Sheen */}
              <LinearGradient
                colors={['rgba(255,255,255,0.08)', 'transparent', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Top Row - Live Indicator Only */}
              <View style={styles.topRow}>
                <View style={{ flex: 1 }} />
                {isLive && (
                  <View style={styles.liveBadge}>
                    <Ionicons name="videocam" size={12} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.liveText}>{t.matches.status.live}</Text>
                  </View>
                )}
              </View>

              {/* Premium Action Icon - Centered Top */}
              {(showFavorite || onFavoritePress) && (
                <TouchableOpacity
                  style={styles.favoriteButton}
                  onPress={handleFavoritePress}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.iconBackground,
                    matchIsFavorite && styles.iconBackgroundActive
                  ]}>
                    <Ionicons
                      name={matchIsFavorite ? "notifications" : "notifications-outline"}
                      size={20}
                      color={matchIsFavorite ? "#32cd32" : "rgba(255,255,255,0.6)"}
                    />
                  </View>
                </TouchableOpacity>
              )}

              {/* Match Content */}
              <View style={styles.matchContent}>
                {/* Home Team */}
                <View style={styles.team}>
                  <View style={styles.logoWrapper}>
                    <TeamBadge 
                      name={match.homeTeam?.name || 'TBD'} 
                      logo={match.homeTeam?.logo}
                      size={60} 
                      color="transparent" 
                    />
                  </View>
                  <Text style={styles.teamName} numberOfLines={2}>
                    {localizedHomeName || 'TBD'}
                  </Text>
                </View>

                {/* Center - Score/Time */}
                <View style={styles.centerArea}>
                  {isUpcoming ? (
                    <Text style={styles.matchTime}>{match.time || 'TBD'}</Text>
                  ) : (
                    <Text style={styles.score}>
                      {match.score?.home ?? '-'} : {match.score?.away ?? '-'}
                    </Text>
                  )}

                  {/* Live Timer or Static Minute */}
                  {isLive && (
                    <Text style={styles.matchMinute}>
                      {match.minute ??
                        resolveLiveMinuteLabel(match.statusShort, match.elapsed, {
                          startTimestamp: match.startTimestamp,
                        }) ??
                        match.statusShort ??
                        'LIVE'}
                    </Text>
                  )}

                  {/* Prediction Button or User Prediction */}
                  {canPredict && (
                    <TouchableOpacity
                      style={styles.predictButton}
                      onPress={openPredictionModal}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.predictButtonText}>{t.predictions.predict}</Text>
                      <Text style={styles.predictPoints}>5</Text>
                      <Zap size={14} color="#FFD700" fill="#FFD700" />
                    </TouchableOpacity>
                  )}

                  {userPrediction && (
                    <View style={styles.userPredictionBadge}>
                      <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
                      <Text style={styles.userPredictionText}>
                        {getPredictionLabel(userPrediction.type)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Away Team */}
                <View style={styles.team}>
                  <View style={styles.logoWrapper}>
                    <TeamBadge 
                      name={match.awayTeam?.name || 'TBD'} 
                      logo={match.awayTeam?.logo}
                      size={60} 
                      color="transparent" 
                    />
                  </View>
                  <Text style={styles.teamName} numberOfLines={2}>
                    {localizedAwayName || 'TBD'}
                  </Text>
                </View>
              </View>

              {/* Bottom Row - League Info */}
              <View style={styles.bottomRow}>
                <View style={styles.leagueBadgeBottom}>
                  <LeagueIcon 
                    name={match.league?.name || 'League'} 
                    logo={match.league?.logo}
                    size={16} 
                    color="#ffffff" 
                  />
                  <Text style={styles.leagueNameBottom} numberOfLines={1}>
                    {localizedLeagueName || 'League'}
                  </Text>
                </View>
              </View>
            </BlurView>
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* Prediction Modal */}
      <Modal
        visible={showPredictionModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowPredictionModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <BlurView intensity={80} tint="dark" style={styles.modalBlur}>
            <Animated.View
              style={[
                styles.modalWrapper,
                modalAnimatedStyle,
              ]}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t.matches.prediction.title}</Text>
                  <TouchableOpacity
                    style={styles.modalClose}
                    onPress={() => setShowPredictionModal(false)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.predictionOptions}>
                  {/* Home Win */}
                  <TouchableOpacity
                    style={[
                      styles.predictionOption,
                      selectedPrediction === 'home' && styles.selectedOption,
                    ]}
                    onPress={() => setSelectedPrediction('home')}
                  >
                    {match.homeTeam?.logo && (
                      <Image source={{ uri: match.homeTeam.logo }} style={styles.optionLogo} />
                    )}
                    <Text style={styles.optionText} numberOfLines={2}>
                      {`${localizedHomeName || homeFallback} ${winLabel}`}
                    </Text>
                    {selectedPrediction === 'home' && (
                      <Ionicons name="checkmark-circle" size={20} color="#22c55e" style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>

                  {/* Draw */}
                  <TouchableOpacity
                    style={[
                      styles.predictionOption,
                      selectedPrediction === 'draw' && styles.selectedOption,
                    ]}
                    onPress={() => setSelectedPrediction('draw')}
                  >
                    <View style={styles.drawIcon}>
                      <Text style={styles.drawText}>X</Text>
                    </View>
                    <Text style={styles.optionText}>{drawLabel}</Text>
                    {selectedPrediction === 'draw' && (
                      <Ionicons name="checkmark-circle" size={20} color="#fbbf24" style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>

                  {/* Away Win */}
                  <TouchableOpacity
                    style={[
                      styles.predictionOption,
                      selectedPrediction === 'away' && styles.selectedOption,
                    ]}
                    onPress={() => setSelectedPrediction('away')}
                  >
                    {match.awayTeam?.logo && (
                      <Image source={{ uri: match.awayTeam.logo }} style={styles.optionLogo} />
                    )}
                    <Text style={styles.optionText} numberOfLines={2}>
                      {`${localizedAwayName || awayFallback} ${winLabel}`}
                    </Text>
                    {selectedPrediction === 'away' && (
                      <Ionicons name="checkmark-circle" size={20} color="#ef4444" style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    !selectedPrediction && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmitPrediction}
                  disabled={!selectedPrediction || isSubmitting}
                >
                  <Text style={styles.submitButtonText}>
                    {isSubmitting ? t.predictions.submitting : t.predictions.submitPrediction}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </BlurView>
        </View>
      </Modal>
    </>
  );
};


const styles = StyleSheet.create({
  cardWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F0F1A',
    ...(Platform.OS === 'web'
      ? {
        boxShadow: '0 12px 16px rgba(0, 0, 0, 0.5)',
      }
      : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      }),
    elevation: 15,
  },
  gradientBase: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85, // Enhanced to make team colors pop and melt together
  },
  container: {
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 180,
    backgroundColor: 'rgba(10, 10, 18, 0.35)', // Add subtle depth under the frosted glass
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  iconBackground: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconBackgroundActive: {
    backgroundColor: 'rgba(50, 205, 50, 0.15)',
    borderColor: 'rgba(50, 205, 50, 0.3)',
  },
  bottomRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
  },
  leagueBadgeBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  leagueLogoSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  leagueNameBottom: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 200,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  liveText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  matchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  team: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    maxWidth: 85,
  },
  logoWrapper: {
    width: 76,  // Increased from 68
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  teamLogo: {
    width: 60, // Increased from 52
    height: 60,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 85,
    lineHeight: 20,
    ...(Platform.OS === 'web'
      ? {
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
      }
      : {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
      }),
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 80,
    paddingHorizontal: 8,
  },
  score: {
    color: '#FFFFFF',
    fontSize: 32, // Increased from 28
    fontWeight: '800',
    letterSpacing: 4,
    ...(Platform.OS === 'web'
      ? {
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
      }
      : {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
      }),
  },
  matchTime: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  matchMinute: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  predictButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  predictButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  predictPoints: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '800',
  },
  userPredictionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
    marginTop: 8,
  },
  userPredictionText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalBlur: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalWrapper: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalClose: {
    padding: 4,
  },
  predictionOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  predictionOption: {
    flex: 1,
    backgroundColor: '#252525',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    backgroundColor: '#2a2a2a',
    borderColor: '#8B5CF6',
  },
  optionLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  drawIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  optionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkIcon: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  submitButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default GradientMatchCard;
