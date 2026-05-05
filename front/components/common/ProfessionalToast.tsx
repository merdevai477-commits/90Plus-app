import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ProfessionalToastProps {
  visible: boolean;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  onHide: () => void;
  position?: 'top' | 'center' | 'bottom';
  onPress?: () => void;
}

const getToastConfig = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.95)', // Green
        borderColor: '#22c55e',
        icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
        iconColor: '#ffffff',
        shadowColor: '#22c55e',
      };
    case 'error':
      return {
        backgroundColor: 'rgba(239, 68, 68, 0.95)', // Red
        borderColor: '#ef4444',
        icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
        iconColor: '#ffffff',
        shadowColor: '#ef4444',
      };
    case 'warning':
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.95)', // Orange
        borderColor: '#f59e0b',
        icon: 'warning' as keyof typeof Ionicons.glyphMap,
        iconColor: '#ffffff',
        shadowColor: '#f59e0b',
      };
    case 'info':
      return {
        backgroundColor: 'rgba(59, 130, 246, 0.95)', // Blue
        borderColor: '#3b82f6',
        icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
        iconColor: '#ffffff',
        shadowColor: '#3b82f6',
      };
    default:
      return {
        backgroundColor: 'rgba(107, 114, 128, 0.95)', // Gray
        borderColor: '#6b7280',
        icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
        iconColor: '#ffffff',
        shadowColor: '#6b7280',
      };
  }
};

export const ProfessionalToast: React.FC<ProfessionalToastProps> = ({
  visible,
  type,
  title,
  message,
  duration = 4000,
  onHide,
  position = 'top',
  onPress,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = getToastConfig(type);

  useEffect(() => {
    if (visible) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Show animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();

      // Auto hide after duration
      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    } else {
      hideToast();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 0.8,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
    ]).start(() => {
      onHide();
    });
  };

  const getTranslateY = () => {
    switch (position) {
      case 'top':
        return slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-100, 0],
        });
      case 'center':
        return slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0],
        });
      case 'bottom':
        return slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [100, 0],
        });
      default:
        return slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-100, 0],
        });
    }
  };

  const getPositionStyle = () => {
    switch (position) {
      case 'top':
        return { top: 60 };
      case 'center':
        return { 
          top: '50%' as any,
          marginTop: -50,
        };
      case 'bottom':
        return { bottom: 100 };
      default:
        return { top: 60 };
    }
  };

  if (!visible) return null;

  return (
    <View style={[styles.container, getPositionStyle(), { pointerEvents: 'box-none' }]}>
      <Animated.View
        style={[
          styles.toastContainer,
          {
            backgroundColor: config.backgroundColor,
            borderColor: config.borderColor,
            shadowColor: config.shadowColor,
            transform: [
              { translateY: getTranslateY() },
              { scale: scaleAnim },
            ],
            opacity: opacityAnim,
          },
        ]}
      >
        <BlurView intensity={20} style={styles.blurContainer}>
          <TouchableOpacity
            style={styles.content}
            onPress={onPress || hideToast}
            activeOpacity={onPress ? 0.7 : 0.9}
          >
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: config.borderColor }]}>
              <Ionicons
                name={config.icon}
                size={24}
                color={config.iconColor}
              />
            </View>

            {/* Content */}
            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.message} numberOfLines={2}>
                {message}
              </Text>
            </View>

            {/* Close button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={hideToast}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color="rgba(255, 255, 255, 0.8)" />
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>

        {/* Progress bar */}
        <View
          style={[
            styles.progressBar,
            {
              backgroundColor: config.borderColor,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastContainer: {
    width: width - 32,
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  blurContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 70,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  message: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBar: {
    height: 3,
    position: 'absolute',
    bottom: 0,
    left: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
});

export default ProfessionalToast;