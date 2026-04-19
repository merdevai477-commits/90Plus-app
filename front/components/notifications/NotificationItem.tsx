import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertCircle, AtSign, CheckCircle, Heart, Info, MessageCircle, Reply, Star, Trash2, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../reels/constants';
import { useTranslation } from '../../src/i18n';
import type { SocialNotification } from '../../src/services/authService';
import MiniProfileCard from '../profile/MiniProfileCard';

interface NotificationItemProps {
  notification: SocialNotification;
  index: number;
  onPress: () => void;
  onMarkAsRead: () => void;
  onDelete: () => void;
}

export const NotificationItem = React.memo<NotificationItemProps>(({
  notification,
  index,
  onPress,
  onMarkAsRead,
  onDelete,
}) => {
  const { t, language } = useTranslation();

  const data = useMemo(() => {
    try {
      return typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data;
    } catch {
      return notification.data;
    }
  }, [notification.data]);

  const avatarUrl = (data as any)?.actorAvatar || (data as any)?.followerAvatar || (data as any)?.avatar;
  const actorName = (data as any)?.actorDisplayName || (data as any)?.actorUsername || (data as any)?.followerUsername || (data as any)?.username;

  const formatTime = (dateString: string) => {
    if (!dateString) return t.notifications?.now || 'الآن';
    const date = new Date(dateString);
    // Guard against Invalid Date (e.g. undefined/null createdAt from match notifications)
    if (isNaN(date.getTime())) return t.notifications?.now || 'الآن';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t.notifications?.now || 'Now';
    if (diffMins < 60) return (t.notifications?.minutesAgo || '{n} minutes ago').replace('{n}', String(diffMins));
    if (diffHours < 24) return (t.notifications?.hoursAgo || '{n} hours ago').replace('{n}', String(diffHours));
    if (diffDays < 7) return (t.notifications?.daysAgo || '{n} days ago').replace('{n}', String(diffDays));
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'FOLLOW':
        return <UserPlus color={COLORS.neonGreen} size={24} />;
      case 'LIKE':
        return <Heart color="#FF4757" size={24} fill="#FF4757" />;
      case 'COMMENT':
        return <MessageCircle color={COLORS.neonBlue} size={24} />;
      case 'REPLY':
        return <Reply color="#9B59B6" size={24} />;
      case 'MENTION':
        return <AtSign color="#FFD700" size={24} />;
      case 'MATCH_UPDATE':
      case 'MATCH_FAVORITE':
        return <Star color="#FFD700" size={24} fill="#FFD700" />;
      case 'MODERATION_ALERT':
        return <AlertCircle color="#FF6B6B" size={24} />;
      default:
        return <Info color={COLORS.neonBlue} size={24} />;
    }
  };

  const getBackgroundColor = () => {
    if (notification.type === 'MODERATION_ALERT') return 'rgba(255, 107, 107, 0.15)';

    if (!notification.isRead) {
      switch (notification.type) {
        case 'FOLLOW':
          return 'rgba(50, 205, 50, 0.15)';
        case 'LIKE':
          return 'rgba(255, 71, 87, 0.15)';
        case 'COMMENT':
          return 'rgba(0, 168, 255, 0.15)';
        case 'REPLY':
          return 'rgba(155, 89, 182, 0.15)';
        case 'MENTION':
          return 'rgba(255, 215, 0, 0.15)';
        case 'MATCH_UPDATE':
        case 'MATCH_FAVORITE':
          return 'rgba(255, 215, 0, 0.2)';
        default:
          return 'rgba(255,255,255,0.1)';
      }
    }
    return 'rgba(255,255,255,0.05)';
  };

  const handlePress = () => {
    if (!notification.isRead) onMarkAsRead();
    onPress();
  };

  const renderRightActions = () => {
    if (notification.isRead) {
      return (
        <View style={styles.swipeActionsContainer}>
          <TouchableOpacity
            style={[styles.swipeAction, styles.swipeActionDelete]}
            onPress={onDelete}
            activeOpacity={0.8}
          >
            <Trash2 size={20} color="#fff" />
            <Text style={styles.swipeActionText}>{t.notifications?.swipe?.delete || 'Delete'}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.swipeActionsContainer}>
        <TouchableOpacity
          style={[styles.swipeAction, styles.swipeActionRead]}
          onPress={onMarkAsRead}
          activeOpacity={0.8}
        >
          <CheckCircle size={20} color="#fff" />
          <Text style={styles.swipeActionText}>{t.notifications?.swipe?.markRead || 'Read'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, styles.swipeActionDelete]}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <Trash2 size={20} color="#fff" />
          <Text style={styles.swipeActionText}>{t.notifications?.swipe?.delete || 'Delete'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderLeftActions = () => {
    if (!notification.isRead) {
      return (
        <View style={styles.swipeActionsContainer}>
          <TouchableOpacity
            style={[styles.swipeAction, styles.swipeActionRead]}
            onPress={onMarkAsRead}
            activeOpacity={0.8}
          >
            <CheckCircle size={20} color="#fff" />
            <Text style={styles.swipeActionText}>{t.notifications?.swipe?.markRead || 'Read'}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  if (notification.type === 'FOLLOW') {
    return (
      <Animated.View entering={FadeInRight.delay(index * 30).duration(300)}>
        <Swipeable
          renderRightActions={renderRightActions}
          renderLeftActions={renderLeftActions}
          onSwipeableOpen={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          friction={2}
          overshootRight={false}
          overshootLeft={false}
        >
          <TouchableOpacity style={styles.followCardContainer} onPress={handlePress} activeOpacity={0.8}>
            <LinearGradient
              colors={
                notification.isRead
                  ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']
                  : ['rgba(50, 205, 50, 0.2)', 'rgba(50, 205, 50, 0.1)']
              }
              style={styles.followCardGradient}
            />

            <View style={styles.fifaCardWrapper}>
              <MiniProfileCard
                playerImage={avatarUrl || undefined}
                countryFlag={(data as any)?.countryFlag || '🇪🇬'}
                position={(data as any)?.position || undefined}
                clubLogo={(data as any)?.clubLogo || undefined}
              />
            </View>

            <View style={styles.followCardContent}>
              <View style={styles.followCardHeader}>
                <Text style={styles.followCardTitle} numberOfLines={1}>
                  {actorName || notification.title}
                </Text>
                {!notification.isRead && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.followCardMessage} numberOfLines={1}>
                {notification.message}
              </Text>
              <Text style={styles.followCardTime}>{formatTime(notification.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        </Swipeable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInRight.delay(index * 30).duration(300)}>
      <Swipeable
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
        onSwipeableOpen={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        friction={2}
        overshootRight={false}
        overshootLeft={false}
      >
        <TouchableOpacity
          style={[styles.itemContainer, { backgroundColor: getBackgroundColor() }]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={
              notification.isRead
                ? ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']
                : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']
            }
            style={styles.itemGradient}
          />

          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.3)']}
                  style={styles.avatarOverlay}
                />
              </View>
            ) : (
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.08)']}
                style={styles.iconContainer}
              >
                {getIcon()}
              </LinearGradient>
            )}
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {notification.title}
              </Text>
              {!notification.isRead && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.itemMessage} numberOfLines={2}>
              {notification.message}
            </Text>
            <Text style={styles.itemTime}>{formatTime(notification.createdAt)}</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    position: 'relative',
  },
  itemGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.neonGreen,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  contentContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
    flex: 1,
  },
  itemMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    lineHeight: 20,
  },
  itemTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.neonGreen,
    marginLeft: 8,
    shadowColor: COLORS.neonGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  followCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 70,
  },
  followCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  fifaCardWrapper: {
    width: 50,
    height: 75,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ scale: 0.35 }],
  },
  followCardContent: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 4,
  },
  followCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  followCardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.white,
    flex: 1,
  },
  followCardMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 6,
    lineHeight: 20,
  },
  followCardTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    height: '100%',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 16,
    marginHorizontal: 4,
  },
  swipeActionDelete: {
    backgroundColor: COLORS.error,
  },
  swipeActionRead: {
    backgroundColor: COLORS.neonGreen,
  },
  swipeActionText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
});

