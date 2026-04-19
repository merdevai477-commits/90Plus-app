/**
 * CouponsBar Component
 * Migrated to react-native-reanimated
 * Displays available coupon numbers
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  FadeInRight,
  SharedValue,
} from 'react-native-reanimated';

interface CouponsBarProps {
  activeCoupon?: number; // 1-10
  onCouponPress?: (couponNumber: number) => void;
  matchesCount?: number; // Show only if matches exist
}

const CouponsBar: React.FC<CouponsBarProps> = ({
  activeCoupon = 1,
  onCouponPress,
  matchesCount = 0,
}) => {
  // Array of shared values for each coupon button
  const scaleValues = Array(10)
    .fill(0)
    .map(() => useSharedValue(1));

  // Only render if matches exist
  if (matchesCount === 0) {
    return null;
  }

  const handleCouponPress = (couponNumber: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const animIndex = couponNumber - 1;
    const scale = scaleValues[animIndex];

    // Scale animation
    scale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );

    if (onCouponPress) {
      onCouponPress(couponNumber);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {Array.from({ length: 10 }, (_, i) => {
          const couponNumber = i + 1;
          const isActive = couponNumber === activeCoupon;
          const animIndex = i;
          const scale = scaleValues[animIndex];

          const animatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: scale.value }],
          }));

          return (
            <Animated.View
              key={couponNumber}
              entering={FadeInRight.delay(i * 50).springify()}
              style={styles.couponWrapper}
            >
              <Animated.View style={[styles.couponContainer, animatedStyle]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleCouponPress(couponNumber)}
                  style={styles.couponButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Coupon ${couponNumber}`}
                  accessibilityState={{ selected: isActive }}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={['#3B82F6', '#60A5FA', '#3B82F6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.activeGradient}
                    >
                      <Zap size={16} color="#FFFFFF" fill="#FFFFFF" />
                      <Text style={styles.activeText}>{couponNumber}/10</Text>
                      {/* Glow effect */}
                      <View style={styles.glow} />
                    </LinearGradient>
                  ) : (
                    <View style={styles.inactiveContainer}>
                      <Text style={styles.inactiveText}>{couponNumber}/10</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingRight: 16,
    gap: 12,
  },
  couponWrapper: {
    marginRight: 0,
  },
  couponContainer: {
    width: 56,
    height: 56,
  },
  couponButton: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
  },
  activeGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.5)',
    position: 'relative',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  inactiveContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  inactiveText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  glow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 38,
    backgroundColor: '#3B82F6',
    opacity: 0.2,
    zIndex: -1,
  },
});

export default CouponsBar;
