import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const TransferCardSkeleton = () => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <AnimatedLinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.playerPhoto, animatedStyle]}
          />
          <View style={styles.playerInfo}>
            <AnimatedLinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.playerNameSkeleton, animatedStyle]}
            />
            <AnimatedLinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.dateSkeleton, animatedStyle]}
            />
          </View>
        </View>

        <View style={styles.transferDetails}>
          <View style={styles.teamBox}>
            <AnimatedLinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.teamLogoSkeleton, animatedStyle]}
            />
            <AnimatedLinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.teamNameSkeleton, animatedStyle]}
            />
          </View>

          <View style={styles.transferArrow}>
            <AnimatedLinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.arrowSkeleton, animatedStyle]}
            />
          </View>

          <View style={styles.teamBox}>
            <AnimatedLinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.teamLogoSkeleton, animatedStyle]}
            />
            <AnimatedLinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.teamNameSkeleton, animatedStyle]}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  playerInfo: {
    flex: 1,
  },
  playerNameSkeleton: {
    height: 18,
    width: '70%',
    borderRadius: 4,
    marginBottom: 8,
  },
  dateSkeleton: {
    height: 13,
    width: '40%',
    borderRadius: 4,
  },
  transferDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  teamBox: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogoSkeleton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  teamNameSkeleton: {
    height: 12,
    width: '80%',
    borderRadius: 4,
  },
  transferArrow: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  arrowSkeleton: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});

