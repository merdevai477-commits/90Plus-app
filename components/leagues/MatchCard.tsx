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
  TextInput,
} from 'react-native';
import { 
  Calendar, 
  Clock, 
  Trophy,
  Target,
  TrendingUp,
  Star,
  Zap,
  Award
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

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
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  onPredictionSubmit,
  showPrediction = false,
  userPredictions = {}
}) => {
  const [selectedPrediction, setSelectedPrediction] = useState<'home' | 'draw' | 'away' | null>(null);
  const [homeGoals, setHomeGoals] = useState('');
  const [awayGoals, setAwayGoals] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      })
    ]).start();
  }, []);

  const getStatusColor = () => {
    switch(match.status) {
      case 'live': return '#ff4444';
      case 'finished': return '#22c55e';
      case 'upcoming': return '#3b82f6';
      default: return '#666';
    }
  };

  const getStatusText = () => {
    switch(match.status) {
      case 'live': return 'مباشر';
      case 'finished': return 'انتهت';
      case 'upcoming': return 'لم تبدأ';
      default: return '';
    }
  };

  const handlePredictionSelect = (type: 'home' | 'draw' | 'away') => {
    if (match.status !== 'upcoming') return;
    
    setSelectedPrediction(type);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 8,
      })
    ]).start();
  };

  const handleSubmitPrediction = async () => {
    if (!selectedPrediction || !homeGoals || !awayGoals) {
      Alert.alert('خطأ', 'يرجى اختيار التوقع وإدخال عدد الأهداف');
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Animation for submission
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]),
      { iterations: 3 }
    ).start();

    try {
      await onPredictionSubmit(match.id, {
        type: selectedPrediction,
        homeScore: parseInt(homeGoals),
        awayScore: parseInt(awayGoals),
        points: calculatePoints(selectedPrediction, parseInt(homeGoals), parseInt(awayGoals))
      });
      
      Alert.alert('تم!', 'تم تسجيل توقعك بنجاح');
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ في تسجيل التوقع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatePoints = (type: string, homeScore: number, awayScore: number) => {
    // نظام النقاط المعقد
    let basePoints = 10;
    
    if (type === 'home' && homeScore > awayScore) basePoints += 20;
    else if (type === 'away' && awayScore > homeScore) basePoints += 20;
    else if (type === 'draw' && homeScore === awayScore) basePoints += 25;
    
    // نقاط إضافية للدقة في التوقع
    if (homeScore === match.homeScore && awayScore === match.awayScore) basePoints += 50;
    
    return basePoints;
  };

  const getPredictionColor = (type: string) => {
    if (selectedPrediction === type) {
      switch(type) {
        case 'home': return '#22c55e';
        case 'draw': return '#3b82f6';
        case 'away': return '#f59e0b';
        default: return '#666';
      }
    }
    return '#333';
  };

  const userPrediction = userPredictions[match.id];

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ]
        }
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.leagueInfo}>
          {match.leagueLogo && (
            <Image source={{ uri: match.leagueLogo }} style={styles.leagueLogo} />
          )}
          <Text style={styles.leagueName}>{match.league}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      {/* Match Content */}
      <View style={styles.matchContent}>
        {/* Home Team */}
        <View style={styles.team}>
          <Image source={{ uri: match.homeLogo }} style={styles.teamLogo} />
          <Text style={styles.teamName}>{match.homeTeam}</Text>
          {match.odds && (
            <Text style={styles.odds}>{match.odds.home}</Text>
          )}
        </View>

        {/* Score/Prediction Area */}
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
              </View>
              <Text style={styles.liveScore}>{match.awayScore || 0}</Text>
            </View>
          ) : showPrediction ? (
            <View style={styles.predictionArea}>
              {!userPrediction ? (
                <>
                  <View style={styles.goalsInput}>
                    <TextInput
                      style={styles.goalInput}
                      value={homeGoals}
                      onChangeText={setHomeGoals}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#666"
                      maxLength={2}
                    />
                    <Text style={styles.goalDivider}>:</Text>
                    <TextInput
                      style={styles.goalInput}
                      value={awayGoals}
                      onChangeText={setAwayGoals}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#666"
                      maxLength={2}
                    />
                  </View>
                  
                  <View style={styles.predictionButtons}>
                    <TouchableOpacity
                      style={[
                        styles.predictionButton,
                        { backgroundColor: getPredictionColor('home') }
                      ]}
                      onPress={() => handlePredictionSelect('home')}
                    >
                      <Text style={styles.predictionButtonText}>فوز</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.predictionButton,
                        { backgroundColor: getPredictionColor('draw') }
                      ]}
                      onPress={() => handlePredictionSelect('draw')}
                    >
                      <Text style={styles.predictionButtonText}>تعادل</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.predictionButton,
                        { backgroundColor: getPredictionColor('away') }
                      ]}
                      onPress={() => handlePredictionSelect('away')}
                    >
                      <Text style={styles.predictionButtonText}>خسارة</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, { opacity: selectedPrediction ? 1 : 0.5 }]}
                    onPress={handleSubmitPrediction}
                    disabled={!selectedPrediction || isSubmitting}
                  >
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                      <Target size={16} color="#000" />
                      <Text style={styles.submitButtonText}>
                        {isSubmitting ? 'جاري الحفظ...' : 'توقع الآن'}
                      </Text>
                    </Animated.View>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.userPrediction}>
                  <Text style={styles.predictionLabel}>توقعك:</Text>
                  <Text style={styles.predictionText}>
                    {userPrediction.homeScore} - {userPrediction.awayScore}
                  </Text>
                  {userPrediction.points && (
                    <View style={styles.pointsBadge}>
                      <Award size={12} color="#000" />
                      <Text style={styles.pointsText}>+{userPrediction.points}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.timeContainer}>
              <Clock size={16} color="#666" />
              <Text style={styles.matchTime}>{match.time}</Text>
            </View>
          )}
        </View>

        {/* Away Team */}
        <View style={styles.team}>
          <Image source={{ uri: match.awayLogo }} style={styles.teamLogo} />
          <Text style={styles.teamName}>{match.awayTeam}</Text>
          {match.odds && (
            <Text style={styles.odds}>{match.odds.away}</Text>
          )}
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
              {match.prediction.isCorrect ? 'توقع صحيح!' : 'توقع خاطئ'}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    marginBottom: 15,
    padding: 20,
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
  odds: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    gap: 15,
  },
  goalsInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalInput: {
    width: 40,
    height: 40,
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    borderWidth: 2,
    borderColor: '#333',
  },
  goalDivider: {
    color: '#666',
    fontSize: 20,
    fontWeight: 'bold',
  },
  predictionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  predictionButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  predictionButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  userPrediction: {
    alignItems: 'center',
    gap: 8,
  },
  predictionLabel: {
    color: '#888',
    fontSize: 12,
  },
  predictionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  pointsText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    gap: 5,
  },
  resultText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MatchCard;
