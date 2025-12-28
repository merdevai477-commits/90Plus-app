import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Animated, Platform } from 'react-native';
import { Home, Brain, User, Trophy, BarChart3, Video } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';

const { width } = Dimensions.get('window');

const ICON_COLOR = '#8e8e93';
const ACTIVE_ICON_COLOR = '#22c55e';
const BACKGROUND_COLOR = '#121212';
const INDICATOR_COLOR = '#22c55e';

interface NavItemProps {
  icon: React.ElementType;
  isActive: boolean;
  onPress: () => void;
}

const NavItem = ({ icon: Icon, isActive, onPress }: NavItemProps) => {
  const scale = new Animated.Value(isActive ? 1 : 0);

  Animated.spring(scale, {
    toValue: isActive ? 1 : 0,
    friction: 7,
    useNativeDriver: false,
  }).start();

  const iconScale = scale.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  return (
    <TouchableOpacity onPress={onPress} style={styles.navItem}>
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        <Icon color={isActive ? ACTIVE_ICON_COLOR : ICON_COLOR} size={26} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const BottomNav = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // ✅ أضفنا هنا /rank و /reels و /diamond-profile
  type AppRoute = '/Home' | '/quiz' | '/profile' |  '/leagues' | '/rank' | '/reels' | '/diamond-profile';

  const tabs = [
    { name: 'Home', icon: Home, route: '/Home' as const },
    { name: 'Quiz', icon: Brain, route: '/quiz' as const },
    { name: 'Profile', icon: User, route: '/profile' as const },
    { name: 'Reels', icon: Video, route: '/reels' as const },
    { name: 'League', icon: Trophy, route: '/leagues' as const },
    { name: 'Rank', icon: BarChart3, route: '/rank' as const },
  ];

  // إذا كان pathname يحتوي على match-details، اعتبره League
  const isMatchDetails = pathname?.includes('match-details');
  const activeTab = isMatchDetails 
    ? 'League' 
    : tabs.find(tab => pathname === tab.route)?.name || 'Home';
  const tabWidth = width / tabs.length;
  const activeIndex = tabs.findIndex(tab => tab.name === activeTab);
  const indicatorPosition = new Animated.Value(activeIndex * tabWidth);

  const handlePress = (tab: typeof tabs[number]) => {
    router.push(tab.route as AppRoute);
    const newIndex = tabs.findIndex(t => t.name === tab.name);
    Animated.spring(indicatorPosition, {
      toValue: newIndex * tabWidth,
      friction: 10,
      useNativeDriver: false,
    }).start();
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom, height: 60 + insets.bottom }]}>
      <View style={styles.navItemsContainer}>
        {tabs.map((tab) => (
          <NavItem
            key={tab.name}
            icon={tab.icon}
            isActive={activeTab === tab.name}
            onPress={() => handlePress(tab)}
          />
        ))}
      </View>
      <Animated.View style={[styles.indicator, { left: indicatorPosition, width: tabWidth }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BACKGROUND_COLOR,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 197, 94, 0.2)',
    zIndex: 9999,
    elevation: 100,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  navItemsContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    backgroundColor: INDICATOR_COLOR,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});

export default BottomNav;
