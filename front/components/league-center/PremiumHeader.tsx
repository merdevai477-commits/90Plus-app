/**
 * PremiumHeader Component
 * Migrated to react-native-reanimated with search and filter functionality
 * Supports sticky header with scroll-based animations
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap, Bell, User, Search, X, Filter } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
  SharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useAuth } from '@clerk/clerk-expo';
import { useCoins } from '../../contexts/CoinsContext';
import { NotificationService } from '../../src/services/authService';
import { useHomeStore } from '../../src/store/home.store';
import * as Haptics from 'expo-haptics';

interface PremiumHeaderProps {
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  onSearchChange?: (query: string) => void;
  onFilterPress?: () => void;
  scrollY?: SharedValue<number>;
  activeFiltersCount?: number;
  searchQuery?: string;
}

const PremiumHeader: React.FC<PremiumHeaderProps> = ({
  onNotificationPress,
  onProfilePress,
  onSearchChange,
  onFilterPress,
  scrollY,
  activeFiltersCount = 0,
  searchQuery: externalSearchQuery,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();
  const { coins } = useCoins();
  const { notifications: matchNotifications } = useHomeStore();
  
  const [backendUnreadCount, setBackendUnreadCount] = useState(0);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  
  // Use external search query if provided, otherwise use internal state
  const searchQuery = externalSearchQuery ?? internalSearchQuery;

  // Reanimated shared values
  const pulseAnim = useSharedValue(0);
  const notificationScale = useSharedValue(1);
  const profileScale = useSharedValue(1);
  const filterScale = useSharedValue(1);
  const searchExpanded = useSharedValue(0);
  const searchIconRotate = useSharedValue(0);

  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    const localUnread = matchNotifications.filter(n => !n.read).length;
    return backendUnreadCount + localUnread;
  }, [backendUnreadCount, matchNotifications]);

  // Fetch unread notifications count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = await getToken();
        if (token) {
          const count = await NotificationService.getUnreadCount(token);
          setBackendUnreadCount(count);
        }
      } catch (error) {
        // Silent fail
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 300000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [getToken]);

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
  }, [totalUnreadCount, pulseAnim]);

  // Search expand/collapse animation
  useEffect(() => {
    searchExpanded.value = withSpring(isSearchExpanded ? 1 : 0, {
      damping: 15,
      stiffness: 150,
    });
    
    if (isSearchExpanded) {
      searchIconRotate.value = withTiming(90, { duration: 200 });
    } else {
      searchIconRotate.value = withTiming(0, { duration: 200 });
    }
  }, [isSearchExpanded, searchExpanded, searchIconRotate]);

  // Animated styles
  const pulseStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseAnim.value, [0, 1], [1, 1.2]);
    return {
      transform: [{ scale }],
    };
  });

  const buttonPressStyle = (scale: SharedValue<number>) => {
    return useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));
  };

  const searchContainerStyle = useAnimatedStyle(() => {
    const width = interpolate(searchExpanded.value, [0, 1], [0, 280]);
    const opacity = interpolate(searchExpanded.value, [0, 1], [0, 1]);
    return {
      width,
      opacity,
    };
  });

  const searchIconStyle = useAnimatedStyle(() => {
    const rotate = interpolate(searchIconRotate.value, [0, 90], [0, 90]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  // Sticky header styles (scroll-based)
  const headerStyle = useAnimatedStyle(() => {
    if (!scrollY) {
      return {};
    }

    const blurIntensity = interpolate(
      scrollY.value,
      [0, 50],
      [30, 80],
      'clamp'
    );
    const opacity = interpolate(
      scrollY.value,
      [0, 50],
      [1, 0.98],
      'clamp'
    );

    return {
      opacity,
      // Note: BlurView intensity can't be animated directly, 
      // but we can use opacity as a workaround
    };
  });

  const notificationStyle = buttonPressStyle(notificationScale);
  const profileStyle = buttonPressStyle(profileScale);
  const filterStyle = buttonPressStyle(filterScale);

  // Button press handlers
  const handleButtonPress = useCallback((scale: SharedValue<number>, callback: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
    callback();
  }, []);

  const handleNotificationPress = () => {
    handleButtonPress(notificationScale, () => {
      if (onNotificationPress) {
        onNotificationPress();
      } else {
        router.push('/notifications');
      }
    });
  };

  const handleProfilePress = () => {
    handleButtonPress(profileScale, () => {
      if (onProfilePress) {
        onProfilePress();
      } else {
        router.push('/(tabs)/profile');
      }
    });
  };

  const handleFilterPress = () => {
    handleButtonPress(filterScale, () => {
      if (onFilterPress) {
        onFilterPress();
      }
    });
  };

  const handleSearchFocus = () => {
    setIsSearchExpanded(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSearchBlur = () => {
    if (!searchQuery) {
      setIsSearchExpanded(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setInternalSearchQuery(text);
    if (onSearchChange) {
      onSearchChange(text);
    }
  };

  const handleSearchClear = () => {
    setInternalSearchQuery('');
    if (onSearchChange) {
      onSearchChange('');
    }
    setIsSearchExpanded(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSearchToggle = () => {
    if (isSearchExpanded) {
      handleSearchClear();
    } else {
      setIsSearchExpanded(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top + 10 }, headerStyle]}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(15, 15, 26, 0.95)', 'rgba(15, 15, 26, 0.8)', 'rgba(15, 15, 26, 0.6)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {/* Left: Coins Balance */}
        <TouchableOpacity
          style={styles.coinsContainer}
          activeOpacity={0.7}
          onPress={() => {
            // Could navigate to coins shop or details
          }}
          accessibilityRole="button"
          accessibilityLabel={`Coins balance: ${coins.toLocaleString()}`}
        >
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.coinsGradient}
          >
            <Zap size={18} color="#000" fill="#000" />
          </LinearGradient>
          <View style={styles.coinsTextContainer}>
            <Text style={styles.coinsLabel}>BALANCE</Text>
            <Text style={styles.coinsValue}>{coins.toLocaleString()}</Text>
          </View>
        </TouchableOpacity>

        {/* Center: Search Bar (when expanded) */}
        <Animated.View style={[styles.searchContainer, searchContainerStyle]}>
          {isSearchExpanded && (
            <View style={styles.searchInputContainer}>
              <View style={styles.searchIconWrapper}>
                <Animated.View style={searchIconStyle}>
                  <Search size={18} color="rgba(255, 255, 255, 0.7)" />
                </Animated.View>
              </View>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearchChange}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                placeholder="Search matches..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                autoFocus={isSearchExpanded}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel="Search matches"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleSearchClear}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <X size={16} color="rgba(255, 255, 255, 0.6)" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>

        {/* Right: Actions */}
        <View style={styles.rightActions}>
          {/* Search Toggle Button */}
          <Animated.View style={buttonPressStyle(searchIconRotate)}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleSearchToggle}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.08)']}
                style={styles.iconButtonGradient}
              >
                <Animated.View style={searchIconStyle}>
                  <Search size={20} color="#FFFFFF" />
                </Animated.View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Filter Button */}
          <Animated.View style={filterStyle}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleFilterPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Filters${activeFiltersCount > 0 ? `, ${activeFiltersCount} active` : ''}`}
            >
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.25)', 'rgba(139, 92, 246, 0.15)']}
                style={styles.iconButtonGradient}
              >
                <Filter size={20} color="#FFFFFF" />
                {activeFiltersCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>
                      {activeFiltersCount > 9 ? '9+' : activeFiltersCount}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Notifications */}
          <Animated.View style={notificationStyle}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleNotificationPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Notifications${totalUnreadCount > 0 ? `, ${totalUnreadCount} unread` : ''}`}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.08)']}
                style={styles.iconButtonGradient}
              >
                <Bell size={22} color="#FFFFFF" />
                {totalUnreadCount > 0 && (
                  <Animated.View style={[styles.notificationBadge, pulseStyle]}>
                    <View style={styles.badgeContainer}>
                      <LinearGradient
                        colors={['#FF4757', '#FF6B7A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.badgeGradient}
                      >
                        <Text style={styles.badgeText}>
                          {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                        </Text>
                      </LinearGradient>
                      <View style={styles.badgeGlow} />
                    </View>
                  </Animated.View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Profile */}
          <Animated.View style={profileStyle}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleProfilePress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <LinearGradient
                colors={['#3B82F6', '#60A5FA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileGradient}
              >
                <User size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    gap: 12,
  },
  coinsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  coinsGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinsTextContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  coinsLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.5,
  },
  coinsValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: -0.5,
  },
  searchContainer: {
    overflow: 'hidden',
    height: 40,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    height: 40,
  },
  searchIconWrapper: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
    height: '100%',
  },
  clearButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  iconButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  profileGradient: {
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
    borderRadius: 10,
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeGradient: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#0F0F1A',
    shadowColor: '#FF4757',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 10,
  },
  badgeGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 12,
    backgroundColor: '#FF4757',
    opacity: 0.3,
    zIndex: -1,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#0F0F1A',
    zIndex: 10,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
});

export default PremiumHeader;
