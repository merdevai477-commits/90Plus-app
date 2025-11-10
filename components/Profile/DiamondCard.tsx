import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { 
  Crown, 
  Camera, 
  Edit3, 
  Upload,
  Check,
  X,
  Star,
  Trophy,
  Shield,
  Award,
  Users,
  Heart,
  MessageCircle,
  Share,
  Download,
  Plus,
  Play,
  Eye,
  ThumbsUp,
  BarChart3,
  Target,
  Calendar,
  MapPin,
  CheckCircle
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useFadeIn, useSlideIn, usePulse } from '../leagues/Animations';
import { useHapticFeedback } from '../leagues/HapticFeedback';
import { NotificationItem } from './NotificationsSystem';

const { width } = Dimensions.get('window');

export interface DiamondProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  coverImage?: string;
  weight: number;
  height: number;
  age: number;
  strongFoot: 'left' | 'right';
  position: string;
  favoriteClub: {
    name: string;
    logo: string;
    country: string;
  };
  bio: string;
  stats: {
    views: number;
    likes: number;
    questionsSolved: number;
    rating: number;
    posts: number;
    predictions: number;
    interactions: number;
    level: number;
    followers: number;
    following: number;
    monthlyViews: number;
    yearlyViews: number;
    engagementRate: number;
    contentQuality: number;
  };
  videos: Array<{
    id: string;
    title: string;
    thumbnail: string;
    duration: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    uploadDate: string;
    quality: 'HD' | '4K' | 'SD';
    category: string;
    tags: string[];
  }>;
  badges: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    earnedDate: string;
  }>;
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    progress: number;
    maxProgress: number;
    unlocked: boolean;
  }>;
  socialStats: {
    followers: Array<{
      id: string;
      username: string;
      avatar: string;
      followDate: string;
    }>;
    following: Array<{
      id: string;
      username: string;
      avatar: string;
      followDate: string;
    }>;
  };
  notifications: NotificationItem[];
  isOwner?: boolean;
  isVerified?: boolean;
  isAppOwner?: boolean;
  isFollowing?: boolean;
  isFollowed?: boolean;
  isVip?: boolean;
  isExpert?: boolean;
  isInfluencer?: boolean;
  isVerifiedCoach?: boolean;
}

interface DiamondCardProps {
  profile: DiamondProfile;
  onPress?: () => void;
  showActions?: boolean;
  onEdit?: () => void;
  onUploadVideo?: () => void;
  onDownloadVideo?: (videoId: string) => void;
  onFollow?: (profileId: string) => void;
  onUnfollow?: (profileId: string) => void;
  onViewFollowers?: () => void;
  onViewFollowing?: () => void;
  onViewBadges?: () => void;
  onViewAchievements?: () => void;
  onNotificationPress?: (notification: NotificationItem) => void;
  currentUserId?: string;
}

