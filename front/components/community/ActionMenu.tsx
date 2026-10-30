import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { C } from './theme';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  items: ActionMenuItem[];
  cancelLabel: string;
  onClose: () => void;
  fontFamily?: string;
  /** Optional header above the action rows (e.g. report reason prompt). */
  title?: string;
}

const SPRING = { damping: 26, stiffness: 280, mass: 0.85 } as const;
const SHEET_OFFSCREEN = 480;

/**
 * Community bottom sheet — slides up from the bottom with a spring, fades the
 * backdrop, and waits for the exit animation before unmounting.
 */
export function ActionMenu({ visible, items, cancelLabel, onClose, fontFamily, title }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  const translateY = useSharedValue(SHEET_OFFSCREEN);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    backdrop.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) });
    translateY.value = withTiming(
      SHEET_OFFSCREEN,
      { duration: 220, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [visible, mounted, backdrop, translateY]);

  useEffect(() => {
    if (!mounted || !visible) return;
    translateY.value = SHEET_OFFSCREEN;
    backdrop.value = 0;
    const id = requestAnimationFrame(() => {
      backdrop.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      translateY.value = withSpring(0, SPRING);
    });
    return () => cancelAnimationFrame(id);
  }, [mounted, visible, backdrop, translateY]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={cancelLabel} />
        </Animated.View>
        <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.grabber} />
          {!!title && (
            <Text style={[styles.title, { fontFamily }]} accessibilityRole="header">
              {title}
            </Text>
          )}
          <View style={styles.group}>
            {items.map((item, i) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  onClose();
                  setTimeout(item.onPress, 220);
                }}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
                accessibilityRole="button"
              >
                {item.icon}
                <Text style={[styles.label, { fontFamily }, item.destructive && styles.destructive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.group, styles.cancel, pressed && styles.rowPressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.label, styles.cancelLabel, { fontFamily }]}>{cancelLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: C.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.inputBorder,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3348',
    marginBottom: 12,
  },
  title: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  group: {
    backgroundColor: C.input,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.inputBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.inputBorder,
  },
  label: {
    color: C.textStrong,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  destructive: {
    color: C.danger,
  },
  cancel: {
    marginTop: 10,
    paddingVertical: 16,
  },
  cancelLabel: {
    color: C.muted,
  },
});
