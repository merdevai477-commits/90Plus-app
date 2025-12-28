import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  FlatList,
  Vibration,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  InteractionManager,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import {
  Trophy,
  Eye,
  MessageCircle,
  Share2,
  Brain,
  Star,
  Clock,
  Calendar,
  Bell,
  Heart,
  TrendingUp,
  Medal,
  Crown,
  Award,
  Target,
  ChevronRight,
  Filter,
  Search,
  Users,
  X,
  BarChart3,
  Activity,
  Zap,
  Shield,
  UserCheck,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { useLanguage } from '../../contexts/LanguageContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Constants
const ANIMATION_DURATION = 400;
const HAPTIC_FEEDBACK_ENABLED = Platform.OS === 'ios';
const DEFAULT_AVATAR = 'https://via.placeholder.com/150/22c55e/ffffff?text=User';
const DEFAULT_TEAM_LOGO = 'https://via.placeholder.com/100/22c55e/ffffff?text=Team';

// Custom Layout Animation
const customLayoutAnimation = {
  duration: 300,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

// Types
interface RankedUser {
  id: string;
  name: string;
  avatar: string;
  score: number;
  rank: number;
  badge?: 'gold' | 'silver' | 'bronze';
  trend?: 'up' | 'down' | 'stable';
  stats?: {
    views?: number;
    comments?: number;
    shares?: number;
    quizScore?: number;
  };
  change?: number;
}

interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  number: number;
  avatar: string;
  rating: number;
  stats: {
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    matches: number;
  };
  performance: {
    attack: number;
    defense: number;
    speed: number;
    technique: number;
    physical: number;
  };
  votes: {
    up: number;
    down: number;
    userVote?: 'up' | 'down' | null;
  };
}

interface Match {
  id: string;
  homeTeam: {
    name: string;
    logo: string;
    score?: number;
  };
  awayTeam: {
    name: string;
    logo: string;
    score?: number;
  };
  time: string;
  status: 'upcoming' | 'live' | 'finished';
  predictions?: number;
  isFollowing?: boolean;
}

// Skeleton Component
const SkeletonLoader = memo(() => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View style={[styles.skeleton, { opacity }]}>
      <View style={styles.skeletonHeader} />
      <View style={styles.skeletonContent} />
      <View style={styles.skeletonContent} />
    </Animated.View>
  );
});

// Mock Data
const topViewers: RankedUser[] = [
  {
    id: '1',
    name: 'Ahmed Hassan',
    avatar: 'https://i.pravatar.cc/150?img=1',
    score: 245000,
    rank: 1,
    badge: 'gold',
    trend: 'up',
    stats: { views: 245000 },
    change: 12.5,
  },
  {
    id: '2',
    name: 'Sara Mohamed',
    avatar: 'https://i.pravatar.cc/150?img=2',
    score: 198000,
    rank: 2,
    badge: 'silver',
    trend: 'stable',
    stats: { views: 198000 },
    change: 0,
  },
  {
    id: '3',
    name: 'Omar Ali',
    avatar: 'https://i.pravatar.cc/150?img=3',
    score: 176000,
    rank: 3,
    badge: 'bronze',
    trend: 'down',
    stats: { views: 176000 },
    change: -5.3,
  },
];

const topCommenters: RankedUser[] = [
  {
    id: '4',
    name: 'Youssef Ibrahim',
    avatar: 'https://i.pravatar.cc/150?img=4',
    score: 1520,
    rank: 1,
    badge: 'gold',
    trend: 'up',
    stats: { comments: 1520 },
    change: 8.2,
  },
  {
    id: '5',
    name: 'Layla Ahmed',
    avatar: 'https://i.pravatar.cc/150?img=5',
    score: 1340,
    rank: 2,
    badge: 'silver',
    trend: 'stable',
    stats: { comments: 1340 },
    change: 0,
  },
  {
    id: '6',
    name: 'Karim Mahmoud',
    avatar: 'https://i.pravatar.cc/150?img=6',
    score: 1180,
    rank: 3,
    badge: 'bronze',
    trend: 'up',
    stats: { comments: 1180 },
    change: 3.5,
  },
];

