import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Heart } from 'lucide-react-native';
import { useHaptics } from '../Home/useHaptics';

// Types
interface DoubleTapLikeAnimationProps {
  visible: boolean;
  position?: { x: number; y: number };
}

// Constants
const COLORS = {
  primary: '#FFD700',
};

// Enhanced Double Tap Animation Component
export const DoubleTapLikeAnimation: React.FC<DoubleTapLikeAnimationProps> = ({ 
  visible, 
  position = { x: 0, y: 0 } 
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const haptic = useHaptics();

  useEffect(() => {
    if (visible) {
      haptic.hapticFeedback();
      
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
            easing: Easing.in(Easing.ease)
          })
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
          })
        ]),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.elastic(1)
        })
      ]).start();
    }
  }, [visible, haptic, scaleAnim, opacityAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.doubleTapHeart,
        {
          left: position.x - 50,
          top: position.y - 50,
          transform: [
            { scale: scaleAnim },
            { rotate: spin }
          ],
          opacity: opacityAnim
        }
      ]}
    >
      <Heart size={100} color={COLORS.primary} fill={COLORS.primary} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  doubleTapHeart: {
    position: 'absolute',
    zIndex: 999,
    pointerEvents: 'none',
  },
});
