import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Animated,
  Image,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { 
  Play, 
  Download,
  Plus,
  Upload,
  MoreVertical,
  Heart, 
  MessageCircle, 
  Share, 
  Eye,
  Clock,
  Calendar,
  Edit3,
  Trash2,
  Camera,
  Video,
  ThumbsUp,
  BarChart3,
  Settings,
  Crown
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFadeIn, useSlideIn, useStagger } from '../leagues/Animations';
import { useHapticFeedback } from '../leagues/HapticFeedback';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

export interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  views: number;
  likes: number;
  comments: number;
  uploadDate: string;
  isOwner?: boolean;
  description?: string;
  tags?: string[];
}

interface VideosSectionProps {
  videos: VideoItem[];
  userProfile?: {
    username: string;
    displayName: string;
    avatar: string;
    isDiamond?: boolean;
  };
  onVideoPress?: (video: VideoItem) => void;
  onDownloadPress?: (video: VideoItem) => void;
  onUploadPress?: () => void;
  onEditPress?: (video: VideoItem) => void;
  onDeletePress?: (video: VideoItem) => void;
  onLikePress?: (video: VideoItem) => void;
  onCommentPress?: (video: VideoItem) => void;
  onSharePress?: (video: VideoItem) => void;
}

const VideoCard: React.FC<{
  video: VideoItem;
  onPress?: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  delay?: number;
}> = ({ 
  video, 
  onPress, 
  onDownload, 
  onEdit, 
  onDelete, 
  onLike, 
  onComment, 
  onShare,
  delay = 0 
}) => {
  const fadeAnim = useFadeIn(600 + delay);
  const slideAnim = useSlideIn('up', 500 + delay);
  const haptic = useHapticFeedback();
  const [showOptions, setShowOptions] = useState(false);

  const handlePress = () => {
    haptic.cardTap();
    onPress?.();
  };

  const handleDownload = () => {
    haptic.buttonPress();
    onDownload?.();
  };

  const handleLike = () => {
    haptic.buttonPress();
    onLike?.();
  };

  const handleComment = () => {
    haptic.buttonPress();
    onComment?.();
  };

  const handleShare = () => {
    haptic.buttonPress();
    onShare?.();
  };

  const toggleOptions = () => {
    haptic.buttonPress();
    setShowOptions(!showOptions);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) return `${diffDays} أيام`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} أسابيع`;
    return `${Math.ceil(diffDays / 30)} أشهر`;
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
      <TouchableOpacity 
        style={styles.videoThumbnail}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <Image source={{ uri: video.thumbnail }} style={styles.thumbnailImage} />
          
          {/* Play Button Overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
            <Play size={24} color="#fff" fill="#fff" />
            </View>
          </View>

        {/* Duration Badge */}
        <View style={styles.durationBadge}>
          <Clock size={12} color="#fff" />
            <Text style={styles.durationText}>{video.duration}</Text>
          </View>

        {/* Diamond Badge for Owner */}
        {video.isOwner && (
          <View style={styles.diamondBadge}>
            <Crown size={12} color="#B9F2FF" />
            </View>
          )}
      </TouchableOpacity>

        <View style={styles.videoInfo}>
        <View style={styles.videoHeader}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {video.title}
          </Text>
          
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={toggleOptions}
          >
            <MoreVertical size={20} color="#94a3b8" />
          </TouchableOpacity>
            </View>

        <View style={styles.videoStats}>
            <View style={styles.statItem}>
            <Eye size={14} color="#94a3b8" />
            <Text style={styles.statText}>{video.views.toLocaleString()}</Text>
            </View>
            <View style={styles.statItem}>
            <Calendar size={14} color="#94a3b8" />
            <Text style={styles.statText}>{formatDate(video.uploadDate)}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleLike}
          >
            <Heart size={18} color="#ef4444" />
            <Text style={styles.actionText}>{video.likes}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleComment}
          >
            <MessageCircle size={18} color="#3b82f6" />
            <Text style={styles.actionText}>{video.comments}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleShare}
          >
            <Share size={18} color="#22c55e" />
      </TouchableOpacity>

        <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleDownload}
          >
            <Download size={18} color="#B9F2FF" />
          </TouchableOpacity>
                </View>
            </View>
            
      {/* Options Modal */}
      {showOptions && (
        <Modal
          visible={showOptions}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowOptions(false)}
        >
          <TouchableOpacity 
            style={styles.optionsOverlay}
            onPress={() => setShowOptions(false)}
          >
            <View style={styles.optionsContainer}>
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={() => {
                  setShowOptions(false);
                  onEdit?.();
                }}
              >
                <Edit3 size={20} color="#B9F2FF" />
                <Text style={styles.optionText}>تعديل</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={() => {
                  setShowOptions(false);
                  onDelete?.();
                }}
              >
                <Trash2 size={20} color="#ef4444" />
                <Text style={[styles.optionText, { color: '#ef4444' }]}>حذف</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={() => {
                  setShowOptions(false);
                  onDownload?.();
                }}
              >
                <Download size={20} color="#22c55e" />
                <Text style={styles.optionText}>تنزيل</Text>
              </TouchableOpacity>
          </View>
        </TouchableOpacity>
        </Modal>
      )}
    </Animated.View>
  );
};

const UploadModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onUpload: (type: 'camera' | 'gallery') => void;
}> = ({ visible, onClose, onUpload }) => {
  const haptic = useHapticFeedback();

  const handleCameraUpload = () => {
    haptic.buttonPress();
    onUpload('camera');
    onClose();
  };

  const handleGalleryUpload = () => {
    haptic.buttonPress();
    onUpload('gallery');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.uploadModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>رفع فيديو جديد</Text>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.uploadOptions}>
            <TouchableOpacity 
              style={styles.uploadOption}
              onPress={handleCameraUpload}
            >
              <View style={styles.uploadIconContainer}>
                <Camera size={32} color="#B9F2FF" />
              </View>
              <Text style={styles.uploadOptionTitle}>تصوير فيديو جديد</Text>
              <Text style={styles.uploadOptionSubtitle}>استخدم الكاميرا لتصوير فيديو جديد</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.uploadOption}
              onPress={handleGalleryUpload}
            >
              <View style={styles.uploadIconContainer}>
                <Video size={32} color="#B9F2FF" />
              </View>
              <Text style={styles.uploadOptionTitle}>اختيار من المعرض</Text>
              <Text style={styles.uploadOptionSubtitle}>اختر فيديو من معرض الصور</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const VideosSection: React.FC<VideosSectionProps> = ({
  videos,
  userProfile,
  onVideoPress,
  onDownloadPress,
  onUploadPress,
  onEditPress,
  onDeletePress,
  onLikePress,
  onCommentPress,
  onSharePress,
}) => {
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('up', 600);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const handleUploadPress = () => {
    haptic.buttonPress();
    onUploadPress?.();
    setShowUploadModal(true);
  };

  const handleUpload = async (type: 'camera' | 'gallery') => {
    try {
      if (type === 'camera') {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: true,
          quality: 1,
        });
        
        if (!result.canceled) {
          console.log('Video recorded:', result.assets[0].uri);
          haptic.success();
        }
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: true,
          quality: 1,
        });
        
        if (!result.canceled) {
          console.log('Video selected:', result.assets[0].uri);
          haptic.success();
        }
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء رفع الفيديو');
    }
  };

    return (
    <View style={styles.container}>
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
          <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>الفيديوهات</Text>
        <Text style={styles.headerSubtitle}>
              {videos.length} فيديو • {userProfile?.isDiamond ? 'حساب ماسي' : 'حساب عادي'}
        </Text>
      </View>

          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={handleUploadPress}
          >
            <Plus size={20} color="#fff" />
            <Text style={styles.uploadButtonText}>رفع</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Videos Grid */}
      <ScrollView 
        style={styles.videosContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.videosContent}
      >
        {videos.length === 0 ? (
          <View style={styles.emptyState}>
            <Video size={64} color="#94a3b8" />
            <Text style={styles.emptyTitle}>لا توجد فيديوهات بعد</Text>
            <Text style={styles.emptySubtitle}>
              ابدأ بإنشاء أول فيديو لك ومشاركته مع المجتمع
            </Text>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={handleUploadPress}
            >
              <Plus size={20} color="#fff" />
              <Text style={styles.createButtonText}>إنشاء فيديو جديد</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.videosGrid}>
            {videos.map((video, index) => (
              <VideoCard
                key={video.id}
                video={video}
                onPress={() => onVideoPress?.(video)}
                onDownload={() => onDownloadPress?.(video)}
                onEdit={() => onEditPress?.(video)}
                onDelete={() => onDeletePress?.(video)}
                onLike={() => onLikePress?.(video)}
                onComment={() => onCommentPress?.(video)}
                onShare={() => onSharePress?.(video)}
                delay={index * 100}
      />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Upload Modal */}
      <UploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185, 242, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#B9F2FF',
    opacity: 0.8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B9F2FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  uploadButtonText: {
    color: '#0a0e1a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  videosContainer: {
    flex: 1,
  },
  videosContent: {
    padding: 20,
  },
  videosGrid: {
    gap: 20,
  },
  videoCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.1)',
  },
  videoThumbnail: {
    position: 'relative',
    aspectRatio: 16/9,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    backgroundColor: 'rgba(185, 242, 255, 0.9)',
    borderRadius: 30,
    padding: 12,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  diamondBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(185, 242, 255, 0.9)',
    borderRadius: 12,
    padding: 6,
  },
  videoInfo: {
    padding: 15,
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  optionsButton: {
    padding: 4,
  },
  videoStats: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185, 242, 255, 0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsContainer: {
    backgroundColor: '#1a1f2e',
    borderRadius: 15,
    padding: 20,
    minWidth: 200,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 12,
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadModalContainer: {
    backgroundColor: '#1a1f2e',
    borderRadius: 20,
    padding: 20,
    width: width * 0.9,
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
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadOptions: {
    gap: 15,
  },
  uploadOption: {
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(185, 242, 255, 0.3)',
  },
  uploadIconContainer: {
    backgroundColor: 'rgba(185, 242, 255, 0.2)',
    borderRadius: 25,
    padding: 15,
    marginBottom: 10,
  },
  uploadOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  uploadOptionSubtitle: {
    fontSize: 12,
    color: '#B9F2FF',
    opacity: 0.8,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B9F2FF',
    borderRadius: 25,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  createButtonText: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VideosSection;