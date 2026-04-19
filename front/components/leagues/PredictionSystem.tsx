import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { 
  Target, 
  Trophy, 
  Star, 
  Zap, 
  Award,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export interface Prediction {
  id: string;
  matchId: string;
  userId: string;
  type: 'win' | 'draw' | 'lose';
  homeScore: number;
  awayScore: number;
  points: number;
  isCorrect?: boolean;
  submittedAt: Date;
  matchResult?: {
    homeScore: number;
    awayScore: number;
  };
}

export interface UserStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  totalPoints: number;
  streak: number;
  rank: number;
  level: number;
}

interface PredictionSystemProps {
  predictions: Prediction[];
  userStats: UserStats;
  onPredictionSubmit: (prediction: Omit<Prediction, 'id' | 'submittedAt'>) => void;
  onPredictionUpdate: (predictionId: string, updates: Partial<Prediction>) => void;
}

const PredictionSystem: React.FC<PredictionSystemProps> = ({
  predictions,
  userStats,
  onPredictionSubmit,
  onPredictionUpdate,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [showStats, setShowStats] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
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

  const getFilteredPredictions = () => {
    switch(selectedFilter) {
      case 'correct':
        return predictions.filter(p => p.isCorrect === true);
      case 'incorrect':
        return predictions.filter(p => p.isCorrect === false);
      default:
        return predictions;
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return '#22c55e';
    if (accuracy >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getLevelColor = (level: number) => {
    if (level >= 10) return '#8b5cf6';
    if (level >= 5) return '#3b82f6';
    return '#22c55e';
  };

  const handleFilterChange = (filter: 'all' | 'correct' | 'incorrect') => {
    setSelectedFilter(filter);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
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

  const toggleStats = () => {
    setShowStats(!showStats);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

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
      {/* Stats Header */}
      <TouchableOpacity 
        style={styles.statsHeader}
        onPress={toggleStats}
        activeOpacity={0.8}
      >
        <View style={styles.statsInfo}>
          <View style={styles.levelBadge}>
            <Trophy size={16} color="#fff" />
            <Text style={styles.levelText}>المستوى {userStats.level}</Text>
          </View>
          <Text style={styles.rankText}>المركز #{userStats.rank}</Text>
        </View>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userStats.accuracy}%</Text>
            <Text style={styles.statLabel}>الدقة</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userStats.totalPoints}</Text>
            <Text style={styles.statLabel}>النقاط</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userStats.streak}</Text>
            <Text style={styles.statLabel}>السلسلة</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded Stats */}
      {showStats && (
        <Animated.View style={styles.expandedStats}>
          <View style={styles.detailedStats}>
            <View style={styles.detailedStatItem}>
              <Target size={20} color="#22c55e" />
              <View style={styles.statDetails}>
                <Text style={styles.statTitle}>إجمالي التوقعات</Text>
                <Text style={styles.statNumber}>{userStats.totalPredictions}</Text>
              </View>
            </View>
            
            <View style={styles.detailedStatItem}>
              <CheckCircle size={20} color="#22c55e" />
              <View style={styles.statDetails}>
                <Text style={styles.statTitle}>توقعات صحيحة</Text>
                <Text style={styles.statNumber}>{userStats.correctPredictions}</Text>
              </View>
            </View>
            
            <View style={styles.detailedStatItem}>
              <TrendingUp size={20} color={getAccuracyColor(userStats.accuracy)} />
              <View style={styles.statDetails}>
                <Text style={styles.statTitle}>معدل الدقة</Text>
                <Text style={[styles.statNumber, { color: getAccuracyColor(userStats.accuracy) }]}>
                  {userStats.accuracy}%
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'all' && styles.activeFilterTab]}
          onPress={() => handleFilterChange('all')}
        >
          <Text style={[styles.filterTabText, selectedFilter === 'all' && styles.activeFilterTabText]}>
            الكل
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'correct' && styles.activeFilterTab]}
          onPress={() => handleFilterChange('correct')}
        >
          <CheckCircle size={16} color={selectedFilter === 'correct' ? '#fff' : '#666'} />
          <Text style={[styles.filterTabText, selectedFilter === 'correct' && styles.activeFilterTabText]}>
            الصحيحة
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'incorrect' && styles.activeFilterTab]}
          onPress={() => handleFilterChange('incorrect')}
        >
          <XCircle size={16} color={selectedFilter === 'incorrect' ? '#fff' : '#666'} />
          <Text style={[styles.filterTabText, selectedFilter === 'incorrect' && styles.activeFilterTabText]}>
            الخاطئة
          </Text>
        </TouchableOpacity>
      </View>

      {/* Predictions List */}
      <View style={styles.predictionsList}>
        {getFilteredPredictions().map((prediction, index) => (
          <PredictionItem 
            key={prediction.id} 
            prediction={prediction} 
            index={index}
          />
        ))}
        
        {getFilteredPredictions().length === 0 && (
          <View style={styles.emptyState}>
            <Target size={48} color="#666" />
            <Text style={styles.emptyStateText}>
              {selectedFilter === 'all' ? 'لا توجد توقعات بعد' : 
               selectedFilter === 'correct' ? 'لا توجد توقعات صحيحة' : 
               'لا توجد توقعات خاطئة'}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// Prediction Item Component
const PredictionItem: React.FC<{ prediction: Prediction; index: number }> = ({ 
  prediction, 
  index 
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      })
    ]).start();
  }, [index]);

  const getPredictionTypeText = (type: string) => {
    switch(type) {
      case 'win': return 'فوز';
      case 'draw': return 'تعادل';
      case 'lose': return 'خسارة';
      default: return type;
    }
  };

  const getPredictionTypeColor = (type: string) => {
    switch(type) {
      case 'win': return '#22c55e';
      case 'draw': return '#3b82f6';
      case 'lose': return '#f59e0b';
      default: return '#666';
    }
  };

  return (
    <Animated.View 
      style={[
        styles.predictionItem,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.predictionHeader}>
        <View style={styles.predictionType}>
          <View style={[
            styles.typeBadge,
            { backgroundColor: getPredictionTypeColor(prediction.type) }
          ]}>
            <Text style={styles.typeText}>
              {getPredictionTypeText(prediction.type)}
            </Text>
          </View>
          <Text style={styles.predictionScore}>
            {prediction.homeScore} - {prediction.awayScore}
          </Text>
        </View>
        
        <View style={styles.predictionResult}>
          {prediction.isCorrect !== undefined && (
            <View style={[
              styles.resultBadge,
              { backgroundColor: prediction.isCorrect ? '#22c55e' : '#ef4444' }
            ]}>
              {prediction.isCorrect ? (
                <CheckCircle size={14} color="#fff" />
              ) : (
                <XCircle size={14} color="#fff" />
              )}
              <Text style={styles.resultText}>
                {prediction.isCorrect ? 'صحيح' : 'خاطئ'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.predictionFooter}>
        <View style={styles.pointsContainer}>
          <Award size={14} color="#22c55e" />
          <Text style={styles.pointsText}>+{prediction.points} نقطة</Text>
        </View>
        
        <Text style={styles.dateText}>
          {new Date(prediction.submittedAt).toLocaleDateString('ar-SA')}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    marginBottom: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  statsHeader: {
    marginBottom: 15,
  },
  statsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  levelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  rankText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  expandedStats: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  detailedStats: {
    gap: 12,
  },
  detailedStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statDetails: {
    flex: 1,
  },
  statTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 2,
  },
  statNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderRadius: 15,
    padding: 4,
    marginBottom: 15,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 5,
  },
  activeFilterTab: {
    backgroundColor: '#22c55e',
  },
  filterTabText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterTabText: {
    color: '#fff',
  },
  predictionsList: {
    gap: 10,
  },
  predictionItem: {
    backgroundColor: '#0a0a0a',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  predictionType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  predictionScore: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  predictionResult: {
    alignItems: 'flex-end',
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  resultText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  predictionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pointsText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
  },
  dateText: {
    color: '#666',
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default PredictionSystem;
