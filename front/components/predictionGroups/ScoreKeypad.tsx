/**
 * Numeric keypad for entering an exact match score (Figma Prediction feature).
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PG, PG_GRADIENTS, PG_RADII, usePGFonts } from './theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
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
  const { extra, bold, medium } = usePGFonts();
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
    <View
      style={[
        styles.sheet,
        embedded && styles.embeddedSheet,
        { paddingBottom: Math.max(insets.bottom, 16) + 8 },
      ]}
    >
      <Text style={[styles.title, { fontFamily: extra }]}>{title}</Text>
      <Text style={[styles.value, { fontFamily: extra }]}>{draft}</Text>

      <View style={styles.grid}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            onPress={() => tapDigit(k)}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          >
            <Text style={[styles.keyTxt, { fontFamily: bold }]}>{k}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={backspace}
          style={({ pressed }) => [styles.key, styles.keyMuted, pressed && styles.keyPressed]}
        >
          <Delete size={22} color={PG.text} />
        </Pressable>
        <Pressable
          onPress={() => tapDigit('0')}
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
        >
          <Text style={[styles.keyTxt, { fontFamily: bold }]}>0</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          style={({ pressed }) => [styles.key, pressed && { opacity: 0.9 }]}
        >
          <LinearGradient
            colors={[...PG_GRADIENTS.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.confirmFill}
          >
            <Text style={[styles.confirmTxt, { fontFamily: medium }]}>{confirmLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  if (embedded) {
    return (
      <View style={styles.embeddedRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        {sheet}
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {sheet}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: PG.card,
    borderTopLeftRadius: PG_RADII.xl,
    borderTopRightRadius: PG_RADII.xl,
    borderWidth: 1,
    borderColor: PG.border,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 14,
  },
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  embeddedSheet: {
    borderRadius: PG_RADII.xl,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  title: {
    color: PG.text,
    fontSize: 16,
    textAlign: 'center',
  },
  value: {
    color: PG.primaryLight,
    fontSize: 48,
    textAlign: 'center',
    lineHeight: 56,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  key: {
    width: '31%',
    height: 52,
    borderRadius: PG_RADII.md,
    backgroundColor: PG.cardElevated,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyMuted: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  keyPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  keyTxt: {
    color: PG.text,
    fontSize: 22,
  },
  confirmFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PG_RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTxt: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
  },
});
