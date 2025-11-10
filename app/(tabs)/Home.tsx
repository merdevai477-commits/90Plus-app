import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Animated,
  ScrollView,
  View,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HomeHeader,
  WelcomeSection,
  VideosSection,
  PlayersSection,
  TeamSection,
  SideMenu,
  useHomeData,
  useHaptics,
  styles,
} from '../../components/Home';
import AdvancedSearchBar, { SearchResult } from '../../components/Home/AdvancedSearchBar';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hapticFeedback } = useHaptics();
  const [searchVisible, setSearchVisible] = useState(false);
  
  const {
    isGuest,
    username,
    isLoading,
    refreshing,
    sideMenuVisible,
    imageErrors,
    isTransitioning,
    overlayOpacity,
    ballScale,
    ballRotate,
    sideMenuAnim,
    onRefresh,
    getCurrentVideos,
    getCurrentPlayers,
    handleImageError,
    startAmoledTransition,
    setSideMenuVisible,
    currentTeam,
  } = useHomeData();

  const toggleSideMenu = React.useCallback(() => {
    hapticFeedback();
    if (sideMenuVisible) {
      Animated.timing(sideMenuAnim, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setSideMenuVisible(false));
    } else {
      setSideMenuVisible(true);
      Animated.timing(sideMenuAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [sideMenuVisible, sideMenuAnim, setSideMenuVisible, hapticFeedback]);

  const handleLogout = () => {
    hapticFeedback();
    toggleSideMenu();
    startAmoledTransition(() => router.replace("/auth"));
  };

  const handleMenuItemPress = (item: string) => {
    hapticFeedback();
    console.log(`Pressed: ${item}`);
  };

  const handleSearchPress = () => {
    hapticFeedback();
    setSearchVisible(true);
  };

  const handleSearchClose = () => {
    setSearchVisible(false);
  };

  const handleSearchResult = (result: SearchResult) => {
    console.log('Search result selected:', result);
    setSearchVisible(false);
    // Navigate to result based on type
    switch (result.type) {
      case 'profile':
        // Navigate to profile
        break;
      case 'video':
        // Navigate to video
        break;
      case 'match':
        // Navigate to match
        break;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <HomeHeader
        onMenuPress={toggleSideMenu}
        onSearchPress={handleSearchPress}
        onNotificationPress={hapticFeedback}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              hapticFeedback();
              onRefresh();
            }}
            tintColor="#22c55e"
            colors={['#22c55e']}
          />
        }
      >
        <WelcomeSection
          isGuest={isGuest}
          username={username}
          onRegisterPress={hapticFeedback}
          onCreateCardPress={hapticFeedback}
        />

        <VideosSection
          videos={getCurrentVideos}
          isLoading={isLoading}
          imageErrors={imageErrors}
          onImageError={handleImageError}
          onVideoPress={hapticFeedback}
          onViewAllPress={hapticFeedback}
        />

        <PlayersSection
          players={getCurrentPlayers}
          isLoading={isLoading}
          imageErrors={imageErrors}
          onImageError={handleImageError}
          onPlayerPress={hapticFeedback}
          onViewAllPress={hapticFeedback}
        />

        <TeamSection
          team={currentTeam}
          onPlayerPress={hapticFeedback}
        />

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Transition Overlay */}
      {isTransitioning && (
        <Animated.View 
          pointerEvents="none" 
          style={[styles.overlay, { opacity: overlayOpacity }]}
        >
          <Animated.View
            style={[
              styles.overlayIconWrap,
              {
                transform: [
                  { scale: ballScale },
                  {
                    rotate: ballRotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg']
                    })
                  }
                ]
              }
            ]}
          >
            <Ionicons name="football" size={120} color="#d4af37" />
          </Animated.View>
        </Animated.View>
      )}

      <SideMenu
        visible={sideMenuVisible}
        animValue={sideMenuAnim}
        onClose={toggleSideMenu}
        onLogout={handleLogout}
        onMenuItemPress={handleMenuItemPress}
      />

      {/* Advanced Search Bar */}
      <AdvancedSearchBar
        visible={searchVisible}
        onClose={handleSearchClose}
        onResultSelect={handleSearchResult}
      />
    </View>
  );
}