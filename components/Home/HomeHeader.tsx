import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, Bell, Settings } from 'lucide-react-native';
import { COLORS } from '../reels/constants';
import { BlurView } from 'expo-blur';
import { CoinsBadge } from '../common/CoinsBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
      <BlurView intensity={20} tint="dark" style={styles.blurBackground} />

      <View style={styles.headerContent}>
        {/* Left: Settings */}
        <TouchableOpacity style={styles.iconButton} onPress={onSettingsPress}>
          <Settings color={COLORS.white} size={20} />
        </TouchableOpacity>

        {/* Right: Actions */}
        <View style={styles.rightActions}>
          {/* Coins Badge */}
          <View style={styles.coinsContainer}>
            <CoinsBadge />
          </View>

          <TouchableOpacity style={styles.iconButton} onPress={onSearchPress}>
            <Search color={COLORS.white} size={20} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={onNotificationPress}>
            <View style={styles.notificationDot} />
            <Bell color={COLORS.white} size={20} />
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
    height: 50, // Increased height slightly
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // Increased gap
    flex: 1,
    justifyContent: 'flex-end',
  },
  coinsContainer: {
    flexShrink: 0,
    marginRight: 4,
  },
  iconButton: {
    width: 40, // Slightly larger touch target
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    zIndex: 1,
    borderWidth: 1,
    borderColor: '#000',
  },
});