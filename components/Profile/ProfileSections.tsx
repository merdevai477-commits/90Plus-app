import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  FlatList,
} from 'react-native';
import { 
  Play, 
  Heart, 
  MessageCircle, 
  Share, 
  ThumbsUp,
  Eye,
  Clock,
  Calendar,
  Trophy,
  Star,
  Award,
  TrendingUp
} from 'lucide-react-native';
import { useFadeIn, useSlideIn, useStagger } from '../leagues/Animations';
import { useHapticFeedback } from '../leagues/HapticFeedback';

const { width } = Dimensions.get('window');

// أنواع المحتوى
export interface ContentItem {
  id: string;
  type: 'video' | 'post' | 'achievement' | 'interaction';
  title: string;
  description?: string;
  thumbnail?: string;
  videoUrl?: string;
  likes: number;
  comments: number;
  shares: number;
  views?: number;
  timestamp: Date;
  isLiked?: boolean;
}

// إنجاز
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  points: number;
  unlockedAt: Date;
  category: 'prediction' | 'streak' | 'social' | 'special';
}

// تفاعل
export interface Interaction {
  id: string;
  type: 'like' | 'comment' | 'share' | 'follow';
  fromUser: {
    username: string;
    avatar: string;
  };
  content: string;
  timestamp: Date;
}

