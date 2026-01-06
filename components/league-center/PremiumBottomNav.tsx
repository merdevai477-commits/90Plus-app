import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Target, Flame } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface PremiumBottomNavProps {
  activeTab: 'predictions' | 'matches';
  onTabChange: (tab: 'predictions' | 'matches') => void;
}

const PremiumBottomNav: React.FC<PremiumBottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  const insets = useSafeAreaInsets();

  const handleTabPress = (tab: 'predictions' | 'matches') => {
    if (activeTab !== tab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onTabChange(tab);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(15, 15, 26, 0.95)', 'rgba(15, 15, 26, 0.85)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {/* Predictions Tab */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => handleTabPress('predictions')}
          activeOpacity={0.8}
        >
          {activeTab === 'predictions' ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={styles.activeTabContainer}
            >
              <LinearGradient
                colors={['#3B82F6', '#60A5FA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activeGradient}
              >
                <Target size={20} color="#FFFFFF" />
                <Text style={styles.activeText}>توقعات</Text>
                <View style={styles.glow} />
              </LinearGradient>
            </Animated.View>
          ) : (
            <View style={styles.inactiveTabContainer}>
              <Target size={20} color="rgba(255, 255, 255, 0.5)" />
              <Text style={styles.inactiveText}>توقعات</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Matches Tab */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => handleTabPress('matches')}
          activeOpacity={0.8}
        >
          {activeTab === 'matches' ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={styles.activeTabContainer}
            >
              <LinearGradient
                colors={['#EF4444', '#F87171']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activeGradient}
              >
                <Flame size={20} color="#FFFFFF" />
                <Text style={styles.activeText}>مباريات</Text>
                <View style={styles.glow} />
              </LinearGradient>
            </Animated.View>
          ) : (
            <View style={styles.inactiveTabContainer}>
              <Flame size={20} color="rgba(255, 255, 255, 0.5)" />
              <Text style={styles.inactiveText}>مباريات</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 50, // Lower than main BottomNav but visible
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 12,
  },
  tabButton: {
    flex: 1,
    height: 50,
  },
  activeTabContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  activeGradient: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  inactiveTabContainer: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  inactiveText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  glow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 21,
    backgroundColor: '#3B82F6',
    opacity: 0.2,
    zIndex: -1,
  },
});

export default PremiumBottomNav;

