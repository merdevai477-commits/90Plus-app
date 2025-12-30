import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, AppState, AppStateStatus, Animated, Easing } from 'react-native';
import { Search, Bell, Settings } from 'lucide-react-native';
import { COLORS } from '../reels/constants';
import { BlurView } from 'expo-blur';
import { CoinsBadge } from '../common/CoinsBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { NotificationService } from '../../src/services/authService';
import * as Haptics from 'expo-haptics';

interface HomeHeaderProps {
  onSettingsPress: () => void;
  onSearchPress: () => void;
  onNotificationPress: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onSettingsPress,
  onSearchPress,
  onNotificationPress,
}) => {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);
  const appState = useRef(AppState.currentState);
  const lastFetchTime = useRef(0);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const fetchUnreadCount = useCallback(async () => {
    // Throttle: don't fetch more than once per minute
    const now = Date.now();
    if (now - lastFetchTime.current < 60000) return;
    
    lastFetchTime.current = now;
    
    try {
      const token = await getToken();
      if (token) {
        const count = await NotificationService.getUnreadCount(token);
        
        // إذا في إشعار جديد، اعمل haptic feedback
        if (count > prevUnreadCount && prevUnreadCount >= 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        
        setPrevUnreadCount(unreadCount);
        setUnreadCount(count);
      }
    } catch (error) {
      // Silent fail
      console.log('Error fetching notifications:', error);
    }
  }, [getToken, prevUnreadCount, unreadCount]);

  useEffect(() => {
    // Initial fetch
    fetchUnreadCount();

    // Refresh every 5 minutes (instead of 30 seconds)
    const interval = setInterval(fetchUnreadCount, 300000);

    // Also refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchUnreadCount();
      }
      appState.current = nextAppState;
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [fetchUnreadCount]);

  // أنيميشن النبض للدائرة الحمراء
  useEffect(() => {
    if (unreadCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [unreadCount, pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <BlurView intensity={20} tint="dark" style={styles.blurBackground} />
      
      <View style={styles.headerContent}>
        {/* Left: Settings */}
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={onSettingsPress}
          activeOpacity={0.7}
        >
          <Settings size={22} color={COLORS.white} />
        </TouchableOpacity>

        {/* Right: Actions */}
        <View style={styles.rightActions}>
          {/* Coins Badge */}
          <View style={styles.coinsContainer}>
            <CoinsBadge />
          </View>

          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={onSearchPress}
            activeOpacity={0.7}
          >
            <Search size={22} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={onNotificationPress}
            activeOpacity={0.7}
          >
            <Bell size={22} color={COLORS.white} />
            
            {unreadCount > 0 && (
              <Animated.View 
                style={[
                  styles.notificationBadge,
                  { transform: [{ scale: pulseScale }] }
                ]}
              >
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </Animated.View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    justifyContent: 'flex-end',
  },
  coinsContainer: {
    flexShrink: 0,
    marginRight: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.neonGreen,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: 2,
    borderColor: COLORS.deepBlack,
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: COLORS.deepBlack,
    fontSize: 10,
    fontWeight: 'bold',
  },
});