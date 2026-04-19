import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Trophy, Target, TrendingUp, Award, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface StatsHeaderProps {
  totalCoins: number;
  accuracy: number;
  bestStreak: number;
  currentStreak: number;
  totalPredictions: number;
  correctPredictions: number;
}

const StatsHeader: React.FC<StatsHeaderProps> = ({
  totalCoins,
  accuracy,
  bestStreak,
  currentStreak,
  totalPredictions,
  correctPredictions,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const coinAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Coin pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(coinAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(coinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Main Coins Card */}
      <View style={styles.coinsCard}>
        <LinearGradient
          colors={['#fbbf24', '#f59e0b', '#d97706']}
          style={styles.coinsGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.coinsContent}>
            <Animated.Text
              style={[
                styles.coinIcon,
                { transform: [{ scale: coinAnim }] },
              ]}
            >
              💰
            </Animated.Text>
            <View style={styles.coinsInfo}>
              <Text style={styles.coinsValue}>{totalCoins}</Text>
              <Text style={styles.coinsLabel}>عملة ذهبية</Text>
            </View>
          </View>
          <View style={styles.coinsShadow} />
        </LinearGradient>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Accuracy */}
        <View style={styles.statCard}>
          <LinearGradient
            colors={['rgba(34, 197, 94, 0.15)', 'rgba(34, 197, 94, 0.05)']}
            style={styles.statGradient}
          >
            <View style={styles.statIconWrapper}>
              <Target size={20} color="#22c55e" />
            </View>
            <Text style={styles.statValue}>{accuracy}%</Text>
            <Text style={styles.statLabel}>نسبة النجاح</Text>
          </LinearGradient>
        </View>

        {/* Best Streak */}
        <View style={styles.statCard}>
          <LinearGradient
            colors={['rgba(251, 191, 36, 0.15)', 'rgba(251, 191, 36, 0.05)']}
            style={styles.statGradient}
          >
            <View style={styles.statIconWrapper}>
              <Zap size={20} color="#fbbf24" />
            </View>
            <Text style={styles.statValue}>{bestStreak}</Text>
            <Text style={styles.statLabel}>أفضل سلسلة</Text>
          </LinearGradient>
        </View>

        {/* Current Streak */}
        <View style={styles.statCard}>
          <LinearGradient
            colors={['rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.05)']}
            style={styles.statGradient}
          >
            <View style={styles.statIconWrapper}>
              <TrendingUp size={20} color="#3b82f6" />
            </View>
            <Text style={styles.statValue}>{currentStreak}</Text>
            <Text style={styles.statLabel}>السلسلة الحالية</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Predictions Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalPredictions}</Text>
          <Text style={styles.summaryLabel}>إجمالي التوقعات</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#22c55e' }]}>
            {correctPredictions}
          </Text>
          <Text style={styles.summaryLabel}>توقعات صحيحة</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  coinsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  coinsGradient: {
    padding: 20,
    position: 'relative',
  },
  coinsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  coinIcon: {
    fontSize: 48,
  },
  coinsInfo: {
    flex: 1,
  },
  coinsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  coinsLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  coinsShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statGradient: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#888',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
  },
});

export default StatsHeader;
