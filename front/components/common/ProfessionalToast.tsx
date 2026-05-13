import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

const { width } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

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

/**
 * Visual tokens for each toast variant.
 *
 * The surface is a translucent glass layer (LiquidGlass on supported iOS
 * devices, BlurView elsewhere). The brand color shows up only as the
 * icon-circle fill, the progress bar, a tinted border, and a soft drop
 * shadow — so the overall look stays clean glass instead of a solid
 * block of color.
 */
const getToastConfig = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        accent: '#22c55e',
        accentSoft: 'rgba(34,197,94,0.32)',
        glassTint: 'rgba(22,42,30,0.55)',
        icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
      };
    case 'error':
      return {
        accent: '#ef4444',
        accentSoft: 'rgba(239,68,68,0.32)',
        glassTint: 'rgba(48,18,22,0.55)',
        icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
      };
    case 'warning':
      return {
        accent: '#f59e0b',
        accentSoft: 'rgba(245,158,11,0.32)',
        glassTint: 'rgba(50,35,10,0.55)',
        icon: 'warning' as keyof typeof Ionicons.glyphMap,
      };
    case 'info':
      return {
        accent: '#3b82f6',
        accentSoft: 'rgba(59,130,246,0.32)',
        glassTint: 'rgba(15,30,55,0.55)',
        icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
      };
    case 'loading':
      return {
        accent: '#a855f7',
        accentSoft: 'rgba(168,85,247,0.32)',
        glassTint: 'rgba(30,18,50,0.55)',
        icon: 'sync' as keyof typeof Ionicons.glyphMap,
      };
    default:
      return {
        accent: '#6b7280',
        accentSoft: 'rgba(107,114,128,0.32)',
        glassTint: 'rgba(25,25,28,0.55)',
        icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
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
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const config = getToastConfig(type);

  useEffect(() => {
    if (visible) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 9,
        }),
      ]).start();

      // Loading variant: don't auto-dismiss; parent controls it.
      if (type !== 'loading') {
        timeoutRef.current = setTimeout(() => hideToast(), duration);
      }
    } else {
      hideToast();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible, type, duration]);

  // Loading spinner animation for the sync icon
  useEffect(() => {
    if (type === 'loading' && visible) {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [type, visible, spinAnim]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
        tension: 120,
        friction: 10,
      }),
    ]).start(() => {
      onHide();
    });
  };

  const getTranslateY = () => {
    switch (position) {
      case 'top':
        return slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] });
      case 'bottom':
        return slideAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
      case 'center':
      default:
        return slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });
    }
  };

  const getPositionStyle = () => {
    switch (position) {
      case 'top':
        return { top: 60 };
      case 'center':
        return { top: '50%' as any, marginTop: -50 };
      case 'bottom':
        return { bottom: 100 };
      default:
        return { top: 60 };
    }
  };

  if (!visible) return null;

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, getPositionStyle(), { pointerEvents: 'box-none' }]}>
      <Animated.View
        style={[
          styles.toastContainer,
          {
            borderColor: config.accentSoft,
            shadowColor: config.accent,
            transform: [{ translateY: getTranslateY() }, { scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* ── Liquid Glass background ─────────────────────────────── */}
        {isLiquidGlassSupported ? (
          <LiquidGlassView
            {...({
              style: StyleSheet.absoluteFill,
              tint: config.glassTint,
              effect: 'regular',
              interactive: false,
            } as any)}
          />
        ) : (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        )}

        {/* Subtle accent wash across the glass (adds color without flooding it) */}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: config.accentSoft, opacity: 0.35 }]}
        />

        {/* ── Content ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.content}
          onPress={onPress || hideToast}
          activeOpacity={onPress ? 0.7 : 0.9}
        >
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: config.accent, shadowColor: config.accent }]}>
            {type === 'loading' ? (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name={config.icon} size={22} color="#fff" />
              </Animated.View>
            ) : (
              <Ionicons name={config.icon} size={24} color="#fff" />
            )}
          </View>

          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.message} numberOfLines={2}>{message}</Text>
          </View>

          {/* Close button (hidden while loading so user doesn't dismiss early) */}
          {type !== 'loading' && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={hideToast}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Progress bar (hidden for loading since there's no fixed duration) */}
        {type !== 'loading' && (
          <View style={[styles.progressBar, { backgroundColor: config.accent }]} />
        )}
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
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 14,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    minHeight: 72,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 6,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  message: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  closeButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  progressBar: {
    height: 2,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.8,
  },
});

export default ProfessionalToast;
