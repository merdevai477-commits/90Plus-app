import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ProfileHeader from '../../components/profile/ProfileHeader';
import ProfileCard from '../../components/profile/ProfileCard';
import UserInfo from '../../components/profile/UserInfo';
import StatsRow from '../../components/profile/StatsRow';
import ContentTabs from '../../components/profile/ContentTabs';
import VideoGrid from '../../components/profile/VideoGrid';
import ActionButtons from '../../components/profile/ActionButtons';
import { CoinsBadge } from '../../components/common/CoinsBadge';
import { ProfileTheme } from '../../constants/ProfileTheme';

// Dummy Data
const USER_DATA = {
  name: 'Mahmoud Essam',
  username: 'mrdev_',
  bio: 'لاعب كرة قدم محترف 🏃 | عاشق للرياضة ⚽ | مبرمج محترف',
  location: 'القاهرة، مصر',
  joinDate: 'انضم 2025/11/28',
  role: 'مهاجم',
  team: 'الأهلي',
  level: 25,
  currentXP: 2450,
  maxXP: 2600,
  coins: 15000,
  followers: '125.0K',
  following: '543',
  videosCount: '89',
};

const VIDEOS = [
  { id: '1', thumbnail: { uri: 'https://picsum.photos/200/300?random=1' }, views: '125.0K', duration: '0:45' },
  { id: '2', thumbnail: { uri: 'https://picsum.photos/200/300?random=2' }, views: '89.0K', duration: '1:20' },
  { id: '3', thumbnail: { uri: 'https://picsum.photos/200/300?random=3' }, views: '234.0K', duration: '2:15' },
  { id: '4', thumbnail: { uri: 'https://picsum.photos/200/300?random=4' }, views: '456.0K', duration: '0:30' },
  { id: '5', thumbnail: { uri: 'https://picsum.photos/200/300?random=5' }, views: '67.0K', duration: '1:45' },
  { id: '6', thumbnail: { uri: 'https://picsum.photos/200/300?random=6' }, views: '178.0K', duration: '0:55' },
];

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState('videos');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={ProfileTheme.colors.deepBlack} />

      {/* Coins Badge */}
      <View style={styles.coinsBadgeContainer}>
        <CoinsBadge />
      </View>

      {/* Settings Button */}
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => console.log('Settings')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[ProfileTheme.colors.glassWhite, 'rgba(255,255,255,0.05)']}
          style={styles.settingsGradient}
        >
          <Ionicons name="settings-outline" size={24} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ProfileHeader
          coverImage={{ uri: 'https://picsum.photos/800/400' }} // Placeholder cover
        />

        {/* Profile FIFA Card Frame */}
        <View style={styles.profileCardContainer}>
          <ProfileCard
            playerImage={{ uri: 'https://picsum.photos/200' }}
            cardType="gold"
            scale={0.6}
          />
        </View>

        <UserInfo
          name={USER_DATA.name}
          username={USER_DATA.username}
          bio={USER_DATA.bio}
          location={USER_DATA.location}
          joinDate={USER_DATA.joinDate}
          role={USER_DATA.role}
          team={USER_DATA.team}
        />

        <ActionButtons
          onEditPress={() => console.log('Edit')}
          onSharePress={() => console.log('Share')}
        />

        <StatsRow
          followers={USER_DATA.followers}
          following={USER_DATA.following}
          videos={USER_DATA.videosCount}
        />

        <ContentTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          videoCount={6} // Example count
        />

        {activeTab === 'videos' && <VideoGrid videos={VIDEOS} />}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ProfileTheme.colors.deepBlack,
    position: 'relative',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileCardContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  coinsBadgeContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
  },
  settingsButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    borderRadius: 22,
    overflow: 'hidden',
  },
  settingsGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
