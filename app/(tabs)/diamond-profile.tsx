import React, { useState, useRef, useEffect } from 'react';
import { globalState } from '../../globalState';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Share,
  Alert
} from 'react-native';
import {
  Settings,
  Edit3,
  Share2,
  Trophy,
  Target,
  Calendar,
  MapPin,
  Users,
  Award,
  Star,
  Heart,
  MessageCircle,
  Play,
  Grid,
  Bookmark,
  TrendingUp,
  Shield,
  ChevronRight,
  Camera,
  Check,
  X,
  Plus,
  Bell,
  Upload,
  MoreVertical,
  Trash2,
  Eye,
  Film,
  Image as ImageIcon,
  Edit2,
  Crown,
  CheckCircle,
  BarChart3,
  Download,
  Video,
  ThumbsUp,
  Activity,
  Zap,
  Clock
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';

// Import our new components
import {
  DiamondCard,
  Dashboard,
  VideosSection,
  NotificationsSystem,
  mockDiamondProfile,
  mockDashboardStats,
  DiamondProfile,
  DashboardStats,
  VideoItem,
  NotificationItem
} from '../../components/Profile';
import { useFadeIn, useSlideIn, useStagger } from '../../components/leagues/Animations';
import { useHapticFeedback } from '../../components/leagues/HapticFeedback';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ألوان التطبيق المحدثة
const COLORS = {
  primary: '#22c55e',
  secondary: '#16a34a',
  accent: '#FFD700',
  background: '#0a0e1a',
  surface: '#1a1f2e',
  card: '#242938',
  text: '#FFFFFF',
  textSecondary: '#94a3b8',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
  border: '#334155',
  diamond: '#B9F2FF'
};

// Tab Component
const TabButton: React.FC<{
  title: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
  count?: number;
}> = ({ title, icon, active, onPress, count }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const haptic = useHapticFeedback();

  const handlePress = () => {
    haptic.tabSwitch();
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      })
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.tabButton}>
      <Animated.View 
        style={[
          styles.tabContent,
          active && styles.tabActive,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        {icon}
        <Text style={[styles.tabText, active && styles.tabTextActive]}>
          {title}
        </Text>
        {count !== undefined && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </Animated.View>
      {active && <View style={styles.tabIndicator} />}
    </TouchableOpacity>
  );
};

// Main Diamond Profile Screen Component
export default function DiamondProfileScreen() {
  const [activeTab, setActiveTab] = useState('profile');
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const haptic = useHapticFeedback();

  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('up', 600);

  // Diamond Profile Data
  const diamondProfileData: DiamondProfile = globalState.userProfile || mockDiamondProfile;

  // Dashboard Stats Data
  const dashboardStats: DashboardStats = mockDashboardStats;

  const onRefresh = async () => {
    setRefreshing(true);
    haptic.refresh();
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const handleEdit = () => {
    haptic.buttonPress();
    setShowEditModal(true);
  };

  const handleUploadVideo = () => {
    haptic.buttonPress();
    console.log('Upload video pressed');
  };

  const handleDownloadVideo = (video: VideoItem) => {
    haptic.buttonPress();
    console.log('Download video:', video.id);
  };

  const handleVideoPress = (video: VideoItem) => {
    haptic.cardTap();
    console.log('Video pressed:', video.id);
  };

  const handleEditVideo = (video: VideoItem) => {
    haptic.buttonPress();
    console.log('Edit video:', video.id);
  };

  const handleDeleteVideo = (video: VideoItem) => {
    haptic.buttonPress();
    Alert.alert(
      'حذف الفيديو',
      'هل أنت متأكد من حذف هذا الفيديو؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: () => console.log('Delete confirmed') }
      ]
    );
  };

  const handleLikeVideo = (video: VideoItem) => {
    haptic.buttonPress();
    console.log('Like video:', video.id);
  };

  const handleCommentVideo = (video: VideoItem) => {
    haptic.buttonPress();
    console.log('Comment video:', video.id);
  };

  const handleShareVideo = (video: VideoItem) => {
    haptic.buttonPress();
    console.log('Share video:', video.id);
  };

  const handleStatPress = (statType: string) => {
    haptic.buttonPress();
    console.log('Stat pressed:', statType);
  };

  const handleFollow = (profileId: string) => {
    haptic.buttonPress();
    console.log('Follow profile:', profileId);
    // Update follow status
  };

  const handleUnfollow = (profileId: string) => {
    haptic.buttonPress();
    console.log('Unfollow profile:', profileId);
    // Update follow status
  };

  const handleViewFollowers = () => {
    haptic.buttonPress();
    console.log('View followers');
    // Navigate to followers list
  };

  const handleViewFollowing = () => {
    haptic.buttonPress();
    console.log('View following');
    // Navigate to following list
  };

  const handleViewBadges = () => {
    haptic.buttonPress();
    console.log('View badges');
    // Navigate to badges page
  };

  const handleViewAchievements = () => {
    haptic.buttonPress();
    console.log('View achievements');
    // Navigate to achievements page
  };

  const handleNotificationPress = (notification: NotificationItem) => {
    haptic.buttonPress();
    console.log('Notification pressed:', notification.id);
    // Handle notification navigation
  };

  const handleMarkAsRead = (notificationId: string) => {
    haptic.buttonPress();
    console.log('Mark as read:', notificationId);
    // Update notification status
  };

  const handleMarkAllAsRead = () => {
    haptic.buttonPress();
    console.log('Mark all as read');
    // Update all notifications status
  };

  const handleDeleteNotification = (notificationId: string) => {
    haptic.buttonPress();
    console.log('Delete notification:', notificationId);
    // Delete notification
  };

  const handleClearAllNotifications = () => {
    haptic.buttonPress();
    console.log('Clear all notifications');
    // Clear all notifications
  };

  const handleNotificationSettings = () => {
    haptic.buttonPress();
    console.log('Open notification settings');
    // Open settings
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerTranslate = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [-50, 0],
    extrapolate: 'clamp',
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <View style={styles.profileContainer}>
            <DiamondCard
              profile={diamondProfileData}
              showActions={true}
              onEdit={handleEdit}
              onUploadVideo={handleUploadVideo}
              onDownloadVideo={(videoId: string) => handleDownloadVideo({ id: videoId } as VideoItem)}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
              onViewFollowers={handleViewFollowers}
              onViewFollowing={handleViewFollowing}
              onViewBadges={handleViewBadges}
              onViewAchievements={handleViewAchievements}
              onNotificationPress={handleNotificationPress}
              currentUserId={globalState.userProfile?.id}
            />
          </View>
        );

      case 'videos':
        return (
          <VideosSection
            videos={diamondProfileData.videos}
            userProfile={{
              username: diamondProfileData.username,
              displayName: diamondProfileData.displayName,
              avatar: diamondProfileData.avatar,
              isDiamond: true
            }}
            onVideoPress={handleVideoPress}
            onDownloadPress={handleDownloadVideo}
            onUploadPress={handleUploadVideo}
            onEditPress={handleEditVideo}
            onDeletePress={handleDeleteVideo}
            onLikePress={handleLikeVideo}
            onCommentPress={handleCommentVideo}
            onSharePress={handleShareVideo}
          />
        );

      case 'dashboard':
        return (
          <Dashboard
            stats={dashboardStats}
            onStatPress={handleStatPress}
          />
        );

      case 'notifications':
        return (
          <NotificationsSystem
            notifications={diamondProfileData.notifications}
            onNotificationPress={handleNotificationPress}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onDeleteNotification={handleDeleteNotification}
            onClearAll={handleClearAllNotifications}
            onSettingsPress={handleNotificationSettings}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.animatedHeader,
          {
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslate }]
          }
        ]}
      >
        <View style={styles.headerContent}>
          <Crown size={24} color={COLORS.diamond} />
          <Text style={styles.animatedHeaderTitle}>الحساب الماسي</Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.diamond}
            colors={[COLORS.diamond]}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Header Section */}
        <Animated.View 
          style={[
            styles.headerSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['#0a0e1a', '#1a1f2e', '#242938']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerInfo}>
              <Crown size={32} color={COLORS.diamond} />
              <Text style={styles.headerTitle}>⚽ الحساب الماسي</Text>
              <Text style={styles.headerSubtitle}>
                استمتع بمزايا الحساب الماسي المميزة
              </Text>
            </View>

            <View style={styles.headerStats}>
              <View style={styles.statItem}>
                <Eye size={16} color={COLORS.diamond} />
                <Text style={styles.statText}>{diamondProfileData.stats.views.toLocaleString()} مشاهدة</Text>
              </View>
              <View style={styles.statItem}>
                <Crown size={16} color={COLORS.diamond} />
                <Text style={styles.statText}>ماسي</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
        >
          <TabButton
            title="البروفايل"
            icon={<Crown size={18} color={activeTab === 'profile' ? COLORS.diamond : COLORS.textSecondary} />}
            active={activeTab === 'profile'}
            onPress={() => setActiveTab('profile')}
          />
          <TabButton
            title="الفيديوهات"
            icon={<Video size={18} color={activeTab === 'videos' ? COLORS.diamond : COLORS.textSecondary} />}
            active={activeTab === 'videos'}
            onPress={() => setActiveTab('videos')}
            count={diamondProfileData.videos.length}
          />
          <TabButton
            title="الإحصائيات"
            icon={<BarChart3 size={18} color={activeTab === 'dashboard' ? COLORS.diamond : COLORS.textSecondary} />}
            active={activeTab === 'dashboard'}
            onPress={() => setActiveTab('dashboard')}
          />
          <TabButton
            title="الإشعارات"
            icon={<Bell size={18} color={activeTab === 'notifications' ? COLORS.diamond : COLORS.textSecondary} />}
            active={activeTab === 'notifications'}
            onPress={() => setActiveTab('notifications')}
            count={diamondProfileData.notifications.filter(n => !n.read).length}
          />
        </ScrollView>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {renderContent()}
        </View>
      </Animated.ScrollView>

      {/* Edit Profile Modal */}
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
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalSubtitle}>
                يمكنك تعديل معلوماتك الشخصية من هنا
              </Text>
              
              <View style={styles.editFields}>
                <View style={styles.editField}>
                  <Text style={styles.fieldLabel}>الاسم</Text>
                  <TextInput
                    style={styles.fieldInput}
                    defaultValue={diamondProfileData.displayName}
                    placeholder="أدخل اسمك"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                
                <View style={styles.editField}>
                  <Text style={styles.fieldLabel}>النبذة الشخصية</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.textArea]}
                    defaultValue={diamondProfileData.bio}
                    placeholder="أدخل نبذتك الشخصية"
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>
                
                <View style={styles.editField}>
                  <Text style={styles.fieldLabel}>المركز</Text>
                  <TextInput
                    style={styles.fieldInput}
                    defaultValue={diamondProfileData.position}
                    placeholder="أدخل مركزك"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>
              
              <TouchableOpacity style={styles.saveButton}>
                <Check size={20} color="#fff" />
                <Text style={styles.saveButtonText}>حفظ التغييرات</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 88 : 56,
    backgroundColor: COLORS.surface,
    zIndex: 100,
    justifyContent: 'flex-end',
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  animatedHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSection: {
    padding: 20,
    marginBottom: 20,
  },
  headerGradient: {
    borderRadius: 25,
    padding: 25,
    alignItems: 'center',
  },
  headerInfo: {
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.diamond,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.9,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: COLORS.diamond,
    fontSize: 12,
    fontWeight: '600',
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    position: 'relative',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabActive: {
    // Active styles handled by indicator
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.diamond,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: COLORS.diamond,
  },
  tabBadge: {
    backgroundColor: COLORS.diamond,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    color: '#0a0e1a',
    fontWeight: '600',
  },
  profileContainer: {
    padding: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: SCREEN_HEIGHT * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  editFields: {
    gap: 20,
    marginBottom: 30,
  },
  editField: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    color: COLORS.diamond,
    fontWeight: 'bold',
  },
  fieldInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 15,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.diamond,
    borderRadius: 15,
    padding: 15,
    gap: 8,
  },
  saveButtonText: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