const topSharers: RankedUser[] = [
  {
    id: '7',
    name: 'Mariam Saleh',
    avatar: 'https://i.pravatar.cc/150?img=7',
    score: 890,
    rank: 1,
    badge: 'gold',
    trend: 'up',
    stats: { shares: 890 },
    change: 15.3,
  },
  {
    id: '8',
    name: 'Khaled Omar',
    avatar: 'https://i.pravatar.cc/150?img=8',
    score: 765,
    rank: 2,
    badge: 'silver',
    trend: 'down',
    stats: { shares: 765 },
    change: -2.1,
  },
  {
    id: '9',
    name: 'Nour Hassan',
    avatar: 'https://i.pravatar.cc/150?img=9',
    score: 620,
    rank: 3,
    badge: 'bronze',
    trend: 'stable',
    stats: { shares: 620 },
    change: 0,
  },
];

const topQuizMasters: RankedUser[] = [
  {
    id: '10',
    name: 'Hassan Ali',
    avatar: 'https://i.pravatar.cc/150?img=10',
    score: 9500,
    rank: 1,
    badge: 'gold',
    trend: 'up',
    stats: { quizScore: 9500 },
    change: 5.7,
  },
  {
    id: '11',
    name: 'Fatima Nour',
    avatar: 'https://i.pravatar.cc/150?img=11',
    score: 8900,
    rank: 2,
    badge: 'silver',
    trend: 'up',
    stats: { quizScore: 8900 },
    change: 4.2,
  },
  {
    id: '12',
    name: 'Ali Mohamed',
    avatar: 'https://i.pravatar.cc/150?img=12',
    score: 8100,
    rank: 3,
    badge: 'bronze',
    trend: 'down',
    stats: { quizScore: 8100 },
    change: -1.8,
  },
];

const players: Player[] = [
  {
    id: '1',
    name: 'Mohamed Salah',
    team: 'Liverpool',
    position: 'RW',
    number: 11,
    avatar: 'https://i.pravatar.cc/150?img=11',
    rating: 9.2,
    stats: {
      goals: 18,
      assists: 8,
      yellowCards: 2,
      redCards: 0,
      matches: 25,
    },
    performance: {
      attack: 95,
      defense: 45,
      speed: 92,
      technique: 88,
      physical: 75,
    },
    votes: {
      up: 15234,
      down: 892,
      userVote: null,
    },
  },
  {
    id: '2',
    name: 'Kevin De Bruyne',
    team: 'Manchester City',
    position: 'CAM',
    number: 17,
    avatar: 'https://i.pravatar.cc/150?img=12',
    rating: 9.0,
    stats: {
      goals: 8,
      assists: 14,
      yellowCards: 3,
      redCards: 0,
      matches: 22,
    },
    performance: {
      attack: 88,
      defense: 55,
      speed: 78,
      technique: 94,
      physical: 72,
    },
    votes: {
      up: 12567,
      down: 1024,
      userVote: 'up',
    },
  },
];

