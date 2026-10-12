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
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Copy, Pencil, Pin, PinOff, Trash2 } from 'lucide-react-native';
import { Radius, FontSize, Spacing, BlurIntensity } from '../../constants/theme';
import { useTranslation } from '../../src/i18n';

const FILM_ACCENT = '#A3DDF9';
const DANGER = '#FF6B8B';
/** Top edge of the sheet, in the welcome bubble's film colours. */
const EDGE_COLORS = [
  'rgba(163,221,249,0)',
  '#A3DDF9',
  '#7A388B',
  '#216ACE',
  '#DD7EBB',
  '#36A2FB',
  'rgba(54,162,251,0)',
] as const;
const ICON_SIZE = 17;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationContextMenuProps {
  conversationTitle: string;
  isPinned: boolean;
  onPin: () => void;
  onRename: () => void;
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

// ─── Menu Item ────────────────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MenuItem = React.memo(({ icon, text, onPress, danger = false, delay = 0 }: MenuItemProps) => {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: danger
      ? `rgba(255,107,139,${bgOpacity.value})`
      : `rgba(163,221,249,${bgOpacity.value})`,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.98, { duration: 90 });
    bgOpacity.value = withTiming(0.08, { duration: 80 });
  }, [scale, bgOpacity]);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: 140 });
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
        <View style={[styles.menuItemIcon, danger && styles.menuItemIconDanger]}>{icon}</View>
        <Text style={[styles.menuItemText, danger && styles.menuItemTextDanger]}>
          {text}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
});

MenuItem.displayName = 'MenuItem';

const Divider = React.memo(() => <View style={styles.divider} />);
Divider.displayName = 'Divider';

// ─── Component ────────────────────────────────────────────────────────────────

export const ConversationContextMenu = React.memo(({
  conversationTitle,
  isPinned,
  onPin,
  onRename,
  onDelete,
  onCopy,
  onClose,
}: ConversationContextMenuProps) => {
  const { t } = useTranslation();
  const cm = t.chat.contextMenu;
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
          <LinearGradient
            colors={['#0D0A1A', '#08070F']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
            <Defs>
              <RadialGradient id="menuGlow" cx="50%" cy="0%" r="80%">
                <Stop offset="0" stopColor="#6F24FB" stopOpacity="0.24" />
                <Stop offset="1" stopColor="#6F24FB" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#menuGlow)" />
          </Svg>
          <LinearGradient
            colors={EDGE_COLORS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.menuEdge}
            pointerEvents="none"
          />
          <View style={styles.handleBar} />

          <View style={styles.menuContent}>
            {/* Conversation title preview */}
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>{cm.conversationPreview}</Text>
              <Text style={styles.previewText} numberOfLines={1}>
                {conversationTitle?.trim() || '—'}
              </Text>
            </View>

            <Divider />

            <MenuItem
              icon={isPinned
                ? <PinOff size={ICON_SIZE} color={FILM_ACCENT} strokeWidth={2} />
                : <Pin size={ICON_SIZE} color={FILM_ACCENT} strokeWidth={2} />}
              text={isPinned ? cm.unpin : cm.pin}
              onPress={onPin}
              delay={80}
            />
            <MenuItem
              icon={<Pencil size={ICON_SIZE} color={FILM_ACCENT} strokeWidth={2} />}
              text={cm.rename}
              onPress={onRename}
              delay={110}
            />

            <Divider />

            <MenuItem
              icon={<Copy size={ICON_SIZE} color={FILM_ACCENT} strokeWidth={2} />}
              text={cm.copyConversation}
              onPress={onCopy}
              delay={140}
            />

            <Divider />

            <MenuItem
              icon={<Trash2 size={ICON_SIZE} color={DANGER} strokeWidth={2} />}
              text={cm.delete}
              onPress={onDelete}
              danger
              delay={170}
            />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
});
ConversationContextMenu.displayName = 'ConversationContextMenu';

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
    backgroundColor: '#08070F',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(163,221,249,0.12)',
    shadowColor: '#6F24FB',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 30,
  },
  menuEdge: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(163,221,249,0.25)',
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
    color: 'rgba(163,221,249,0.7)',
    textAlign: 'left',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  previewText: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(163,221,249,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(163,221,249,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemIconDanger: {
    backgroundColor: 'rgba(255,107,139,0.1)',
    borderColor: 'rgba(255,107,139,0.28)',
  },
  menuItemText: {
    flex: 1,
    fontSize: FontSize['2xl'],
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'left',
  },
  menuItemTextDanger: {
    color: DANGER,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(163,221,249,0.1)',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
  },
});