// مكون فيديو
const VideoCard: React.FC<{ item: ContentItem; index: number }> = ({ item, index }) => {
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(600, index * 100);
  const slideAnim = useSlideIn('up', 500, index * 100);

  const handlePlay = () => {
    haptic.buttonPress();
    console.log('Playing video:', item.id);
  };

  const handleLike = () => {
    haptic.light();
    console.log('Liked video:', item.id);
  };

  return (
    <Animated.View 
      style={[
        styles.videoCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <TouchableOpacity style={styles.videoThumbnail} onPress={handlePlay}>
        {item.thumbnail && (
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnailImage} />
        )}
        <View style={styles.playButton}>
          <Play size={24} color="#fff" />
        </View>
        <View style={styles.durationBadge}>
          <Clock size={12} color="#fff" />
          <Text style={styles.durationText}>2:30</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle}>{item.title}</Text>
        <Text style={styles.videoDescription}>{item.description}</Text>
        
        <View style={styles.videoStats}>
          <View style={styles.statItem}>
            <Eye size={14} color="#666" />
            <Text style={styles.statText}>{item.views?.toLocaleString() || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Heart size={14} color="#ff4444" />
            <Text style={styles.statText}>{item.likes.toLocaleString()}</Text>
          </View>
          <View style={styles.statItem}>
            <MessageCircle size={14} color="#3b82f6" />
            <Text style={styles.statText}>{item.comments.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.videoActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <Heart size={16} color={item.isLiked ? "#ff4444" : "#666"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <MessageCircle size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Share size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

// مكون الإنجاز
const AchievementCard: React.FC<{ achievement: Achievement; index: number }> = ({ 
  achievement, 
  index 
}) => {
  const fadeAnim = useFadeIn(600, index * 100);
  const slideAnim = useSlideIn('up', 500, index * 100);

  return (
    <Animated.View 
      style={[
        styles.achievementCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.achievementIcon}>
        <Trophy size={24} color="#FFD700" />
      </View>
      <View style={styles.achievementInfo}>
        <Text style={styles.achievementTitle}>{achievement.title}</Text>
        <Text style={styles.achievementDescription}>{achievement.description}</Text>
        <View style={styles.achievementMeta}>
          <Text style={styles.achievementPoints}>+{achievement.points} نقطة</Text>
          <Text style={styles.achievementDate}>
            {achievement.unlockedAt.toLocaleDateString('ar-SA')}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

// مكون التفاعل
const InteractionCard: React.FC<{ interaction: Interaction; index: number }> = ({ 
  interaction, 
  index 
}) => {
  const fadeAnim = useFadeIn(600, index * 100);
  const slideAnim = useSlideIn('up', 500, index * 100);

  const getInteractionIcon = () => {
    switch (interaction.type) {
      case 'like': return <Heart size={16} color="#ff4444" />;
      case 'comment': return <MessageCircle size={16} color="#3b82f6" />;
      case 'share': return <Share size={16} color="#22c55e" />;
      case 'follow': return <Star size={16} color="#FFD700" />;
      default: return <ThumbsUp size={16} color="#666" />;
    }
  };

  const getInteractionText = () => {
    switch (interaction.type) {
      case 'like': return 'أعجب ب';
      case 'comment': return 'علق على';
      case 'share': return 'شارك';
      case 'follow': return 'تابع';
      default: return 'تفاعل مع';
    }
  };

  return (
    <Animated.View 
      style={[
        styles.interactionCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <Image source={{ uri: interaction.fromUser.avatar }} style={styles.interactionAvatar} />
      <View style={styles.interactionContent}>
        <Text style={styles.interactionText}>
          <Text style={styles.interactionUser}>{interaction.fromUser.username}</Text>
          {' '}{getInteractionText()}{' '}
          <Text style={styles.interactionContentText}>{interaction.content}</Text>
        </Text>
        <Text style={styles.interactionTime}>
          {interaction.timestamp.toLocaleDateString('ar-SA')}
        </Text>
      </View>
      <View style={styles.interactionIcon}>
        {getInteractionIcon()}
      </View>
    </Animated.View>
  );
};

// مكون أقسام البروفايل الرئيسي
interface ProfileSectionsProps {
  userId: string;
  activeTab: 'videos' | 'achievements' | 'interactions';
  onTabChange: (tab: 'videos' | 'achievements' | 'interactions') => void;
}

const ProfileSections: React.FC<ProfileSectionsProps> = ({
  userId,
  activeTab,
  onTabChange
}) => {
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('up', 600);

  // بيانات تجريبية
  const [videos] = useState<ContentItem[]>([
    {
      id: '1',
      type: 'video',
      title: 'تحليل مباراة الأهلي والزمالك',
      description: 'تحليل شامل لأهم اللحظات في الكلاسيكو المصري',
      thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=225&fit=crop',
      likes: 1250,
      comments: 89,
      shares: 45,
      views: 15600,
      timestamp: new Date('2024-01-15'),
      isLiked: true
    },
    {
      id: '2',
      type: 'video',
      title: 'توقعات مباريات هذا الأسبوع',
      description: 'توقعاتي الشخصية لمباريات الدوري المصري',
      thumbnail: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=225&fit=crop',
      likes: 890,
      comments: 67,
      shares: 23,
      views: 8900,
      timestamp: new Date('2024-01-14'),
      isLiked: false
    }
  ]);

  const [achievements] = useState<Achievement[]>([
    {
      id: '1',
      title: 'خبير التوقعات',
      description: 'حصلت على 100 توقع صحيح',
      icon: '🎯',
      points: 500,
      unlockedAt: new Date('2024-01-10'),
      category: 'prediction'
    },
    {
      id: '2',
      title: 'سلسلة النجاح',
      description: '10 توقعات صحيحة متتالية',
      icon: '🔥',
      points: 200,
      unlockedAt: new Date('2024-01-08'),
      category: 'streak'
    }
  ]);

  const [interactions] = useState<Interaction[]>([
    {
      id: '1',
      type: 'like',
      fromUser: { username: 'Ahmed_Football', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face' },
      content: 'فيديو تحليل مباراة الأهلي',
      timestamp: new Date('2024-01-15')
    },
    {
      id: '2',
      type: 'comment',
      fromUser: { username: 'Sara_Sports', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=50&h=50&fit=crop&crop=face' },
      content: 'توقعات مباريات هذا الأسبوع',
      timestamp: new Date('2024-01-14')
    }
  ]);

  const handleTabChange = (tab: 'videos' | 'achievements' | 'interactions') => {
    haptic.tabSwitch();
    onTabChange(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'videos':
        return (
          <FlatList
            data={videos}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => <VideoCard item={item} index={index} />}
            showsVerticalScrollIndicator={false}
          />
        );
      case 'achievements':
        return (
          <FlatList
            data={achievements}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => <AchievementCard achievement={item} index={index} />}
            showsVerticalScrollIndicator={false}
          />
        );
      case 'interactions':
        return (
          <FlatList
            data={interactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => <InteractionCard interaction={item} index={index} />}
            showsVerticalScrollIndicator={false}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'videos' && styles.activeTab]}
          onPress={() => handleTabChange('videos')}
        >
          <Play size={16} color={activeTab === 'videos' ? '#fff' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'videos' && styles.activeTabText]}>
            الفيديوهات
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'achievements' && styles.activeTab]}
          onPress={() => handleTabChange('achievements')}
        >
          <Trophy size={16} color={activeTab === 'achievements' ? '#fff' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'achievements' && styles.activeTabText]}>
            الإنجازات
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'interactions' && styles.activeTab]}
          onPress={() => handleTabChange('interactions')}
        >
          <Heart size={16} color={activeTab === 'interactions' ? '#fff' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'interactions' && styles.activeTabText]}>
            التفاعلات
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 4,
    margin: 20,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#22c55e',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  videoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
  },
  videoThumbnail: {
    position: 'relative',
    height: 200,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  videoInfo: {
    padding: 15,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  videoDescription: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  videoStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#666',
    fontSize: 12,
  },
  videoActions: {
    flexDirection: 'row',
    gap: 15,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  achievementIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD70020',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  achievementDescription: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  achievementMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  achievementPoints: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  achievementDate: {
    color: '#666',
    fontSize: 12,
  },
  interactionCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  interactionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  interactionContent: {
    flex: 1,
  },
  interactionText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  interactionUser: {
    fontWeight: 'bold',
    color: '#22c55e',
  },
  interactionContentText: {
    color: '#888',
  },
  interactionTime: {
    color: '#666',
    fontSize: 12,
  },
  interactionIcon: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#333',
  },
});

export default ProfileSections;
