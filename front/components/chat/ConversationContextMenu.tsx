/**
 * ConversationContextMenu.tsx — Native
 * Bottom-sheet context menu — same animation as MessageContextMenu.
 * Slides up from bottom with spring + blur backdrop.
 */

import React, { useCallback } from 'react';
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
import Svg, { Path, Rect, Circle, Line, Polyline } from 'react-native-svg';
import { Colors, Radius, FontSize, Spacing, BlurIntensity } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationContextMenuProps {
  conversationTitle: string;
  isPinned: boolean;
  onPin: () => void;
  onRename: () => void;
  onShare: () => void;
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

const PinIcon = React.memo(({ isPinned }: { isPinned: boolean }) => {
  const color = isPinned ? Colors.purpleSoft : Colors.white70;
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill={color}>
      <Path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z" />
    </Svg>
  );
});

const RenameIcon = React.memo(() => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path
      d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
      stroke={Colors.white70} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    />
    <Path
      d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
      stroke={Colors.white70} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
));

const CopyIcon = React.memo(() => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Rect x={9} y={9} width={13} height={13} rx={2} ry={2} stroke={Colors.white70} strokeWidth={1.5} />
    <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke={Colors.white70} strokeWidth={1.5} />
  </Svg>
));

const ShareIcon = React.memo(() => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Circle cx={18} cy={5} r={3} stroke={Colors.white70} strokeWidth={1.5} />
    <Circle cx={6} cy={12} r={3} stroke={Colors.white70} strokeWidth={1.5} />
    <Circle cx={18} cy={19} r={3} stroke={Colors.white70} strokeWidth={1.5} />
    <Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} stroke={Colors.white70} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} stroke={Colors.white70} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
));

const DeleteIcon = React.memo(() => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Polyline points="3 6 5 6 21 6" stroke={Colors.error} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path
      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      stroke={Colors.error} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
));

// ─── Menu Item ────────────────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MenuItem = React.memo(({ icon, text, onPress, danger = false, delay = 0 }: MenuItemProps) => {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: `rgba(255,255,255,${bgOpacity.value})`,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { stiffness: 400, damping: 20 });
    bgOpacity.value = withTiming(0.08, { duration: 80 });
  }, [scale, bgOpacity]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
    bgOpacity.value = withTiming(0, { duration: 120 });
  }, [scale, bgOpacity]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <Animated.View entering={FadeIn.delay(delay).duration(200)}>
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
});

const Divider = React.memo(() => <View style={styles.divider} />);

// ─── Component ────────────────────────────────────────────────────────────────

export const ConversationContextMenu = React.memo(({
  conversationTitle,
  isPinned,
  onPin,
  onRename,
  onShare,
  onDelete,
  onCopy,
  onClose,
}: ConversationContextMenuProps) => {
  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {/* ── Blurred backdrop ── */}
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

      {/* ── Menu — slides up from bottom ── */}
      <Animated.View
        entering={SlideInDown
          .springify()
          .stiffness(280)
          .damping(24)
          .mass(0.8)
          .delay(50)}
        exiting={SlideOutDown.duration(200)}
        style={styles.menuContainer}
        pointerEvents="box-none"
      >
        <View style={styles.menu}>
          {/* Glass blur */}
          <BlurView
            intensity={BlurIntensity.contextMenu}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          {/* Solid fallback */}
          <View style={styles.menuFallback} />
          {/* Gradient shimmer */}
          <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'rgba(124,58,237,0.04)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Inset top highlight */}
          <View style={styles.menuInsetHighlight} />
          {/* Handle bar */}
          <View style={styles.handleBar} />

          <View style={styles.menuContent}>
            {/* Conversation title preview */}
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Conversation</Text>
              <Text style={styles.previewText} numberOfLines={1}>
                {conversationTitle}
              </Text>
            </View>

            <Divider />

            <MenuItem
              icon={<PinIcon isPinned={isPinned} />}
              text={isPinned ? 'Unpin' : 'Pin to top'}
              onPress={onPin}
              delay={80}
            />
            <MenuItem
              icon={<RenameIcon />}
              text="Rename"
              onPress={onRename}
              delay={110}
            />

            <Divider />

            <MenuItem
              icon={<CopyIcon />}
              text="Copy conversation"
              onPress={onCopy}
              delay={140}
            />
            <MenuItem
              icon={<ShareIcon />}
              text="Share"
              onPress={onShare}
              delay={170}
            />

            <Divider />

            <MenuItem
              icon={<DeleteIcon />}
              text="Delete"
              onPress={onDelete}
              danger
              delay={200}
            />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
});

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
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
  },
});
