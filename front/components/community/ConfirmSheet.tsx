import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { glassProps, GlassWrapper } from '../../constants/ui';
import { C } from './theme';

interface Props {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  fontFamily?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Dark glass confirm card — replaces the system white Alert. */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = true,
  fontFamily,
  onConfirm,
  onClose,
}: Props) {
  const confirmColors = destructive ? (['#F87171', '#B91C1C'] as const) : (['#A78BFA', '#7C3AED'] as const);
  const iconBg = destructive ? 'rgba(248,113,113,0.14)' : 'rgba(167,139,250,0.16)';
  const iconColor = destructive ? '#FCA5A5' : '#DDD6FE';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible && (
        <View style={styles.root}>
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={cancelLabel} />
          </Animated.View>
          <Animated.View
            entering={ZoomIn.springify().damping(18).stiffness(240)}
            exiting={ZoomOut.duration(140)}
            style={styles.card}
          >
            <GlassWrapper {...(glassProps.overlay as object)} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={destructive ? ['rgba(248,113,113,0.55)', 'transparent'] : ['rgba(167,139,250,0.55)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topAccent}
            />
            <View style={[styles.iconRing, { backgroundColor: iconBg }]}>
              <AlertTriangle size={22} color={iconColor} strokeWidth={2.2} />
            </View>
            <Text style={[styles.title, { fontFamily }]}>{title}</Text>
            {!!body && <Text style={[styles.body, { fontFamily }]}>{body}</Text>}
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  onClose();
                  onConfirm();
                }}
                style={styles.confirmWrap}
                accessibilityRole="button"
              >
                <LinearGradient colors={confirmColors} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.confirm}>
                  <Text style={[styles.confirmText, { fontFamily }]}>{confirmLabel}</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
                <Text style={[styles.cancelText, { fontFamily }]}>{cancelLabel}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#120C1E',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: C.textStrong,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    width: '100%',
    gap: 8,
    marginTop: 20,
  },
  confirmWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirm: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancel: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
