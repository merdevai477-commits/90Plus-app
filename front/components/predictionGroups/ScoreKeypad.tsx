/**
 * Numeric keypad for exact score entry — dark Figma-styled pad.
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePGFonts } from './theme';

const ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['back', '0', 'ok'],
];
const MAX_SCORE = 20;

export function ScoreKeypad({
  visible,
  title,
  value,
  confirmLabel,
  onChange,
  onConfirm,
  onClose,
  embedded,
}: {
  visible: boolean;
  title: string;
  value: number;
  confirmLabel: string;
  onChange: (n: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  embedded?: boolean;
}) {
  const { bold, medium } = usePGFonts();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (visible) setDraft(String(Math.max(0, value)));
  }, [visible, value]);

  const apply = useCallback(
    (next: string) => {
      const n = Math.min(MAX_SCORE, Math.max(0, parseInt(next || '0', 10)));
      setDraft(String(n));
      onChange(n);
    },
    [onChange],
  );

  const tapDigit = (d: string) => {
    Haptics.selectionAsync().catch(() => {});
    const raw = draft === '0' ? d : `${draft}${d}`;
    if (raw.length > 2) return;
    const n = parseInt(raw, 10);
    if (n > MAX_SCORE) {
      apply(String(MAX_SCORE));
      return;
    }
    apply(raw);
  };

  const backspace = () => {
    Haptics.selectionAsync().catch(() => {});
    if (draft.length <= 1) {
      apply('0');
      return;
    }
    apply(draft.slice(0, -1));
  };

  if (!visible) return null;

  const sheet = (
    <LinearGradient
      colors={['#0C051A', '#07040D']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[
        styles.sheet,
        embedded && styles.embeddedSheet,
        { paddingBottom: Math.max(insets.bottom, 14) + 10 },
      ]}
    >
      <View style={styles.handle} />
      <Text style={[styles.title, { fontFamily: bold }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.valueBox}>
        <Text style={[styles.value, { fontFamily: bold }]}>{draft}</Text>
      </View>

      <View style={styles.pad}>
        {ROWS.map((row) => (
          <View key={row.join('-')} style={styles.padRow}>
            {row.map((key) => {
              if (key === 'back') {
                return (
                  <Pressable
                    key={key}
                    onPress={backspace}
                    style={({ pressed }) => [
                      styles.key,
                      styles.keyMuted,
                      pressed && styles.keyPressed,
                    ]}
                  >
                    <Delete size={22} color="#E8E8E8" />
                  </Pressable>
                );
              }
              if (key === 'ok') {
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      onConfirm();
                    }}
                    style={({ pressed }) => [styles.key, pressed && { opacity: 0.9 }]}
                  >
                    <LinearGradient
                      colors={['#3D0AB3', '#190448']}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.confirmFill}
                    >
                      <Text style={[styles.confirmTxt, { fontFamily: medium }]} numberOfLines={1}>
                        {confirmLabel}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={key}
                  onPress={() => tapDigit(key)}
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                >
                  <Text style={[styles.keyTxt, { fontFamily: bold }]}>{key}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </LinearGradient>
  );

  if (embedded) {
    return (
      <View style={styles.embeddedRoot} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onClose} />
        {sheet}
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        {sheet}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,10,144,0.62)',
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 14,
    shadowColor: 'rgba(90,18,158,0.36)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 20,
  },
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 40,
  },
  embeddedSheet: {
    borderRadius: 28,
    marginHorizontal: 12,
    marginBottom: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  valueBox: {
    alignSelf: 'center',
    minWidth: 96,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#07040D',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#241830',
  },
  value: {
    color: '#C4A6FF',
    fontSize: 44,
    textAlign: 'center',
    lineHeight: 52,
  },
  pad: {
    gap: 10,
  },
  padRow: {
    flexDirection: 'row',
    gap: 10,
  },
  key: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  keyMuted: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  keyPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  keyTxt: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  confirmFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTxt: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
