import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AtSign,
  Ban,
  Copy,
  Flag,
  ImagePlus,
  MessageCircleReply,
  Pencil,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from 'lucide-react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTranslation } from '../../src/i18n';
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

function iconForKey(key: string, destructive?: boolean) {
  const color = destructive ? '#FCA5A5' : C.accentSoft;
  const size = 18;
  const stroke = 2.2;
  switch (key) {
    case 'edit':
      return <Pencil size={size} color={color} strokeWidth={stroke} />;
    case 'photo':
      return <ImagePlus size={size} color={color} strokeWidth={stroke} />;
    case 'copy':
      return <Copy size={size} color={color} strokeWidth={stroke} />;
    case 'delete':
      return <Trash2 size={size} color={color} strokeWidth={stroke} />;
    case 'report':
      return <Flag size={size} color={color} strokeWidth={stroke} />;
    case 'reply':
      return <MessageCircleReply size={size} color={color} strokeWidth={stroke} />;
    case 'profile':
      return <UserRound size={size} color={color} strokeWidth={stroke} />;
    case 'SPAM':
      return <Ban size={size} color={color} strokeWidth={stroke} />;
    case 'HARASSMENT':
      return <ShieldAlert size={size} color={color} strokeWidth={stroke} />;
    case 'INAPPROPRIATE':
      return <Flag size={size} color={color} strokeWidth={stroke} />;
    case 'FAKE_INFO':
      return <ShieldAlert size={size} color={color} strokeWidth={stroke} />;
    case 'OTHER':
      return <AtSign size={size} color={color} strokeWidth={stroke} />;
    default:
      return destructive ? <Trash2 size={size} color={color} strokeWidth={stroke} /> : null;
  }
}

/**
 * Community bottom sheet — slides up from the bottom with a spring, fades the
 * backdrop, and waits for the exit animation before unmounting.
 */
export function ActionMenu({ visible, items, cancelLabel, onClose, fontFamily, title }: Props) {
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const isRtl = language === 'ar';
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

  const rows = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        resolvedIcon: item.icon ?? iconForKey(item.key, item.destructive),
      })),
    [items],
  );

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={cancelLabel} />
        </Animated.View>
        <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: Math.max(insets.bottom, 10) + 10 }]}>
          <LinearGradient
            colors={['rgba(167,139,250,0.22)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.sheetGlow}
            pointerEvents="none"
          />
          <View style={styles.grabber} />
          {!!title && (
            <Text style={[styles.title, { fontFamily }]} accessibilityRole="header">
              {title}
            </Text>
          )}
          <View style={styles.group}>
            {rows.map((item, i) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  onClose();
                  setTimeout(item.onPress, 220);
                }}
                style={({ pressed }) => [
                  styles.row,
                  { flexDirection: isRtl ? 'row-reverse' : 'row' },
                  i > 0 && styles.rowDivider,
                  pressed && (item.destructive ? styles.rowPressedDanger : styles.rowPressed),
                ]}
                accessibilityRole="button"
              >
                {item.resolvedIcon ? (
                  <View style={[styles.iconWrap, item.destructive && styles.iconWrapDanger]}>{item.resolvedIcon}</View>
                ) : (
                  <View style={styles.iconSpacer} />
                )}
                <Text
                  style={[
                    styles.label,
                    { fontFamily, textAlign: isRtl ? 'right' : 'left' },
                    item.destructive && styles.destructive,
                  ]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}
            accessibilityRole="button"
          >
            <View style={[styles.cancelInner, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <View style={styles.iconWrapMuted}>
                <X size={16} color={C.muted} strokeWidth={2.4} />
              </View>
              <Text style={[styles.cancelLabel, { fontFamily }]}>{cancelLabel}</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: '#0B0714',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(183,154,248,0.18)',
    overflow: 'hidden',
  },
  sheetGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 14,
  },
  title: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 18,
    lineHeight: 20,
  },
  group: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(183,154,248,0.14)',
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowPressed: {
    backgroundColor: 'rgba(167,139,250,0.10)',
  },
  rowPressedDanger: {
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
  },
  iconWrapDanger: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(239,68,68,0.22)',
  },
  iconWrapMuted: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconSpacer: {
    width: 36,
  },
  label: {
    flex: 1,
    color: C.textStrong,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  destructive: {
    color: '#FCA5A5',
  },
  cancel: {
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 54,
    justifyContent: 'center',
  },
  cancelInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  cancelLabel: {
    color: C.muted,
    fontSize: 15,
    fontWeight: '700',
  },
});
