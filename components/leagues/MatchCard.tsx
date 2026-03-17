import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Star,
  Award,
  CheckCircle,
  XCircle,
  Users,
  Pin
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '../../contexts/LanguageContext';
import { MatchFavoritesStorage } from '../../src/storage/matchFavorites.storage';
import { toastManager } from '../../services/toastManager';

const { width } = Dimensions.get('window');

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  homeLogo: string;
  awayLogo: string;
  date: string;
  time: string;
  status: 'finished' | 'live' | 'upcoming';
  league: string;
  leagueLogo?: string;
  venue?: string;
  minute?: string; // ✅ NEW: Live match time (e.g., "44'", "HT", etc.)
  prediction?: {
    type: 'win' | 'draw' | 'lose';
    homeScore: number;
    awayScore: number;
    points?: number;
    isCorrect?: boolean;
  };
  odds?: {
    home: number;
    draw: number;
    away: number;
  };
}

interface MatchCardProps {
  match: Match;
  onPredictionSubmit: (matchId: string, prediction: any) => void;
  showPrediction?: boolean;
  userPredictions?: { [key: string]: any };
  onPress?: () => void;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  onPredictionSubmit,
  showPrediction = false,
  userPredictions = {},
  onPress
}) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<'home' | 'draw' | 'away' | null>(null);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const modalScaleAnim = useRef(new Animated.Value(0)).current;

  // Load notification state from shared favorites storage
  useEffect(() => {
    loadNotificationState();
  }, [match.id]);

  const loadNotificationState = async () => {
    try {
      const isFavorited = await MatchFavoritesStorage.isFavorite(match.id);
      setIsNotificationEnabled(isFavorited);
    } catch (error) {
      console.error('Error loading notification state:', error);
    }
  };

  const saveNotificationState = async (state: boolean) => {
    try {
      if (state) {
        await MatchFavoritesStorage.addFavorite(match.id);
      } else {
        await MatchFavoritesStorage.removeFavorite(match.id);
      }
    } catch (error) {
      console.error('Error saving notification state:', error);
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      })
    ]).start();
  }, []);

  useEffect(() => {
    if (showPredictionModal) {
      modalScaleAnim.setValue(0);
      Animated.spring(modalScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [showPredictionModal]);

  const getStatusColor = () => {
    switch (match.status) {
      case 'live': return '#ff4444';
      case 'finished': return '#22c55e';
      case 'upcoming': return '#3b82f6';
      default: return '#666';
    }
  };

  const getStatusText = () => {
    switch (match.status) {
      case 'live': return t.matchDetails.statusLive;
      case 'finished': return t.matchDetails.statusFinished;
      case 'upcoming': return t.matchDetails.statusUpcoming;
      default: return '';
    }
  };

  const handleToggleNotification = async () => {
    const newState = !isNotificationEnabled;
    setIsNotificationEnabled(newState);
    await saveNotificationState(newState);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (newState) {
      Alert.alert(
        `🔔 ${t.predictions.notificationsEnabled}`,
        `${t.predictions.notificationMessage}\n\n${match.homeTeam} ${t.matchDetails.vs || 'VS'} ${match.awayTeam}`,
        [{ text: t.common.done }]
      );
    } else {
      Alert.alert(
        `🔕 ${t.predictions.notificationsDisabled}`,
        t.predictions.notificationCancelled,
        [{ text: t.common.done }]
      );
    }
  };

  const handleSubmitPrediction = async () => {
    if (!selectedPrediction) return;

    if (match.status !== 'upcoming') {
      toastManager.showWarning('تحذير', 'لا يمكن التوقع للمباريات المباشرة');
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await onPredictionSubmit(match.id, {
        type: selectedPrediction,
        homeScore: 0,
        awayScore: 0,
        points: 5
      });

      setShowPredictionModal(false);
      toastManager.showSuccess('تم التوقع!', `تم تسجيل توقعك لمباراة ${match.homeTeam.name} ضد ${match.awayTeam.name} بنجاح`);
    } catch (error) {
      toastManager.showError('فشل التوقع', 'حدث خطأ أثناء تسجيل التوقع. يرجى المحاولة مرة أخرى');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userPrediction = userPredictions[match.id];

  const cardContent = (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      {/* Pinned Prediction Indicator - Far Right */}
      {userPrediction && (
        <View style={styles.pinnedPrediction}>
          {/* Visual generic pin or customized indicator */}
          {/* Showing what they predicted: Home Logo, Away Logo, or 'X' for Draw */}
          <View style={[
            styles.pinnedContent,
            userPrediction.prediction.type === 'home' ? { borderColor: '#3b82f6' } :
              userPrediction.prediction.type === 'away' ? { borderColor: '#ef4444' } :
                { borderColor: '#fbbf24' }
          ]}>
            {userPrediction.prediction.type === 'home' ? (
              <Image source={{ uri: match.homeLogo }} style={styles.pinnedLogo} />
            ) : userPrediction.prediction.type === 'away' ? (
              <Image source={{ uri: match.awayLogo }} style={styles.pinnedLogo} />
            ) : (
              <Text style={[styles.pinnedDrawText, { color: '#fbbf24' }]}>X</Text>
            )}
            <View style={styles.pinIconBadge}>
              <Pin size={10} color="#fff" fill="#fff" />
            </View>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.leagueInfo}>
          {match.leagueLogo && (
            <Image source={{ uri: match.leagueLogo }} style={styles.leagueLogo} />
          )}
          <Text style={styles.leagueName}>{match.league}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              isNotificationEnabled && styles.notificationButtonActive
            ]}
            onPress={handleToggleNotification}
            activeOpacity={0.7}
          >
            <Star
              size={18}
              color={isNotificationEnabled ? '#fbbf24' : '#666'}
              fill={isNotificationEnabled ? '#fbbf24' : 'transparent'}
              strokeWidth={2}
            />
          </TouchableOpacity>

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        </View>
      </View>

      {/* Match Content */}
      <View style={styles.matchContent}>
        <View style={styles.team}>
          <Image source={{ uri: match.homeLogo }} style={styles.teamLogo} />
          <Text style={styles.teamName}>{match.homeTeam}</Text>
        </View>

        <View style={styles.centerArea}>
          {match.status === 'finished' ? (
            <View style={styles.scoreContainer}>
              <Text style={styles.score}>{match.homeScore}</Text>
              <Text style={styles.scoreDivider}>-</Text>
              <Text style={styles.score}>{match.awayScore}</Text>
            </View>
          ) : match.status === 'live' ? (
            <View style={styles.liveContainer}>
              <Text style={styles.liveScore}>{match.homeScore || 0}</Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
                {match.minute && (
                  <Text style={styles.liveMinute}>{match.minute}'</Text>
                )}
              </View>
              <Text style={styles.liveScore}>{match.awayScore || 0}</Text>
            </View>
          ) : showPrediction && match.status === 'upcoming' ? (
            <View style={styles.predictionArea}>
              {!userPrediction ? (
                <TouchableOpacity
                  style={styles.predictButton}
                  onPress={() => setShowPredictionModal(true)}
                  activeOpacity={0.8}
                >
                  <Target size={16} color="#fff" />
                  <Text style={styles.predictButtonText}>{t.predictions.predict}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.userPrediction}>
                  <Text style={styles.predictionLabel}>{t.predictions.yourPrediction}</Text>
                  <Text style={styles.predictionText}>
                    {userPrediction.prediction.type === 'home' ? `${t.predictions.homeWin} ${match.homeTeam}` :
                      userPrediction.prediction.type === 'away' ? `${t.predictions.awayWin} ${match.awayTeam}` : t.predictions.draw}
                  </Text>
                  {userPrediction.points && (
                    <View style={styles.pointsBadge}>
                      <Award size={12} color="#000" />
                      <Text style={styles.pointsText}>+{userPrediction.points}</Text>
                    </View>
                  )}
                </View>
              )}
              {/* Prediction Count Placeholder */}
              <View style={styles.predictionStats}>
                <Users size={12} color="#666" />
                <Text style={styles.predictionCountText}>12.5k {t.leagues.predictions || 'Predictions'}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.timeContainer}>
              <Clock size={16} color="#666" />
              <Text style={styles.matchTime}>{match.time}</Text>
            </View>
          )}
        </View>

        <View style={styles.team}>
          <Image source={{ uri: match.awayLogo }} style={styles.teamLogo} />
          <Text style={styles.teamName}>{match.awayTeam}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.dateInfo}>
          <Calendar size={14} color="#666" />
          <Text style={styles.dateText}>{match.date}</Text>
          {match.venue && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.venueText}>{match.venue}</Text>
            </>
          )}
        </View>

        {match.prediction && match.status === 'finished' && (
          <View style={styles.predictionResult}>
            <TrendingUp size={14} color={match.prediction.isCorrect ? '#22c55e' : '#ff4444'} />
            <Text style={[
              styles.resultText,
              { color: match.prediction.isCorrect ? '#22c55e' : '#ff4444' }
            ]}>
              {match.prediction.isCorrect ? t.predictions.correctPrediction : t.predictions.wrongPrediction}
            </Text>
          </View>
        )}
      </View>

      {/* Prediction Modal */}
      <Modal
        visible={showPredictionModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowPredictionModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <BlurView intensity={80} tint="dark" style={styles.modalBlurOverlay}>
            <Animated.View
              style={[
                styles.modalWrapper,
                {
                  transform: [{ scale: modalScaleAnim }],
                  opacity: modalScaleAnim,
                }
              ]}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t.predictions.choosePrediction}</Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setShowPredictionModal(false)}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.predictionOptions}>
                  {/* Home Win */}
                  <TouchableOpacity
                    style={[
                      styles.predictionOption,
                      selectedPrediction === 'home' && styles.selectedOption,
                      { borderColor: '#3b82f6' }
                    ]}
                    onPress={() => setSelectedPrediction('home')}
                  >
                    <Image source={{ uri: match.homeLogo }} style={styles.optionLogo} />
                    <Text style={styles.optionText}>{t.predictions.homeWin}</Text>
                    {selectedPrediction === 'home' && (
                      <View style={styles.checkIcon}>
                        <CheckCircle size={20} color="#3b82f6" />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Draw */}
                  <TouchableOpacity
                    style={[
                      styles.predictionOption,
                      selectedPrediction === 'draw' && styles.selectedOption,
                      { borderColor: '#fbbf24' }
                    ]}
                    onPress={() => setSelectedPrediction('draw')}
                  >
                    <View style={styles.drawIcon}>
                      <Text style={styles.drawText}>X</Text>
                    </View>
                    <Text style={styles.optionText}>{t.predictions.draw}</Text>
                    {selectedPrediction === 'draw' && (
                      <View style={styles.checkIcon}>
                        <CheckCircle size={20} color="#fbbf24" />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Away Win */}
                  <TouchableOpacity
                    style={[
                      styles.predictionOption,
                      selectedPrediction === 'away' && styles.selectedOption,
                      { borderColor: '#ef4444' }
                    ]}
                    onPress={() => setSelectedPrediction('away')}
                  >
                    <Image source={{ uri: match.awayLogo }} style={styles.optionLogo} />
                    <Text style={styles.optionText}>{t.predictions.awayWin}</Text>
                    {selectedPrediction === 'away' && (
                      <View style={styles.checkIcon}>
                        <CheckCircle size={20} color="#ef4444" />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    !selectedPrediction && styles.submitButtonDisabled
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
    </Animated.View >
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  leagueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leagueLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  leagueName: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  notificationButtonActive: {
    backgroundColor: '#fbbf2415',
    borderColor: '#fbbf2450',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  matchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  team: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  teamLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  teamName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  score: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  scoreDivider: {
    fontSize: 24,
    color: '#666',
  },
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  liveScore: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff4444',
  },
  liveIndicator: {
    flexDirection: 'column', // Changed to column to stack LIVE and minute
    alignItems: 'center',
    gap: 2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
  },
  liveText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '700',
  },
  liveMinute: {
    color: '#ff4444',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  matchTime: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  predictionArea: {
    alignItems: 'center',
    width: '100%',
  },
  predictButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6', // Changed to match prediction counter blue
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  predictButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  userPrediction: {
    alignItems: 'center',
    gap: 4,
  },
  predictionLabel: {
    color: '#888',
    fontSize: 10,
  },
  predictionText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbbf24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  pointsText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: '#666',
    fontSize: 12,
  },
  separator: {
    color: '#666',
    fontSize: 12,
  },
  venueText: {
    color: '#666',
    fontSize: 12,
  },
  predictionResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalBlurOverlay: {
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
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    color: '#666',
    fontSize: 20,
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
    padding: 12,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedOption: {
    backgroundColor: '#2a2a2a',
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
    top: -8,
    right: -8,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
  },
  submitButton: {
    backgroundColor: '#22c55e',
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
  pinnedPrediction: {
    position: 'absolute',
    top: -8,
    right: 10,
    zIndex: 10,
  },
  pinnedContent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  pinnedLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  pinnedDrawText: {
    fontSize: 18,
    fontWeight: '900',
  },
  pinIconBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#3b82f6',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1a1a1a',
  },
  predictionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  predictionCountText: {
    color: '#666',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default React.memo(MatchCard);
