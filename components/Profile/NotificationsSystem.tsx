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
  Alert,
} from 'react-native';
import { 
  Bell,
  CheckCircle,
  Heart,
  MessageCircle,
  Share,
  Users,
  Video,
  Trophy,
  Star,
  X,
  Settings,
  Filter,
  Search,
  Eye,
  EyeOff
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFadeIn, useSlideIn, usePulse } from '../leagues/Animations';
import { useHapticFeedback } from '../leagues/HapticFeedback';

const { width } = Dimensions.get('window');

export interface NotificationItem {
  id: string;
  type: 'follow' | 'like' | 'comment' | 'share' | 'achievement' | 'new_video' | 'mention' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  fromUser?: {
    id: string;
    username: string;
    avatar: string;
  };
  relatedContent?: {
    type: 'video' | 'post' | 'comment';
    id: string;
    title?: string;
    thumbnail?: string;
  };
  actionRequired?: boolean;
  actionText?: string;
}

interface NotificationsSystemProps {
  notifications: NotificationItem[];
  onNotificationPress?: (notification: NotificationItem) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onDeleteNotification?: (notificationId: string) => void;
  onClearAll?: () => void;
  onSettingsPress?: () => void;
}

const NotificationCard: React.FC<{
  notification: NotificationItem;
  onPress?: () => void;
  onMarkAsRead?: () => void;
  onDelete?: () => void;
  delay?: number;
}> = ({ notification, onPress, onMarkAsRead, onDelete, delay = 0 }) => {
  const fadeAnim = useFadeIn(600 + delay);
  const slideAnim = useSlideIn('right', 500 + delay);
  const haptic = useHapticFeedback();

  const handlePress = () => {
    haptic.cardTap();
    onPress?.();
    if (!notification.read) {
      onMarkAsRead?.();
    }
  };

  const handleDelete = () => {
    haptic.buttonPress();
    onDelete?.();
  };

  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'follow': return <Users size={20} color="#3b82f6" />;
      case 'like': return <Heart size={20} color="#ef4444" />;
      case 'comment': return <MessageCircle size={20} color="#22c55e" />;
      case 'share': return <Share size={20} color="#f59e0b" />;
      case 'achievement': return <Trophy size={20} color="#FFD700" />;
      case 'new_video': return <Video size={20} color="#8b5cf6" />;
      case 'mention': return <Star size={20} color="#06b6d4" />;
      case 'system': return <Bell size={20} color="#6b7280" />;
      default: return <Bell size={20} color="#B9F2FF" />;
    }
  };

  const getPriorityColor = () => {
    switch (notification.priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#B9F2FF';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `منذ ${diffMinutes} دقيقة`;
    } else if (diffHours < 24) {
      return `منذ ${diffHours} ساعة`;
    } else if (diffDays < 7) {
      return `منذ ${diffDays} يوم`;
    } else {
      return date.toLocaleDateString('ar-SA');
    }
  };

  return (
    <Animated.View 
      style={[
        styles.notificationCard,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
          borderLeftColor: getPriorityColor(),
          backgroundColor: notification.read ? '#1a1f2e' : '#242938'
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.notificationContent}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIcon}>
            {getNotificationIcon()}
          </View>
          
          <View style={styles.notificationInfo}>
            <Text style={[
              styles.notificationTitle,
              !notification.read && styles.unreadTitle
            ]}>
              {notification.title}
            </Text>
            <Text style={styles.notificationMessage}>
              {notification.message}
            </Text>
          </View>

          <View style={styles.notificationActions}>
            <Text style={styles.notificationTime}>
              {formatTimestamp(notification.timestamp)}
            </Text>
            
            {!notification.read && (
              <View style={styles.unreadDot} />
            )}
            
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <X size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {notification.fromUser && (
          <View style={styles.fromUserInfo}>
            <Image 
              source={{ uri: notification.fromUser.avatar }} 
              style={styles.userAvatar}
            />
            <Text style={styles.userName}>@{notification.fromUser.username}</Text>
          </View>
        )}

        {notification.relatedContent && (
          <View style={styles.relatedContent}>
            {notification.relatedContent.thumbnail && (
              <Image 
                source={{ uri: notification.relatedContent.thumbnail }} 
                style={styles.contentThumbnail}
              />
            )}
            <Text style={styles.contentTitle}>
              {notification.relatedContent.title}
            </Text>
          </View>
        )}

        {notification.actionRequired && (
          <View style={styles.actionRequired}>
            <Text style={styles.actionText}>{notification.actionText}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const NotificationsSystem: React.FC<NotificationsSystemProps> = ({
  notifications,
  onNotificationPress,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll,
  onSettingsPress,
}) => {
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('up', 600);
  const [filter, setFilter] = useState<'all' | 'unread' | 'follow' | 'like' | 'comment'>('all');
  const [showSettings, setShowSettings] = useState(false);

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread': return !notification.read;
      case 'follow': return notification.type === 'follow';
      case 'like': return notification.type === 'like';
      case 'comment': return notification.type === 'comment';
      default: return true;
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleFilterChange = (newFilter: typeof filter) => {
    haptic.buttonPress();
    setFilter(newFilter);
  };

  const handleMarkAllAsRead = () => {
    haptic.buttonPress();
    onMarkAllAsRead?.();
  };

  const handleClearAll = () => {
    haptic.buttonPress();
    Alert.alert(
      'مسح جميع الإشعارات',
      'هل أنت متأكد من مسح جميع الإشعارات؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'مسح', style: 'destructive', onPress: () => onClearAll?.() }
      ]
    );
  };

  const handleSettingsPress = () => {
    haptic.buttonPress();
    onSettingsPress?.();
    setShowSettings(true);
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
            <Bell size={24} color="#B9F2FF" />
            <Text style={styles.headerTitle}>الإشعارات</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={handleMarkAllAsRead}
            >
              <CheckCircle size={20} color="#B9F2FF" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={handleSettingsPress}
            >
              <Settings size={20} color="#B9F2FF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
        >
          <TouchableOpacity 
            style={[styles.filterTab, filter === 'all' && styles.activeFilterTab]}
            onPress={() => handleFilterChange('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>
              الكل ({notifications.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterTab, filter === 'unread' && styles.activeFilterTab]}
            onPress={() => handleFilterChange('unread')}
          >
            <Text style={[styles.filterText, filter === 'unread' && styles.activeFilterText]}>
              غير مقروء ({unreadCount})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterTab, filter === 'follow' && styles.activeFilterTab]}
            onPress={() => handleFilterChange('follow')}
          >
            <Text style={[styles.filterText, filter === 'follow' && styles.activeFilterText]}>
              متابعات
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterTab, filter === 'like' && styles.activeFilterTab]}
            onPress={() => handleFilterChange('like')}
          >
            <Text style={[styles.filterText, filter === 'like' && styles.activeFilterText]}>
              إعجابات
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterTab, filter === 'comment' && styles.activeFilterTab]}
            onPress={() => handleFilterChange('comment')}
          >
            <Text style={[styles.filterText, filter === 'comment' && styles.activeFilterText]}>
              تعليقات
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Notifications List */}
      <ScrollView 
        style={styles.notificationsList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.notificationsContent}
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={64} color="#6b7280" />
            <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all' 
                ? 'ستظهر الإشعارات الجديدة هنا'
                : 'لا توجد إشعارات بهذا النوع'
              }
            </Text>
          </View>
        ) : (
          filteredNotifications.map((notification, index) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onPress={() => onNotificationPress?.(notification)}
              onMarkAsRead={() => onMarkAsRead?.(notification.id)}
              onDelete={() => onDeleteNotification?.(notification.id)}
              delay={index * 100}
            />
          ))
        )}
      </ScrollView>

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>إعدادات الإشعارات</Text>
              <TouchableOpacity 
                onPress={() => setShowSettings(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.settingsContent}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>إشعارات المتابعة</Text>
                <TouchableOpacity style={styles.toggleButton}>
                  <Eye size={20} color="#22c55e" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>إشعارات الإعجابات</Text>
                <TouchableOpacity style={styles.toggleButton}>
                  <Eye size={20} color="#22c55e" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>إشعارات التعليقات</Text>
                <TouchableOpacity style={styles.toggleButton}>
                  <Eye size={20} color="#22c55e" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>إشعارات المشاركة</Text>
                <TouchableOpacity style={styles.toggleButton}>
                  <Eye size={20} color="#22c55e" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>إشعارات الإنجازات</Text>
                <TouchableOpacity style={styles.toggleButton}>
                  <Eye size={20} color="#22c55e" />
                </TouchableOpacity>
              </View>
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.clearAllButton}
              onPress={handleClearAll}
            >
              <Text style={styles.clearAllText}>مسح جميع الإشعارات</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 15,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
  },
  filterContainer: {
    flexDirection: 'row',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
  },
  activeFilterTab: {
    backgroundColor: '#B9F2FF',
  },
  filterText: {
    color: '#B9F2FF',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#0a0e1a',
    fontWeight: 'bold',
  },
  notificationsList: {
    flex: 1,
  },
  notificationsContent: {
    padding: 20,
  },
  notificationCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  notificationContent: {
    padding: 15,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  notificationIcon: {
    backgroundColor: 'rgba(185, 242, 255, 0.1)',
    borderRadius: 20,
    padding: 8,
    marginRight: 12,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  unreadTitle: {
    color: '#B9F2FF',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  notificationActions: {
    alignItems: 'flex-end',
    gap: 5,
  },
  notificationTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B9F2FF',
  },
  deleteButton: {
    padding: 4,
  },
  fromUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  userName: {
    fontSize: 12,
    color: '#B9F2FF',
    fontWeight: 'bold',
  },
  relatedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(185, 242, 255, 0.05)',
    borderRadius: 8,
    padding: 8,
    gap: 8,
  },
  contentThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  contentTitle: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8',
  },
  actionRequired: {
    marginTop: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
    padding: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: 'bold',
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
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  settingsModal: {
    backgroundColor: '#1a1f2e',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185, 242, 255, 0.1)',
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
  settingsContent: {
    flex: 1,
    padding: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185, 242, 255, 0.1)',
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  toggleButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  clearAllButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 15,
    padding: 15,
    margin: 20,
    alignItems: 'center',
  },
  clearAllText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default NotificationsSystem;
