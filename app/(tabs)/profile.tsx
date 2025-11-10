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
  CheckCircle
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';

// Import our new components
import {
  FifaCard,
  ProfileSections,
  allProfiles,
  diamondProfile,
  goldProfile,
  goldProfile2,
  silverProfile,
  silverProfile2,
  bronzeProfile,
  bronzeProfile2,
  bronzeProfile3,
  mockVideos,
  VideosSectionNew,
  UserProfile,
  DiamondProfile
} from '../../components/Profile';
import { demoAccounts, adaptDiamondToUserProfile } from '../../components/Profile/DemoAccounts';
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
  border: '#334155'
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

// Profile Card Component
const ProfileCard: React.FC<{ profile: UserProfile; onPress?: () => void }> = ({ 
  profile, 
  onPress 
}) => {
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(600);
  const slideAnim = useSlideIn('up', 500);

  const handlePress = () => {
    haptic.cardTap();
    onPress?.();
  };

  return (
    <Animated.View 
      style={[
        styles.profileCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <FifaCard profile={profile} showActions={false} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Main Profile Screen Component
export default function MyProfileScreen() {
  const [activeTab, setActiveTab] = useState('profiles');
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const haptic = useHapticFeedback();

  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('up', 600);

  // جميع البروفايلات مع إضافة البروفايل المرتبط بالحساب بعد التوافق
  const allUserProfiles: UserProfile[] = [
    globalState.userProfile ? adaptDiamondToUserProfile(globalState.userProfile as DiamondProfile) : diamondProfile,
    goldProfile,
    goldProfile2,
    silverProfile,
    silverProfile2,
    bronzeProfile,
    bronzeProfile2,
    bronzeProfile3
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    haptic.refresh();
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const handleProfilePress = (profile: UserProfile) => {
    setSelectedProfile(profile);
    haptic.cardTap();
  };

  const handleShare = async (profile: UserProfile) => {
    try {
      const shareUrl = `footballapp://profile/${profile.username}`;
      const message = `تابع ${profile.displayName} على تطبيق كرة القدم! 
@${profile.username}
${profile.bio}

${profile.followers.toLocaleString()} متابع | المستوى ${profile.stats.level}

رابط الملف الشخصي: ${shareUrl}`;

      await Share.share({
        message,
        title: 'مشاركة الملف الشخصي',
        url: shareUrl
      });
    } catch (error) {
      console.error(error);
    }
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
      case 'profiles':
        return (
          <View style={styles.profilesContainer}>
            <Text style={styles.sectionTitle}>البروفايلات الاحترافية</Text>
            <Text style={styles.sectionSubtitle}>
              اكتشف اللاعبين والمشاهير في عالم كرة القدم
            </Text>

            {/* Demo Accounts Switcher */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              {demoAccounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  onPress={() => {
                    setActiveAccountId(acc.id);
                    setSelectedProfile(acc);
                    // محاكاة اختيار حساب
                    globalState.setUserProfile(acc as any);
                  }}
                  style={{ alignItems: 'center', marginRight: 12 }}
                >
                  <Image
                    source={{ uri: acc.avatar }}
                    style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: activeAccountId === acc.id ? '#22c55e' : '#334155' }}
                  />
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }} numberOfLines={1}>
                    {acc.displayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <FlatList
              data={allUserProfiles}
              keyExtractor={item => item.id}
              renderItem={({ item, index }) => (
                <Animated.View
                  style={{
                    opacity: fadeAnim,
                    transform: [
                      { 
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0],
                        })
                      }
                    ]
                  }}
                >
                  <ProfileCard
                    profile={item}
                    onPress={() => handleProfilePress(item)}
                  />
                </Animated.View>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.profilesList}
            />
          </View>
        );

      case 'videos':
        return (
          <VideosSectionNew
            videos={mockVideos[((globalState.userProfile as any)?.id as keyof typeof mockVideos) || 'diamond-user'] || []}
            userProfile={globalState.userProfile || undefined}
            onVideoPress={(video: any) => console.log('Video pressed:', (video as any).id)}
          />
        );

      case 'achievements':
        return (
          <ProfileSections
            userId="current-user"
            activeTab="achievements"
            onTabChange={() => {}}
          />
        );

      case 'interactions':
        return (
          <ProfileSections
            userId="current-user"
            activeTab="interactions"
            onTabChange={() => {}}
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
        <Text style={styles.animatedHeaderTitle}>البروفايلات</Text>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
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
          <View style={styles.headerContent}>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>⚽ عالم كرة القدم</Text>
              <Text style={styles.headerSubtitle}>
                اكتشف اللاعبين والمشاهير في عالم كرة القدم
              </Text>
        </View>

            <View style={styles.headerStats}>
              <View style={styles.statItem}>
                <Users size={16} color="#22c55e" />
                <Text style={styles.statText}>8 لاعبين</Text>
              </View>
              <View style={styles.statItem}>
                <Trophy size={16} color="#FFD700" />
                <Text style={styles.statText}>ماسي</Text>
              </View>
          </View>
          </View>
        </Animated.View>

        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
        >
          <TabButton
            title="البروفايلات"
            icon={<Users size={18} color={activeTab === 'profiles' ? COLORS.primary : COLORS.textSecondary} />}
            active={activeTab === 'profiles'}
            onPress={() => setActiveTab('profiles')}
            count={allUserProfiles.length}
          />
          <TabButton
            title="الفيديوهات"
            icon={<Play size={18} color={activeTab === 'videos' ? COLORS.primary : COLORS.textSecondary} />}
            active={activeTab === 'videos'}
            onPress={() => setActiveTab('videos')}
          />
          <TabButton
            title="الإنجازات"
            icon={<Trophy size={18} color={activeTab === 'achievements' ? COLORS.primary : COLORS.textSecondary} />}
            active={activeTab === 'achievements'}
            onPress={() => setActiveTab('achievements')}
          />
          <TabButton
            title="التفاعلات"
            icon={<Heart size={18} color={activeTab === 'interactions' ? COLORS.primary : COLORS.textSecondary} />}
            active={activeTab === 'interactions'}
            onPress={() => setActiveTab('interactions')}
          />
        </ScrollView>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {renderContent()}
        </View>
      </Animated.ScrollView>

      {/* Profile Detail Modal */}
      <Modal
        visible={selectedProfile !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedProfile(null)}
      >
        {selectedProfile && (
          <View style={styles.modalOverlay}>
            <View style={styles.profileModalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  onPress={() => setSelectedProfile(null)}
                  style={styles.closeButton}
                >
                  <X size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>تفاصيل البروفايل</Text>
                <TouchableOpacity 
                  onPress={() => handleShare(selectedProfile)}
                  style={styles.shareButton}
                >
                  <Share2 size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalContent}>
                <FifaCard profile={selectedProfile} showActions={true} />
                
                <View style={styles.profileDetails}>
                  <Text style={styles.detailsTitle}>معلومات إضافية</Text>
                  <View style={styles.detailsGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>المستوى</Text>
                      <Text style={styles.detailValue}>{selectedProfile.stats.level}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>التوقعات</Text>
                      <Text style={styles.detailValue}>{selectedProfile.stats.predictions}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>الأسئلة</Text>
                      <Text style={styles.detailValue}>{selectedProfile.stats.questions}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>التفاعلات</Text>
                      <Text style={styles.detailValue}>{selectedProfile.stats.interactions}</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        )}
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
  animatedHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSection: {
    padding: 20,
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    marginBottom: 20,
  },
  headerContent: {
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
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
    color: COLORS.textSecondary,
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
    color: COLORS.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: COLORS.primary,
  },
  tabBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  profilesContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  profilesList: {
    paddingBottom: 20,
  },
  profileCard: {
    marginBottom: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  profileModalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: SCREEN_HEIGHT * 0.9,
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
  shareButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  profileDetails: {
    marginTop: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 15,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  detailItem: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 70) / 2,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
});
