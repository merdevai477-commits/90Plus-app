/**
 * Success overlay after saving round predictions (Figma checkmark screen).
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PG, PG_GRADIENTS, PG_GLOW_PURPLE, PG_RADII, usePGFonts } from './theme';

export function PredictionSuccessOverlay({
  visible,
  title,
  body,
  doneLabel,
  onDone,
}: {
  visible: boolean;
  title: string;
  body: string;
  doneLabel: string;
  onDone: () => void;
}) {
  const { extra, medium, bold } = usePGFonts();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.root}>
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(168,85,247,0.22)', 'transparent']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[...PG_GRADIENTS.purpleBright]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.check}
          >
            <Check size={36} color="#fff" strokeWidth={3} />
          </LinearGradient>
          <Text style={[styles.title, { fontFamily: extra }]}>{title}</Text>
          <Text style={[styles.body, { fontFamily: medium }]}>{body}</Text>
          <Pressable onPress={onDone} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
            <LinearGradient
              colors={[...PG_GRADIENTS.purple]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Text style={[styles.btnTxt, { fontFamily: bold }]}>{doneLabel}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: PG.card,
    borderRadius: PG_RADII.xl,
    borderWidth: 1,
    borderColor: PG.border,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  check: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...PG_GLOW_PURPLE,
  },
  title: {
    color: PG.text,
    fontSize: 22,
    textAlign: 'center',
  },
  body: {
    color: PG.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  btn: {
    minWidth: 180,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: PG_RADII.lg,
    alignItems: 'center',
  },
  btnTxt: {
    color: '#fff',
    fontSize: 16,
  },
});
