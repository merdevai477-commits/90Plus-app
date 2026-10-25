import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { Tap } from './Tap';
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
}

export function ActionMenu({ visible, items, cancelLabel, onClose, fontFamily }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={cancelLabel} />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.springify().damping(20).stiffness(220)}
            exiting={SlideOutDown.duration(160)}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
          >
            <View style={styles.grabber} />
            <View style={styles.group}>
              {items.map((item, i) => (
                <Tap
                  key={item.key}
                  onPress={() => {
                    onClose();
                    setTimeout(item.onPress, 180);
                  }}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                  pressedStyle={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  accessibilityRole="button"
                >
                  {item.icon}
                  <Text style={[styles.label, { fontFamily }, item.destructive && { color: C.danger }]}>{item.label}</Text>
                </Tap>
              ))}
            </View>
            <Tap onPress={onClose} style={[styles.group, styles.cancel]} accessibilityRole="button">
              <Text style={[styles.label, styles.cancelLabel, { fontFamily }]}>{cancelLabel}</Text>
            </Tap>
          </Animated.View>
        </View>
      )}
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
  cancel: {
    marginTop: 10,
    paddingVertical: 16,
  },
  cancelLabel: {
    color: C.muted,
  },
});
