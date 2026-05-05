import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, AppState, AppStateStatus, Platform } from 'react-native';
import { Search, Bell, Settings } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { CoinsBadge } from '../common/CoinsBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { NotificationService } from '../../src/services/authService';
import { useHomeStore } from '../../src/store/home.store';
import * as Haptics from 'expo-haptics';
import { Colors, Elevation, BorderRadius, Spacing, Animation as AnimConfig, TouchTargets, FontWeights, BorderWidth } from '../../src/designSystem/designSystem';

interface HomeHeaderProps {
  onSettingsPress: () => void;
  onSearchPress: () => void;
  onNotificationPress: () => void;
}

export const HomeHeader = React.memo(({
  onSettingsPress,
  onSearchPress,
  onNotificationPress,
}: HomeHeaderProps) => {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [backendUnreadCount, setBackendUnreadCount] = useState(0);
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);
  const appState = useRef(AppState.currentState);
  const lastFetchTime = useRef(0);
  const pulseAnim = useSharedValue(0);
  
  // Button press animations
  const settingsScale = useSharedValue(1);
  const searchScale = useSharedValue(1);
  const notificationScale = useSharedValue(1);
  
  // Get match notifications from store
  const { notifications: matchNotifications } = useHomeStore();
  
  // Calculate local unread match notifications count
  const localUnreadCount = useMemo(() => {
    return matchNotifications.filter(n => !n.read).length;
  }, [matchNotifications]);
  
  // Total unread count = backend + local match notifications
  const totalUnreadCount = useMemo(() => {
    return backendUnreadCount + localUnreadCount;
  }, [backendUnreadCount, localUnreadCount]);

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
        const newTotalCount = count + localUnreadCount;
        if (newTotalCount > prevUnreadCount && prevUnreadCount >= 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        
        setPrevUnreadCount(totalUnreadCount);
        setBackendUnreadCount(count);
      }
    } catch (error) {
      // Silent fail
      console.log('Error fetching notifications:', error);
    }
  }, [getToken, localUnreadCount, totalUnreadCount]);

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

  // Pulse animation for notification badge (reanimated)
  useEffect(() => {
    if (totalUnreadCount > 0) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: 800,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: 800,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        false
      );
    } else {
      pulseAnim.value = 0;
    }
  }, [totalUnreadCount]);

  const pulseStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseAnim.value, [0, 1], [1, 1.2]);
    return {
      transform: [{ scale }],
    };
  });

  // Button press animations
  const createButtonStyle = (scale: SharedValue<number>) => {
    return useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));
  };

  const handleButtonPress = useCallback((scale: SharedValue<number>, callback: () => void) => {
    Haptics.selectionAsync();
    scale.value = withSequence(
      withTiming(0.95, { duration: AnimConfig.duration.short }),
      withTiming(1, { duration: AnimConfig.duration.short })
    );
    callback();
  }, []);

  const settingsStyle = createButtonStyle(settingsScale);
  const searchStyle = createButtonStyle(searchScale);
  const notificationStyle = createButtonStyle(notificationScale);

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.7)']}
        style={StyleSheet.absoluteFill}
      />
      <BlurView intensity={30} tint="dark" style={styles.blurBackground} />
      
      <View style={styles.headerContent}>
        {/* Left: Settings */}
        <Animated.View style={settingsStyle}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => handleButtonPress(settingsScale, onSettingsPress)}
            activeOpacity={1}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[Colors.glass.medium, Colors.glass.dark]}
              style={styles.iconButtonGradient}
            >
              <Settings size={22} color={Colors.onSurface.primary} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Right: Actions */}
        <View style={styles.rightActions}>
          {/* Coins Badge */}
          <View style={styles.coinsContainer}>
            <CoinsBadge />
          </View>

          <Animated.View style={searchStyle}>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => handleButtonPress(searchScale, onSearchPress)}
              activeOpacity={1}
              accessibilityLabel="Search"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[Colors.glass.medium, Colors.glass.dark]}
                style={styles.iconButtonGradient}
              >
                <Search size={22} color={Colors.onSurface.primary} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={notificationStyle}>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => handleButtonPress(notificationScale, onNotificationPress)}
              activeOpacity={1}
              accessibilityLabel={`Notifications${totalUnreadCount > 0 ? `, ${totalUnreadCount} unread` : ''}`}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[Colors.glass.medium, Colors.glass.dark]}
                style={styles.iconButtonGradient}
              >
                <Bell size={22} color={Colors.onSurface.primary} />
                
                {totalUnreadCount > 0 && (
                  <Animated.View 
                    style={[styles.notificationBadge, pulseStyle]}
                  >
                    <View style={styles.badgeContainer}>
                      <LinearGradient
                        colors={[Colors.error.default, Colors.error.light]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.badgeGradient}
                      >
                        <Text style={styles.notificationBadgeText}>
                          {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                        </Text>
                      </LinearGradient>
                      {/* Glow effect */}
                      <View style={styles.badgeGlow} />
                    </View>
                  </Animated.View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: TouchTargets.comfortable,
    minHeight: TouchTargets.comfortable,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
    justifyContent: 'flex-end',
  },
  coinsContainer: {
    flexShrink: 0,
    marginRight: Spacing.xs,
  },
  iconButton: {
    width: TouchTargets.minimum,
    height: TouchTargets.minimum,
    borderRadius: BorderRadius.round,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: BorderWidth.default,
    borderColor: Colors.glass.border,
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? {
        boxShadow: '0 6px 5px rgba(0, 0, 0, 0.27)',
      }
      : Elevation[6]),
  },
  iconButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    zIndex: 10,
  },
  badgeContainer: {
    minWidth: 20,
    height: 20,
    borderRadius: BorderRadius.round,
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeGradient: {
    minWidth: 20,
    height: 20,
    borderRadius: BorderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    borderWidth: BorderWidth.thick,
    borderColor: Colors.background.default,
    ...(Platform.OS === 'web'
      ? {
        boxShadow: `0 2px 6px ${Colors.error.default}`,
      }
      : {
        shadowColor: Colors.error.default,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
      }),
    elevation: 10,
  },
  badgeGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error.default,
    opacity: 0.3,
    zIndex: -1,
  },
  notificationBadgeText: {
    color: Colors.onError,
    fontSize: 11,
    fontWeight: FontWeights.extrabold,
    letterSpacing: 0.5,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});