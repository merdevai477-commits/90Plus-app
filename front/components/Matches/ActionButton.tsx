import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useHaptics } from '../Home/useHaptics';

// Types
interface ActionButtonProps {
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  color?: string;
  size?: number;
}

// Constants
const COLORS = {
  primary: '#FFD700',
  error: '#FF5252',
};

// Helper function to format numbers
const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

// Enhanced Action Button Component
export const ActionButton: React.FC<ActionButtonProps> = ({ 
  icon, 
  count, 
  active, 
  onPress, 
  accessibilityLabel, 
  accessibilityHint, 
  color = 'white', 
  size = 28 
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const haptic = useHaptics();

  const handlePress = () => {
    haptic.hapticFeedback();
    
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        })
      ]),
      active ? Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.elastic(1)
      }) : Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
    
    onPress();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <TouchableOpacity 
      onPress={handlePress} 
      style={styles.actionButton}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      activeOpacity={0.8}
    >
      <Animated.View style={[
        styles.actionIconContainer,
        active && styles.actionIconActive,
        { 
          transform: [
            { scale: scaleAnim },
            { rotate: active ? spin : '0deg' }
          ] 
        }
      ]}>
        {icon}
      </Animated.View>
      {count !== undefined && (
        <Text style={styles.actionCount}>
          {formatCount(count)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    backdropFilter: 'blur(10px)',
  },
  actionIconActive: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  actionCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
