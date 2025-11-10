import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { 
  Eye,
  ThumbsUp,
  Target,
  Star,
  BarChart3,
  TrendingUp,
  Calendar,
  Users,
  MessageCircle,
  Share,
  Download,
  Play,
  Award,
  Trophy,
  Crown,
  Activity,
  Zap,
  Clock,
  CheckCircle
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFadeIn, useSlideIn, useStagger } from '../leagues/Animations';
import { useHapticFeedback } from '../leagues/HapticFeedback';

const { width } = Dimensions.get('window');

export interface DashboardStats {
  views: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    trend: 'up' | 'down' | 'stable';
  };
  likes: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    trend: 'up' | 'down' | 'stable';
  };
  questionsSolved: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    trend: 'up' | 'down' | 'stable';
  };
  rating: {
    average: number;
    totalRatings: number;
    trend: 'up' | 'down' | 'stable';
  };
  posts: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    trend: 'up' | 'down' | 'stable';
  };
  predictions: {
    total: number;
    accuracy: number;
    thisWeek: number;
    trend: 'up' | 'down' | 'stable';
  };
  interactions: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    trend: 'up' | 'down' | 'stable';
  };
  level: {
    current: number;
    experience: number;
    nextLevel: number;
    progress: number;
  };
}

interface DashboardProps {
  stats: DashboardStats;
  onStatPress?: (statType: string) => void;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  onPress?: () => void;
  delay?: number;
}> = ({ title, value, subtitle, icon, trend, trendValue, onPress, delay = 0 }) => {
  const fadeAnim = useFadeIn(600 + delay);
  const slideAnim = useSlideIn('up', 500 + delay);
  const haptic = useHapticFeedback();

  const handlePress = () => {
    haptic.cardTap();
    onPress?.();
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return '#22c55e';
      case 'down': return '#ef4444';
      case 'stable': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp size={12} color="#22c55e" />;
      case 'down': return <TrendingUp size={12} color="#ef4444" style={{ transform: [{ rotate: '180deg' }] }} />;
      case 'stable': return <Activity size={12} color="#6b7280" />;
      default: return null;
    }
  };

  return (
    <Animated.View 
      style={[
        styles.statCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.statCardContent}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.statHeader}>
          <View style={styles.statIconContainer}>
            {icon}
          </View>
          {trend && (
            <View style={styles.trendContainer}>
              {getTrendIcon()}
              {trendValue && (
                <Text style={[styles.trendText, { color: getTrendColor() }]}>
                  {trendValue}
                </Text>
              )}
            </View>
          )}
        </View>
        
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
        {subtitle && (
          <Text style={styles.statSubtitle}>{subtitle}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const ProgressBar: React.FC<{
  progress: number;
  label: string;
  color?: string;
}> = ({ progress, label, color = '#B9F2FF' }) => {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{Math.round(progress)}%</Text>
      </View>
      <View style={styles.progressBar}>
        <Animated.View 
          style={[
            styles.progressFill,
            { 
              width: progressWidth,
              backgroundColor: color
            }
          ]} 
        />
      </View>
    </View>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ stats, onStatPress }) => {
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('up', 600);

  const handleStatPress = (statType: string) => {
    haptic.buttonPress();
    onStatPress?.(statType);
  };

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.headerContent}>
          <Crown size={32} color="#B9F2FF" />
          <Text style={styles.headerTitle}>لوحة الإحصائيات</Text>
          <Text style={styles.headerSubtitle}>تتبع أداءك وتطورك في التطبيق</Text>
        </View>
      </Animated.View>

      {/* Main Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          title="المشاهدات"
          value={stats.views.total.toLocaleString()}
          subtitle={`${stats.views.thisWeek} هذا الأسبوع`}
          icon={<Eye size={24} color="#B9F2FF" />}
          trend={stats.views.trend}
          trendValue="+12%"
          onPress={() => handleStatPress('views')}
          delay={0}
        />
        
        <StatCard
          title="الإعجابات"
          value={stats.likes.total.toLocaleString()}
          subtitle={`${stats.likes.thisWeek} هذا الأسبوع`}
          icon={<ThumbsUp size={24} color="#B9F2FF" />}
          trend={stats.likes.trend}
          trendValue="+8%"
          onPress={() => handleStatPress('likes')}
          delay={100}
        />
        
        <StatCard
          title="الأسئلة المحلولة"
          value={stats.questionsSolved.total}
          subtitle={`${stats.questionsSolved.thisWeek} هذا الأسبوع`}
          icon={<Target size={24} color="#B9F2FF" />}
          trend={stats.questionsSolved.trend}
          trendValue="+15%"
          onPress={() => handleStatPress('questions')}
          delay={200}
        />
        
        <StatCard
          title="التقييم"
          value={`${stats.rating.average}/5`}
          subtitle={`${stats.rating.totalRatings} تقييم`}
          icon={<Star size={24} color="#B9F2FF" />}
          trend={stats.rating.trend}
          trendValue="+0.2"
          onPress={() => handleStatPress('rating')}
          delay={300}
        />
        
        <StatCard
          title="المنشورات"
          value={stats.posts.total}
          subtitle={`${stats.posts.thisWeek} هذا الأسبوع`}
          icon={<Share size={24} color="#B9F2FF" />}
          trend={stats.posts.trend}
          trendValue="+5%"
          onPress={() => handleStatPress('posts')}
          delay={400}
        />
        
        <StatCard
          title="التوقعات"
          value={`${stats.predictions.accuracy}%`}
          subtitle={`${stats.predictions.total} توقع`}
          icon={<BarChart3 size={24} color="#B9F2FF" />}
          trend={stats.predictions.trend}
          trendValue="+3%"
          onPress={() => handleStatPress('predictions')}
          delay={500}
        />
      </View>

      {/* Level Progress */}
      <Animated.View 
        style={[
          styles.levelSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.levelHeader}>
          <Trophy size={24} color="#FFD700" />
          <Text style={styles.levelTitle}>المستوى الحالي</Text>
        </View>
        
        <View style={styles.levelInfo}>
          <Text style={styles.levelNumber}>{stats.level.current}</Text>
          <Text style={styles.levelText}>المستوى</Text>
        </View>
        
        <ProgressBar
          progress={stats.level.progress}
          label={`التقدم للمستوى ${stats.level.nextLevel}`}
          color="#FFD700"
        />
        
        <View style={styles.experienceInfo}>
          <Text style={styles.experienceText}>
            {stats.level.experience} نقطة خبرة
          </Text>
        </View>
      </Animated.View>

      {/* Weekly Summary */}
      <Animated.View 
        style={[
          styles.summarySection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.summaryHeader}>
          <Calendar size={24} color="#B9F2FF" />
          <Text style={styles.summaryTitle}>ملخص هذا الأسبوع</Text>
        </View>
        
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{stats.views.thisWeek}</Text>
            <Text style={styles.summaryLabel}>مشاهدة</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{stats.likes.thisWeek}</Text>
            <Text style={styles.summaryLabel}>إعجاب</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{stats.questionsSolved.thisWeek}</Text>
            <Text style={styles.summaryLabel}>سؤال محلول</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{stats.posts.thisWeek}</Text>
            <Text style={styles.summaryLabel}>منشور</Text>
          </View>
        </View>
      </Animated.View>

      {/* Achievements */}
      <Animated.View 
        style={[
          styles.achievementsSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.achievementsHeader}>
          <Award size={24} color="#FFD700" />
          <Text style={styles.achievementsTitle}>الإنجازات الأخيرة</Text>
        </View>
        
        <View style={styles.achievementsList}>
          <View style={styles.achievementItem}>
            <CheckCircle size={20} color="#22c55e" />
            <Text style={styles.achievementText}>حل 100 سؤال</Text>
          </View>
          <View style={styles.achievementItem}>
            <CheckCircle size={20} color="#22c55e" />
            <Text style={styles.achievementText}>وصول 1000 مشاهدة</Text>
          </View>
          <View style={styles.achievementItem}>
            <CheckCircle size={20} color="#22c55e" />
            <Text style={styles.achievementText}>تقييم 5 نجوم</Text>
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#B9F2FF',
    textAlign: 'center',
    opacity: 0.8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 30,
  },
  statCard: {
    width: (width - 55) / 2,
    backgroundColor: '#1a1f2e',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  statCardContent: {
    padding: 20,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  statIconContainer: {
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
    borderRadius: 10,
    padding: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  statTitle: {
    fontSize: 14,
    color: '#B9F2FF',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    opacity: 0.8,
  },
  levelSection: {
    backgroundColor: '#1a1f2e',
    borderRadius: 20,
    padding: 25,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  levelInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  levelNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  levelText: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 15,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  progressValue: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  experienceInfo: {
    alignItems: 'center',
  },
  experienceText: {
    fontSize: 14,
    color: '#94a3b8',
    opacity: 0.8,
  },
  summarySection: {
    backgroundColor: '#1a1f2e',
    borderRadius: 20,
    padding: 25,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.2)',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B9F2FF',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#B9F2FF',
    opacity: 0.8,
  },
  achievementsSection: {
    backgroundColor: '#1a1f2e',
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  achievementsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  achievementsList: {
    gap: 15,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  achievementText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default Dashboard;
