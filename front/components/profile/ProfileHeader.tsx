import React, { memo } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 420;

interface ProfileHeaderProps {
  coverImage?: { uri: string };
  onPress?: () => void;
}

const ProfileHeader = memo(function ProfileHeader({ coverImage, onPress }: ProfileHeaderProps) {
  const defaultCoverUri =
    'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=2070&auto=format&fit=crop';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.coverContainer}
        onPress={onPress}
        activeOpacity={0.95}
      >
        {/* Cover image */}
        <Image
          source={coverImage || { uri: defaultCoverUri }}
          style={styles.coverImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          transition={400}
        />

        {/* Multi-stop gradient: transparent top → deep black bottom */}
        <LinearGradient
          colors={[
            'transparent',
            'rgba(0,0,0,0.15)',
            'rgba(0,0,0,0.55)',
            'rgba(0,0,0,0.88)',
            '#000000',
          ]}
          locations={[0, 0.35, 0.6, 0.82, 1]}
          style={styles.gradient}
        />
      </TouchableOpacity>
    </View>
  );
});

export default ProfileHeader;

const styles = StyleSheet.create({
  container: {},
  coverContainer: {
    height: COVER_HEIGHT,
    width,
    position: 'relative',
    backgroundColor: '#0a0a0a',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
  },
});