// Player Rating Card Component - Redesigned
const PlayerRatingCard = memo(({ player, onVote, t }: { player: Player; onVote: (playerId: string, type: 'up' | 'down') => void; t: any }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleVote = useCallback((type: 'up' | 'down') => {
    onVote(player.id, type);
  }, [player.id, onVote]);

  const approvalRate = Math.round((player.votes.up / (player.votes.up + player.votes.down)) * 100);

  return (
    <Animated.View
      style={[
        styles.playerCard,
        {
          opacity: scaleAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={['#1e293b', '#0f172a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.playerCardGradient}
      >
        {/* Player Header with Avatar */}
        <View style={styles.playerHeader}>
          <View style={styles.playerAvatarContainer}>
            <LinearGradient
              colors={['#22c55e', '#16a34a']}
              style={styles.playerAvatarBorder}
            >
              <Image source={{ uri: player.avatar }} style={styles.playerAvatar} />
            </LinearGradient>
            <View style={styles.playerNumberBadge}>
              <Text style={styles.playerNumber}>#{player.number}</Text>
            </View>
          </View>

          <View style={styles.playerInfoSection}>
            <Text style={styles.playerName}>{player.name}</Text>
            <View style={styles.playerMetaRow}>
              <View style={styles.playerTeamBadge}>
                <Text style={styles.playerTeam}>{player.team}</Text>
              </View>
              <View style={styles.playerPositionBadge}>
                <Text style={styles.playerPosition}>{player.position}</Text>
              </View>
            </View>
            <View style={styles.playerRatingContainer}>
              <Star color="#FFD700" size={18} fill="#FFD700" />
              <Text style={styles.playerRating}>{player.rating}</Text>
              <Text style={styles.playerRatingLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStat}>
            <Zap color="#22c55e" size={16} />
            <Text style={styles.quickStatValue}>{player.stats.goals}</Text>
            <Text style={styles.quickStatLabel}>{t.rank.goals}</Text>
          </View>
          <View style={styles.quickStat}>
            <Target color="#3b82f6" size={16} />
            <Text style={styles.quickStatValue}>{player.stats.assists}</Text>
            <Text style={styles.quickStatLabel}>{t.rank.assists}</Text>
          </View>
          <View style={styles.quickStat}>
            <Shield color="#eab308" size={16} />
            <Text style={styles.quickStatValue}>{player.stats.yellowCards}</Text>
            <Text style={styles.quickStatLabel}>{t.rank.yellow}</Text>
          </View>
          <View style={styles.quickStat}>
            <Activity color="#a855f7" size={16} />
            <Text style={styles.quickStatValue}>{player.stats.matches}</Text>
            <Text style={styles.quickStatLabel}>{t.rank.matches}</Text>
          </View>
        </View>

        {/* Performance Bars - Compact */}
        <View style={styles.performanceSection}>
          <Text style={styles.performanceSectionTitle}>Performance</Text>
          <View style={styles.performanceGrid}>
            {Object.entries(player.performance).map(([key, value]) => (
              <View key={key} style={styles.performanceItem}>
                <View style={styles.performanceHeader}>
                  <Text style={styles.performanceLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                  <Text style={styles.performanceValue}>{value}</Text>
                </View>
                <View style={styles.performanceBarBg}>
                  <LinearGradient
                    colors={
                      value > 80 
                        ? ['#22c55e', '#16a34a'] 
                        : value > 60 
                        ? ['#eab308', '#ca8a04'] 
                        : ['#ef4444', '#dc2626']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.performanceBar, { width: `${value}%` }]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Voting Section - Redesigned */}
        <View style={styles.votingSection}>
          <View style={styles.approvalSection}>
            <Text style={styles.approvalRate}>{approvalRate}%</Text>
            <Text style={styles.approvalLabel}>{t.rank.approval}</Text>
          </View>

          <View style={styles.voteButtons}>
            <TouchableOpacity
              style={[
                styles.voteButton,
                player.votes.userVote === 'up' && styles.voteButtonActiveGreen,
              ]}
              onPress={() => handleVote('up')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={
                  player.votes.userVote === 'up' 
                    ? ['#22c55e', '#16a34a'] 
                    : ['#1e293b', '#0f172a']
                }
                style={styles.voteButtonGradient}
              >
                <ThumbsUp 
                  color={player.votes.userVote === 'up' ? '#fff' : '#666'} 
                  size={18}
                  fill={player.votes.userVote === 'up' ? '#fff' : 'transparent'}
                />
                <Text style={[
                  styles.voteCount,
                  player.votes.userVote === 'up' && styles.voteCountActive,
                ]}>{formatNumber(player.votes.up)}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.voteButton,
                player.votes.userVote === 'down' && styles.voteButtonActiveRed,
              ]}
              onPress={() => handleVote('down')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={
                  player.votes.userVote === 'down' 
                    ? ['#ef4444', '#dc2626'] 
                    : ['#1e293b', '#0f172a']
                }
                style={styles.voteButtonGradient}
              >
                <ThumbsDown 
                  color={player.votes.userVote === 'down' ? '#fff' : '#666'} 
                  size={18}
                  fill={player.votes.userVote === 'down' ? '#fff' : 'transparent'}
                />
                <Text style={[
                  styles.voteCount,
                  player.votes.userVote === 'down' && styles.voteCountActiveRed,
                ]}>{formatNumber(player.votes.down)}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
});

// Redesigned User Card Component
const UserCard = memo(({ item, index, getRankIcon, getTrendIcon, formatNumber, hapticFeedback, t }: any) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      setIsVisible(true);
      Animated.spring(animatedValue, {
        toValue: 1,
        delay: index * 80,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
    hapticFeedback();
  }, [hapticFeedback]);

  if (!isVisible) return <SkeletonLoader />;

  const isTopThree = item.rank <= 3;

  return (
    <Animated.View
      style={[
        styles.userCard,
        {
          opacity: animatedValue,
          transform: [
            {
              translateX: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.userCardContent}
        activeOpacity={1}
        onPress={handlePress}
      >
        <LinearGradient
          colors={
            isTopThree
              ? item.rank === 1
                ? ['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.05)']
                : item.rank === 2
                ? ['rgba(192, 192, 192, 0.15)', 'rgba(192, 192, 192, 0.05)']
                : ['rgba(205, 127, 50, 0.15)', 'rgba(205, 127, 50, 0.05)']
              : ['rgba(34, 197, 94, 0.08)', 'rgba(34, 197, 94, 0.02)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userCardGradient}
        >
          {/* Rank Badge */}
          <View style={[
            styles.rankBadgeNew,
            isTopThree && styles.rankBadgeTopThree,
          ]}>
            {getRankIcon(item.rank)}
          </View>

          {/* User Info */}
          <View style={styles.userInfoSection}>
            <View style={styles.userAvatarWrapper}>
              <LinearGradient
                colors={
                  isTopThree
                    ? item.rank === 1
                      ? ['#FFD700', '#FFA500']
                      : item.rank === 2
                      ? ['#C0C0C0', '#A8A8A8']
                      : ['#CD7F32', '#B8860B']
                    : ['#22c55e', '#16a34a']
                }
                style={styles.userAvatarBorder}
              >
                <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
              </LinearGradient>
              {item.badge && (
                <View style={[styles.badgeIcon, getBadgeStyle(item.badge)]}>
                  <Star color="#fff" size={10} fill="#fff" />
                </View>
              )}
            </View>

            <View style={styles.userDetails}>
              <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.userStatsRow}>
                <View style={styles.scoreContainer}>
                  <Eye color="#22c55e" size={14} strokeWidth={2} />
                  <Text style={styles.userScore}>{formatNumber(item.score)}</Text>
                </View>
                {item.change !== 0 && (
                  <View style={[
                    styles.changeIndicator,
                    item.change > 0 ? styles.changePositive : styles.changeNegative
                  ]}>
                    <TrendingUp 
                      color={item.change > 0 ? '#22c55e' : '#ef4444'} 
                      size={10}
                      style={item.change < 0 && { transform: [{ rotate: '180deg' }] }}
                    />
                    <Text style={[
                      styles.changeText,
                      item.change > 0 ? styles.changeTextPositive : styles.changeTextNegative
                    ]}>
                      {Math.abs(item.change)}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Trend Icon */}
          <View style={styles.trendSection}>
            {getTrendIcon(item.trend)}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

// Optimized Match Card Component
const MatchCard = memo(({ item, index, openPrediction, formatNumber, hapticFeedback }: any) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: 1,
      delay: index * 100,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();

    if (item.status === 'live') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, []);

  return (
    <Animated.View
      style={[
        styles.matchCard,
        {
          opacity: animatedValue,
          transform: [
            {
              translateX: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-SCREEN_WIDTH, 0],
              }),
            },
          ],
        },
      ]}
    >
      {item.status === 'live' && (
        <Animated.View
          style={[
            styles.liveIndicator,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Text style={styles.liveText}>LIVE</Text>
        </Animated.View>
      )}

      <View style={styles.matchContent}>
        <View style={styles.team}>
          <Image source={{ uri: item.homeTeam.logo }} style={styles.teamLogo} resizeMode="contain" />
          <Text style={styles.teamName} numberOfLines={1}>{item.homeTeam.name}</Text>
          {item.homeTeam.score !== undefined && (
            <Text style={styles.teamScore}>{item.homeTeam.score}</Text>
          )}
        </View>

        <View style={styles.matchCenter}>
          <Text style={styles.matchTime}>{item.time}</Text>
          {item.status === 'upcoming' && (
            <TouchableOpacity
              style={styles.predictButton}
              onPress={() => openPrediction(item)}
            >
              <Target color="#22c55e" size={16} />
              <Text style={styles.predictText}>Predict</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.team}>
          <Image source={{ uri: item.awayTeam.logo }} style={styles.teamLogo} resizeMode="contain" />
          <Text style={styles.teamName} numberOfLines={1}>{item.awayTeam.name}</Text>
          {item.awayTeam.score !== undefined && (
            <Text style={styles.teamScore}>{item.awayTeam.score}</Text>
          )}
        </View>
      </View>

      <View style={styles.matchFooter}>
        <View style={styles.matchStats}>
          <Users color="#666" size={12} />
          <Text style={styles.matchStatText}>
            {formatNumber(item.predictions || 0)} predictions
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.followButton, item.isFollowing && styles.followingButton]}
          onPress={hapticFeedback}
        >
          <Bell color={item.isFollowing ? '#22c55e' : '#666'} size={14} />
          <Text style={[styles.followText, item.isFollowing && styles.followingText]}>
            {item.isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// Helper Functions
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const getBadgeStyle = (badge?: string) => {
  switch(badge) {
    case 'gold':
      return styles.badgeGold;
    case 'silver':
      return styles.badgeSilver;
    case 'bronze':
      return styles.badgeBronze;
    default:
      return null;
  }
};

export default function ProRankScreen() {
  const { t, isRTL } = useLanguage();
  
  // Safety check for translations
  if (!t || !t.rank) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }
  
  const [selectedCategory, setSelectedCategory] = useState<'views' | 'comments' | 'shares' | 'quiz'>('views');
  const [selectedTab, setSelectedTab] = useState<'rankings' | 'players'>('rankings');
  const [refreshing, setRefreshing] = useState(false);
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [loading, setLoading] = useState(false);
  const [playersData, setPlayersData] = useState(players);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const headerHeight = useRef(new Animated.Value(200)).current;

  useEffect(() => {
    // Entry animations with better timing
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Trophy rotation animation
    const rotationAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    );
    rotationAnimation.start();

    return () => {
      rotationAnimation.stop();
    };
  }, []);

  const hapticFeedback = useCallback(() => {
    if (HAPTIC_FEEDBACK_ENABLED) {
      Vibration.vibrate(10);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    hapticFeedback();
    LayoutAnimation.configureNext(customLayoutAnimation);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, [hapticFeedback]);

  const getRankIcon = useCallback((rank: number) => {
    switch (rank) {
      case 1:
        return <Crown color="#FFD700" size={20} />;
      case 2:
        return <Medal color="#C0C0C0" size={20} />;
      case 3:
        return <Award color="#CD7F32" size={20} />;
      default:
        return <Text style={styles.rankNumber}>#{rank}</Text>;
    }
  }, []);

  const getTrendIcon = useCallback((trend?: string) => {
    if (trend === 'up') return <TrendingUp color="#22c55e" size={16} />;
    if (trend === 'down') return <TrendingUp color="#ef4444" size={16} style={{ transform: [{ rotate: '180deg' }] }} />;
    return null;
  }, []);

  const handleTabChange = useCallback((tab: 'rankings' | 'players') => {
    LayoutAnimation.configureNext(customLayoutAnimation);
    setSelectedTab(tab);
    hapticFeedback();
  }, [hapticFeedback]);

  const handlePlayerVote = useCallback((playerId: string, type: 'up' | 'down') => {
    hapticFeedback();
    setPlayersData(prev => prev.map(player => {
      if (player.id === playerId) {
        const currentVote = player.votes.userVote;
        let newVotes = { ...player.votes };
        
        if (currentVote === type) {
          // Remove vote
          newVotes.userVote = null;
          newVotes[type] -= 1;
        } else {
          // Add/change vote
          if (currentVote) {
            newVotes[currentVote] -= 1;
          }
          newVotes.userVote = type;
          newVotes[type] += 1;
        }
        
        return { ...player, votes: newVotes };
      }
      return player;
    }));
  }, [hapticFeedback]);

  const openPrediction = useCallback((match: Match) => {
    setSelectedMatch(match);
    setShowPredictionModal(true);
    setHomeScore('');
    setAwayScore('');
    hapticFeedback();
  }, [hapticFeedback]);

  const submitPrediction = useCallback(async () => {
    if (!homeScore || !awayScore) {
      Alert.alert('Invalid Input', 'Please enter scores for both teams');
      return;
    }
    
    setLoading(true);
    hapticFeedback();
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert(
        'Success!', 
        `Your prediction has been submitted: ${homeScore} - ${awayScore}`,
        [{ text: 'OK', onPress: () => setShowPredictionModal(false) }]
      );
      setHomeScore('');
      setAwayScore('');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit prediction. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [homeScore, awayScore, hapticFeedback]);

  const currentData = useMemo(() => {
    switch(selectedCategory) {
      case 'comments':
        return topCommenters;
      case 'shares':
        return topSharers;
      case 'quiz':
        return topQuizMasters;
      default:
        return topViewers;
    }
  }, [selectedCategory]);

  const keyExtractor = useCallback((item: any) => item.id, []);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: headerHeight } } }],
    { useNativeDriver: false }
  );

  return (
    <View style={styles.container}>
      {/* Redesigned Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={['#0a0a0a', '#1a1a1a']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            {/* Header Top with Icon */}
            <View style={styles.headerTop}>
              <View style={styles.headerIconWrapper}>
                <LinearGradient
                  colors={['#22c55e', '#16a34a']}
                  style={styles.headerIconGradient}
                >
                  <Award color="#fff" size={28} strokeWidth={2.5} />
                </LinearGradient>
              </View>
              <View style={styles.headerTextSection}>
                <Text style={styles.headerTitle}>{t.rank.title}</Text>
                <Text style={styles.headerSubtitle}>
                  {isRTL ? 'تنافس، قيّم اللاعبين وتسلق الترتيب' : 'Compete, Rate & Climb'}
                </Text>
              </View>
            </View>

            {/* Tab Switcher - Redesigned */}
            <View style={styles.tabSwitcher}>
              <TouchableOpacity
                style={[styles.tab, selectedTab === 'rankings' && styles.tabActive]}
                onPress={() => handleTabChange('rankings')}
                activeOpacity={0.7}
              >
                {selectedTab === 'rankings' && (
                  <LinearGradient
                    colors={['#22c55e', '#16a34a']}
                    style={styles.tabActiveGradient}
                  />
                )}
                <BarChart3 
                  color={selectedTab === 'rankings' ? '#fff' : '#666'} 
                  size={20} 
                  strokeWidth={2.5}
                />
                <Text style={[styles.tabText, selectedTab === 'rankings' && styles.tabTextActive]}>
                  {t.rank.rankings}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, selectedTab === 'players' && styles.tabActive]}
                onPress={() => handleTabChange('players')}
                activeOpacity={0.7}
              >
                {selectedTab === 'players' && (
                  <LinearGradient
                    colors={['#22c55e', '#16a34a']}
                    style={styles.tabActiveGradient}
                  />
                )}
                <UserCheck 
                  color={selectedTab === 'players' ? '#fff' : '#666'} 
                  size={20}
                  strokeWidth={2.5}
                />
                <Text style={[styles.tabText, selectedTab === 'players' && styles.tabTextActive]}>
                  {t.rank.playerRating}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#22c55e"
            colors={['#22c55e']}
          />
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {selectedTab === 'rankings' ? (
          <>
            {/* Category Selector - Redesigned */}
            <Animated.View
              style={[
                styles.categoryContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {[
                  { key: 'views', icon: Eye, label: t.rank.topViewers, color: '#3b82f6' },
                  { key: 'comments', icon: MessageCircle, label: t.rank.topComments, color: '#a855f7' },
                  { key: 'shares', icon: Share2, label: t.rank.topShares, color: '#f59e0b' },
                  { key: 'quiz', icon: Brain, label: t.rank.quizMasters, color: '#22c55e' },
                ].map((category, idx) => (
                  <TouchableOpacity
                    key={category.key}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category.key && styles.categoryActive
                    ]}
                    onPress={() => {
                      setSelectedCategory(category.key as any);
                      hapticFeedback();
                    }}
                    activeOpacity={0.7}
                  >
                    {selectedCategory === category.key && (
                      <LinearGradient
                        colors={[category.color, `${category.color}CC`]}
                        style={styles.categoryActiveGradient}
                      />
                    )}
                    <View style={[
                      styles.categoryIconWrapper,
                      selectedCategory === category.key && { backgroundColor: 'rgba(255,255,255,0.2)' }
                    ]}>
                      <category.icon 
                        color={selectedCategory === category.key ? '#fff' : category.color} 
                        size={18}
                        strokeWidth={2.5}
                      />
                    </View>
                    <Text style={[
                      styles.categoryText, 
                      selectedCategory === category.key && styles.categoryTextActive
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>

            {/* Top Users Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Leaderboard</Text>
                <TouchableOpacity onPress={hapticFeedback}>
                  <Filter color="#22c55e" size={20} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={currentData}
                renderItem={({ item, index }) => (
                  <UserCard
                    item={item}
                    index={index}
                    getRankIcon={getRankIcon}
                    getTrendIcon={getTrendIcon}
                    formatNumber={formatNumber}
                    hapticFeedback={hapticFeedback}
                    t={t}
                  />
                )}
                keyExtractor={keyExtractor}
                scrollEnabled={false}
                removeClippedSubviews
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={10}
              />

              <TouchableOpacity style={styles.viewMoreButton} onPress={hapticFeedback}>
                <Text style={styles.viewMoreText}>View All Rankings</Text>
                <ChevronRight color="#22c55e" size={20} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* Player Rating Section */
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Rate Today's Players</Text>
              <TouchableOpacity onPress={hapticFeedback}>
                <Search color="#22c55e" size={20} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={playersData}
              renderItem={({ item }) => (
                <PlayerRatingCard
                  player={item}
                  onVote={handlePlayerVote}
                  t={t}
                />
              )}
              keyExtractor={keyExtractor}
              scrollEnabled={false}
              removeClippedSubviews
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              windowSize={5}
            />
          </View>
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* Prediction Modal */}
      <Modal
        visible={showPredictionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPredictionModal(false)}
      >
        <BlurView intensity={80} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowPredictionModal(false)}
            >
              <X color="#666" size={24} />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Predict Match Score</Text>
            
            {selectedMatch && (
              <View style={styles.predictionForm}>
                <View style={styles.predictionTeam}>
                  <Image 
                    source={{ uri: selectedMatch.homeTeam.logo }} 
                    style={styles.modalTeamLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.modalTeamName} numberOfLines={1}>
                    {selectedMatch.homeTeam.name}
                  </Text>
                  <TextInput
                    style={styles.scoreInput}
                    value={homeScore}
                    onChangeText={setHomeScore}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="0"
                    placeholderTextColor="#666"
                    editable={!loading}
                  />
                </View>

                <Text style={styles.vsText}>VS</Text>

                <View style={styles.predictionTeam}>
                  <Image 
                    source={{ uri: selectedMatch.awayTeam.logo }} 
                    style={styles.modalTeamLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.modalTeamName} numberOfLines={1}>
                    {selectedMatch.awayTeam.name}
                  </Text>
                  <TextInput
                    style={styles.scoreInput}
                    value={awayScore}
                    onChangeText={setAwayScore}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="0"
                    placeholderTextColor="#666"
                    editable={!loading}
                  />
                </View>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, loading && styles.disabledButton]}
                onPress={() => setShowPredictionModal(false)}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.disabledButton]}
                onPress={submitPrediction}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Prediction</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    marginBottom: 16,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    gap: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  headerIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextSection: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  tabActiveGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  tabActive: {},
  tabText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
    zIndex: 1,
  },
  tabTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 12,
    flexDirection: 'row',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  categoryActiveGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  categoryActive: {
    borderColor: 'transparent',
  },
  categoryIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  categoryText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    zIndex: 1,
  },
  categoryTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userCard: {
    marginBottom: 12,
    marginHorizontal: 20,
  },
  userCardContent: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  userCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  rankBadgeNew: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rankBadgeTopThree: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  userInfoSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatarWrapper: {
    position: 'relative',
  },
  userAvatarBorder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0a0a0a',
  },
  badgeIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userScore: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: 'bold',
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  changePositive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  changeNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  changeTextPositive: {
    color: '#22c55e',
  },
  changeTextNegative: {
    color: '#ef4444',
  },
  trendSection: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rankBadge: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#22c55e',
    backgroundColor: '#333',
  },
  userInfo: {
    gap: 4,
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userScore: {
    color: '#666',
    fontSize: 12,
  },
  changeIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  changePositive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  changeNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  changeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  userRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeGold: {
    backgroundColor: '#FFD700',
  },
  badgeSilver: {
    backgroundColor: '#C0C0C0',
  },
  badgeBronze: {
    backgroundColor: '#CD7F32',
  },
  matchCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  liveIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  matchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  team: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  teamLogo: {
    width: 48,
    height: 48,
    backgroundColor: '#333',
    borderRadius: 24,
  },
  teamName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  teamScore: {
    color: '#22c55e',
    fontSize: 24,
    fontWeight: 'bold',
  },
  matchCenter: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  matchTime: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  predictButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  predictText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
  },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
  matchStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchStatText: {
    color: '#666',
    fontSize: 12,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  followingButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: '#22c55e',
  },
  followText: {
    color: '#666',
    fontSize: 12,
  },
  followingText: {
    color: '#22c55e',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  viewMoreText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  playerCard: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  playerCardGradient: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  playerAvatarContainer: {
    position: 'relative',
  },
  playerAvatarBorder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#0a0a0a',
  },
  playerNumberBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  playerNumber: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerInfoSection: {
    flex: 1,
  },
  playerName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  playerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  playerTeamBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  playerTeam: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  playerPositionBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  playerPosition: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '600',
  },
  playerRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerRating: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playerRatingLabel: {
    color: '#666',
    fontSize: 12,
  },
  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
  },
  quickStat: {
    alignItems: 'center',
    gap: 4,
  },
  quickStatValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickStatLabel: {
    color: '#666',
    fontSize: 10,
  },
  performanceSection: {
    marginBottom: 20,
  },
  performanceSectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  performanceGrid: {
    gap: 10,
  },
  performanceItem: {
    marginBottom: 8,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  performanceLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  performanceValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  performanceBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  performanceBar: {
    height: '100%',
    borderRadius: 4,
  },
  votingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  approvalSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  approvalRate: {
    color: '#22c55e',
    fontSize: 28,
    fontWeight: 'bold',
  },
  approvalLabel: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  voteButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  voteButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  voteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
  },
  voteButtonActiveGreen: {
    borderColor: '#22c55e',
  },
  voteButtonActiveRed: {
    borderColor: '#ef4444',
  },
  voteCount: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
  },
  voteCountActive: {
    color: '#fff',
  },
  voteCountActiveRed: {
    color: '#fff',
  },
  skeleton: {
    marginBottom: 12,
  },
  skeletonHeader: {
    height: 20,
    backgroundColor: '#333',
    borderRadius: 10,
    marginBottom: 10,
  },
  skeletonContent: {
    height: 60,
    backgroundColor: '#333',
    borderRadius: 10,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  predictionForm: {
    gap: 16,
  },
  predictionTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTeamLogo: {
    width: 32,
    height: 32,
    backgroundColor: '#333',
    borderRadius: 16,
  },
  modalTeamName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreInput: {
    width: 50,
    height: 40,
    backgroundColor: '#000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  vsText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});