const DiamondCard: React.FC<DiamondCardProps> = ({ 
  profile, 
  onPress, 
  showActions = true,
  onEdit,
  onUploadVideo,
  onDownloadVideo,
  onFollow,
  onUnfollow,
  onViewFollowers,
  onViewFollowing,
  onViewBadges,
  onViewAchievements,
  onNotificationPress,
  currentUserId
}) => {
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('up', 600);
  const pulseAnim = usePulse(1, 1.02, 3000);
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');

  useEffect(() => {
    // Shimmer effect for diamond card
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, []);

  const handlePress = () => {
    haptic.cardTap();
    onPress?.();
  };

  const handleEdit = () => {
    haptic.buttonPress();
    onEdit?.();
    setShowEditModal(true);
  };

  const handleUploadVideo = () => {
    haptic.buttonPress();
    onUploadVideo?.();
    setShowUploadModal(true);
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        // Handle image upload
        console.log('Image selected:', result.assets[0].uri);
        haptic.success();
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختيار الصورة');
    }
  };

  const handleEditField = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const saveEdit = () => {
    // Save the edited value
    console.log(`Saving ${editingField}: ${editValue}`);
    setEditingField(null);
    setEditValue('');
    haptic.success();
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    haptic.buttonPress();
  };

  const handleFollow = () => {
    haptic.buttonPress();
    if (profile.isFollowing) {
      onUnfollow?.(profile.id);
    } else {
      onFollow?.(profile.id);
    }
  };

  const handleViewFollowers = () => {
    haptic.buttonPress();
    onViewFollowers?.();
  };

  const handleViewFollowing = () => {
    haptic.buttonPress();
    onViewFollowing?.();
  };

  const handleViewBadges = () => {
    haptic.buttonPress();
    onViewBadges?.();
  };

  const handleViewAchievements = () => {
    haptic.buttonPress();
    onViewAchievements?.();
  };

  const getBadgeIcon = (badgeType: string) => {
    switch (badgeType) {
      case 'vip': return <Crown size={16} color="#FFD700" />;
      case 'expert': return <Star size={16} color="#22c55e" />;
      case 'influencer': return <Users size={16} color="#3b82f6" />;
      case 'coach': return <Trophy size={16} color="#f59e0b" />;
      default: return <Award size={16} color="#B9F2FF" />;
    }
  };

  const isOwnProfile = currentUserId === profile.id;

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <>
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: pulseAnim }
            ]
          }
        ]}
      >
        {/* Diamond Card Background with Shimmer Effect */}
        <LinearGradient
          colors={['#0a0e1a', '#1a1f2e', '#242938', '#334155']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardBackground}
        >
          {/* Shimmer Overlay */}
          <Animated.View 
            style={[
              styles.shimmerOverlay,
              { opacity: shimmerOpacity }
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(185, 242, 255, 0.3)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>

          {/* Diamond Crown Icon */}
          <View style={styles.crownContainer}>
            <Crown size={32} color="#B9F2FF" />
            <Text style={styles.diamondText}>حساب ماسي</Text>
          </View>

          {/* Profile Picture with Upload Option */}
          <TouchableOpacity 
            style={styles.profilePictureContainer}
            onPress={handleImagePicker}
            activeOpacity={0.8}
          >
            <Image source={{ uri: profile.avatar }} style={styles.profilePicture} />
            <View style={styles.uploadOverlay}>
              <Camera size={16} color="#fff" />
            </View>
            
            {/* Verification Badge */}
            {profile.isVerified && (
              <View style={styles.verificationBadge}>
                <CheckCircle size={16} color="#1DA1F2" />
              </View>
            )}
            
            {/* App Owner Badge */}
            {profile.isAppOwner && (
              <View style={styles.appOwnerBadge}>
                <Crown size={14} color="#FFD700" />
              </View>
            )}

            {/* VIP Badge */}
            {profile.isVip && (
              <View style={styles.vipBadge}>
                <Crown size={12} color="#FFD700" />
              </View>
            )}

            {/* Expert Badge */}
            {profile.isExpert && (
              <View style={styles.expertBadge}>
                <Star size={12} color="#22c55e" />
              </View>
            )}

            {/* Influencer Badge */}
            {profile.isInfluencer && (
              <View style={styles.influencerBadge}>
                <Users size={12} color="#3b82f6" />
              </View>
            )}

            {/* Verified Coach Badge */}
            {profile.isVerifiedCoach && (
              <View style={styles.coachBadge}>
                <Trophy size={12} color="#f59e0b" />
              </View>
            )}
          </TouchableOpacity>

          {/* Player Information */}
          <View style={styles.playerInfo}>
            <View style={styles.nameContainer}>
              <Text style={styles.playerName}>{profile.displayName}</Text>
              {profile.isVerified && (
                <CheckCircle size={18} color="#1DA1F2" />
              )}
              {profile.isAppOwner && (
                <View style={styles.appOwnerCrown}>
                  <Crown size={16} color="#FFD700" />
                </View>
              )}
            </View>
            
            <View style={styles.usernameContainer}>
              <Text style={styles.playerUsername}>@{profile.username}</Text>
              {profile.isAppOwner && (
                <View style={styles.appOwnerBadgeText}>
                  <Text style={styles.appOwnerText}>مالك التطبيق</Text>
                </View>
              )}
            </View>
            
            {/* Player Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>السن</Text>
                <Text style={styles.statValue}>{profile.age}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>الوزن</Text>
                <Text style={styles.statValue}>{profile.weight} كجم</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>الطول</Text>
                <Text style={styles.statValue}>{profile.height} سم</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>المركز</Text>
                <Text style={styles.statValue}>{profile.position}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>القدم القوية</Text>
                <Text style={styles.statValue}>
                  {profile.strongFoot === 'right' ? 'يمنى' : 'يسرى'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>النادي المفضل</Text>
                <View style={styles.clubContainer}>
                  <Image source={{ uri: profile.favoriteClub.logo }} style={styles.clubLogo} />
                  <Text style={styles.clubName}>{profile.favoriteClub.name}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bio Section */}
          <View style={styles.bioSection}>
            <Text style={styles.bioLabel}>نبذة شخصية</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>

          {/* Statistics Section */}
          <View style={styles.statisticsSection}>
            <View style={styles.statRow}>
              <Eye size={16} color="#B9F2FF" />
              <Text style={styles.statText}>{profile.stats.views.toLocaleString()} مشاهدة</Text>
            </View>
            <View style={styles.statRow}>
              <ThumbsUp size={16} color="#B9F2FF" />
              <Text style={styles.statText}>{profile.stats.likes.toLocaleString()} إعجاب</Text>
            </View>
            <View style={styles.statRow}>
              <Target size={16} color="#B9F2FF" />
              <Text style={styles.statText}>{profile.stats.questionsSolved} سؤال محلول</Text>
            </View>
            <View style={styles.statRow}>
              <Star size={16} color="#B9F2FF" />
              <Text style={styles.statText}>{profile.stats.rating}/5 تقييم</Text>
            </View>
          </View>

          {/* Social Stats Section */}
          <View style={styles.socialStatsSection}>
            <TouchableOpacity 
              style={styles.socialStatItem}
              onPress={handleViewFollowers}
            >
              <Users size={18} color="#B9F2FF" />
              <Text style={styles.socialStatNumber}>{profile.stats.followers.toLocaleString()}</Text>
              <Text style={styles.socialStatLabel}>متابع</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.socialStatItem}
              onPress={handleViewFollowing}
            >
              <Users size={18} color="#B9F2FF" />
              <Text style={styles.socialStatNumber}>{profile.stats.following.toLocaleString()}</Text>
              <Text style={styles.socialStatLabel}>متابع</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.socialStatItem}
              onPress={handleViewBadges}
            >
              <Award size={18} color="#B9F2FF" />
              <Text style={styles.socialStatNumber}>{profile.badges.length}</Text>
              <Text style={styles.socialStatLabel}>شارة</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.socialStatItem}
              onPress={handleViewAchievements}
            >
              <Trophy size={18} color="#B9F2FF" />
              <Text style={styles.socialStatNumber}>{profile.achievements.filter(a => a.unlocked).length}</Text>
              <Text style={styles.socialStatLabel}>إنجاز</Text>
            </TouchableOpacity>
          </View>

          {/* Badges Preview */}
          {profile.badges.length > 0 && (
            <View style={styles.badgesPreview}>
              <Text style={styles.badgesTitle}>الشارات</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
                {profile.badges.slice(0, 5).map((badge, index) => (
                  <TouchableOpacity 
                    key={badge.id}
                    style={[styles.badgeItem, { backgroundColor: badge.color + '20' }]}
                    onPress={handleViewBadges}
                  >
                    {getBadgeIcon(badge.name.toLowerCase())}
                    <Text style={styles.badgeText}>{badge.name}</Text>
                  </TouchableOpacity>
                ))}
                {profile.badges.length > 5 && (
                  <TouchableOpacity 
                    style={styles.moreBadgesButton}
                    onPress={handleViewBadges}
                  >
                    <Text style={styles.moreBadgesText}>+{profile.badges.length - 5}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}

          {/* Action Buttons */}
          {showActions && (
            <View style={styles.actionButtons}>
              {!isOwnProfile && (
                <TouchableOpacity 
                  style={[
                    styles.followButton,
                    profile.isFollowing && styles.unfollowButton
                  ]}
                  onPress={handleFollow}
                >
                  <Users size={20} color={profile.isFollowing ? "#ef4444" : "#B9F2FF"} />
                  <Text style={[
                    styles.followButtonText,
                    profile.isFollowing && styles.unfollowButtonText
                  ]}>
                    {profile.isFollowing ? 'إلغاء المتابعة' : 'متابعة'}
                  </Text>
                </TouchableOpacity>
              )}
              
              {isOwnProfile && (
                <>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={handleEdit}
                  >
                    <Edit3 size={20} color="#B9F2FF" />
                    <Text style={styles.actionButtonText}>تعديل</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={handleUploadVideo}
                  >
                    <Upload size={20} color="#B9F2FF" />
                    <Text style={styles.actionButtonText}>رفع فيديو</Text>
                  </TouchableOpacity>
                </>
              )}
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => console.log('Share profile')}
              >
                <Share size={20} color="#B9F2FF" />
                <Text style={styles.actionButtonText}>مشاركة</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>

        {/* Cover Image Background */}
        {profile.coverImage && (
          <Image 
            source={{ uri: profile.coverImage }} 
            style={styles.coverImage}
            blurRadius={10}
          />
        )}
      </Animated.View>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تعديل البروفايل</Text>
              <TouchableOpacity 
                onPress={() => setShowEditModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.editFields}>
              <TouchableOpacity 
                style={styles.editField}
                onPress={() => handleEditField('displayName', profile.displayName)}
              >
                <Text style={styles.editFieldLabel}>الاسم</Text>
                <Text style={styles.editFieldValue}>{profile.displayName}</Text>
                <Edit3 size={16} color="#B9F2FF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.editField}
                onPress={() => handleEditField('bio', profile.bio)}
              >
                <Text style={styles.editFieldLabel}>النبذة الشخصية</Text>
                <Text style={styles.editFieldValue}>{profile.bio}</Text>
                <Edit3 size={16} color="#B9F2FF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.editField}
                onPress={() => handleEditField('position', profile.position)}
              >
                <Text style={styles.editFieldLabel}>المركز</Text>
                <Text style={styles.editFieldValue}>{profile.position}</Text>
                <Edit3 size={16} color="#B9F2FF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Video Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>رفع فيديو جديد</Text>
              <TouchableOpacity 
                onPress={() => setShowUploadModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.uploadOptions}>
              <TouchableOpacity style={styles.uploadOption}>
                <Camera size={24} color="#B9F2FF" />
                <Text style={styles.uploadOptionText}>تصوير فيديو جديد</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.uploadOption}>
                <Upload size={24} color="#B9F2FF" />
                <Text style={styles.uploadOptionText}>اختيار من المعرض</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Field Edit Modal */}
      {editingField && (
        <Modal
          visible={editingField !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={cancelEdit}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.editModalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>تعديل {editingField}</Text>
                <TouchableOpacity 
                  onPress={cancelEdit}
                  style={styles.closeButton}
                >
                  <X size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.editInput}
                value={editValue}
                onChangeText={setEditValue}
                placeholder={`أدخل ${editingField} الجديد`}
                placeholderTextColor="#666"
                multiline={editingField === 'bio'}
              />
              
              <View style={styles.editActions}>
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={saveEdit}
                >
                  <Check size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>حفظ</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={cancelEdit}
                >
                  <X size={20} color="#fff" />
                  <Text style={styles.cancelButtonText}>إلغاء</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 25,
    marginBottom: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
    position: 'relative',
  },
  cardBackground: {
    padding: 25,
    minHeight: 400,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shimmerGradient: {
    flex: 1,
  },
  crownContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  diamondText: {
    color: '#B9F2FF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    textShadowColor: 'rgba(185, 242, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#B9F2FF',
  },
  uploadOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#B9F2FF',
    borderRadius: 15,
    padding: 6,
  },
  verificationBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: '#1DA1F2',
  },
  appOwnerBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  vipBadge: {
    position: 'absolute',
    top: 0,
    left: 20,
    backgroundColor: '#FFD700',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#fff',
  },
  expertBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: '#22c55e',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#fff',
  },
  influencerBadge: {
    position: 'absolute',
    bottom: 0,
    right: 20,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#fff',
  },
  coachBadge: {
    position: 'absolute',
    top: 20,
    right: 0,
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#fff',
  },
  playerInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  playerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  appOwnerCrown: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 8,
    padding: 2,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  playerUsername: {
    fontSize: 16,
    color: '#B9F2FF',
    textAlign: 'center',
  },
  appOwnerBadgeText: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  appOwnerText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  statItem: {
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    minWidth: (width - 100) / 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.3)',
  },
  statLabel: {
    color: '#B9F2FF',
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.8,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  clubContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clubLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  clubName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bioSection: {
    marginBottom: 20,
  },
  bioLabel: {
    color: '#B9F2FF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bioText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.9,
  },
  statisticsSection: {
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.3)',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  statText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(185, 242, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.4)',
    gap: 6,
  },
  actionButtonText: {
    color: '#B9F2FF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  socialStatsSection: {
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.3)',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  socialStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  socialStatNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  socialStatLabel: {
    color: '#B9F2FF',
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  badgesPreview: {
    marginBottom: 20,
  },
  badgesTitle: {
    color: '#B9F2FF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  badgesScroll: {
    flexDirection: 'row',
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.3)',
    gap: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  moreBadgesButton: {
    backgroundColor: 'rgba(185, 242, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.4)',
  },
  moreBadgesText: {
    color: '#B9F2FF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(185, 242, 255, 0.2)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.4)',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  unfollowButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  followButtonText: {
    color: '#B9F2FF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  unfollowButtonText: {
    color: '#ef4444',
  },
  coverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#1a1f2e',
    borderRadius: 20,
    padding: 20,
    width: width * 0.9,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editFields: {
    gap: 15,
  },
  editField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.3)',
  },
  editFieldLabel: {
    color: '#B9F2FF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  editFieldValue: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  uploadOptions: {
    gap: 15,
  },
  uploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.3)',
    gap: 15,
  },
  uploadOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editModalContainer: {
    backgroundColor: '#1a1f2e',
    borderRadius: 20,
    padding: 20,
    width: width * 0.9,
  },
  editInput: {
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.3)',
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    gap: 15,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 15,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 15,
    gap: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DiamondCard;
