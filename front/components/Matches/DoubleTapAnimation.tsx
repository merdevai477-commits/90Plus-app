/**
 * DoubleTapLikeAnimation component
 *
 * Floating heart animation shown on double-tap for like interactions.
 * Used by the reels feed and the video player modal.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import { COLORS } from '../reels/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface DoubleTapLikeAnimationProps {
  visible: boolean;
  position?: { x: number; y: number };
  size?: number;
  color?: string;
}

export const DoubleTapLikeAnimation: React.FC<DoubleTapLikeAnimationProps> = ({
  visible,
  position = { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 },
  size = 100,
  color = COLORS.primary,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    rotateAnim.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          friction: 2,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
      ]),
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 400,
          delay: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.elastic(1),
      }),
    ]).start();
  }, [visible, scaleAnim, opacityAnim, rotateAnim]);

  if (!visible) return null;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          left: position.x - size / 2,
          top: position.y - size / 2,
          transform: [{ scale: scaleAnim }, { rotate: spin }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Heart size={size} color={color} fill={color} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 999,
  },
});

export default DoubleTapLikeAnimation;
