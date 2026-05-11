/**
 * MessageContextMenu.tsx — Native
 * Liquid Glass context menu with professional death effect animation.
 * Triggered by long-press on user messages.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Rect, Path, Polyline } from 'react-native-svg';
import {
  Colors,
  Radius,
  FontSize,
  Spacing,
  BlurIntensity,
} from '../../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageContextMenuProps {
  messageText: string;
  onResend: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onClose: () => void;
}

interface MenuItemProps {
  icon: React.ReactNode;
  text: string;
  onPress: () => void;
  danger?: boolean;
  delay?: number;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect
        x={9} y={9} width={13} height={13} rx={2} ry={2}
        stroke={Colors.white70}
        strokeWidth={1.5}
      />
      <Path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke={Colors.white70}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function ResendIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="1 4 1 10 7 10"
        stroke={Colors.white70}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"
        stroke={Colors.white70}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function EditIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke={Colors.white70}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke={Colors.white70}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DeleteIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="3 6 5 6 21 6"
        stroke={Colors.error}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke={Colors.error}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Menu Item ────────────────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function MenuItem({ icon, text, onPress, danger = false, delay = 0 }: MenuItemProps) {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: `rgba(255,255,255,${bgOpacity.value})`,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { stiffness: 400, damping: 20 });
    bgOpacity.value = withTiming(0.08, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
    bgOpacity.value = withTiming(0, { duration: 120 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(200)}
    >
      <AnimatedPressable
        style={[styles.menuItem, animStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <View style={styles.menuItemIcon}>{icon}</View>
        <Text style={[styles.menuItemText, danger && styles.menuItemTextDanger]}>
          {text}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MessageContextMenu({
  messageText,
  onResend,
  onEdit,
  onDelete,
  onCopy,
  onClose,
}: MessageContextMenuProps) {
  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* ── Blurred backdrop with dark overlay ── */}
      <Animated.View
        entering={FadeIn.duration(250)}
        exiting={FadeOut.duration(200)}
        style={StyleSheet.absoluteFill}
      >
        <TouchableWithoutFeedback onPress={onClose} accessibilityLabel="Close menu">
          <View style={styles.backdrop}>
            <BlurView
              intensity={BlurIntensity.contextMenu}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.backdropOverlay} />
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* ── Menu — slides up from bottom with spring ── */}
      <Animated.View
        entering={SlideInDown
          .springify()
          .stiffness(280)
          .damping(24)
          .mass(0.8)
          .delay(50)}
        exiting={SlideOutDown
          .duration(200)}
        style={styles.menuContainer}
        pointerEvents="box-none"
      >
        <View style={styles.menu}>
          {/* Glass blur base */}
          <BlurView
            intensity={BlurIntensity.contextMenu}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />

          {/* Solid fallback */}
          <View style={styles.menuFallback} />

          {/* Gradient shimmer overlay */}
          <LinearGradient
            colors={[
              'rgba(255,255,255,0.06)',
              'rgba(124,58,237,0.04)',
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Inset highlight top edge */}
          <View style={styles.menuInsetHighlight} />

          {/* Handle bar */}
          <View style={styles.handleBar} />

          <View style={styles.menuContent}>
            {/* ── Message preview ── */}
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Message</Text>
              <Text style={styles.previewText} numberOfLines={2}>
                {messageText}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* ── Actions ── */}
            <MenuItem icon={<CopyIcon />}   text="Copy"           onPress={onCopy}   delay={80} />
            <MenuItem icon={<ResendIcon />} text="Resend"         onPress={onResend} delay={120} />
            <MenuItem icon={<EditIcon />}   text="Edit"           onPress={onEdit}   delay={160} />

            <View style={styles.divider} />

            <MenuItem icon={<DeleteIcon />} text="Delete"         onPress={onDelete} danger delay={200} />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing['4xl'],
  },
  menu: {
    borderRadius: Radius['3xl'],
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 30,
  },
  menuFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,8,20,0.97)',
  },
  menuInsetHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  menuContent: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },

  // ── Message preview ──
  previewContainer: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  previewLabel: {
    fontSize: FontSize.xs,
    color: Colors.white30,
    textAlign: 'left',
    letterSpacing: 0.5,
  },
  previewText: {
    fontSize: FontSize.md,
    color: Colors.white50,
    textAlign: 'left',
    lineHeight: FontSize.md * 1.6,
  },

  // ── Menu Item ──
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md + 2,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.xs,
  },
  menuItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    flex: 1,
    fontSize: FontSize['2xl'],
    fontWeight: '500',
    color: Colors.white80,
    textAlign: 'left',
  },
  menuItemTextDanger: {
    color: Colors.error,
  },

  // ── Divider ──
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
  },
});