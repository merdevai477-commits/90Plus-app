/**
 * Premium purple trophy badge for section headers.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Trophy } from 'lucide-react-native';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { PG } from './theme';

export function PurpleTrophyIcon({ size = 36 }: { size?: number }) {
  const icon = Math.round(size * 0.5);
  const glow = Platform.select({
    ios: {
      shadowColor: PG.primaryLight,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.6,
      shadowRadius: 8,
    },
    android: { elevation: 6 },
    default: {},
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }, glow]}>
      <LinearGradient
        colors={[PG.primaryLight, PG.primary, PG.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.grad, { borderRadius: size / 2 }]}
      >
        <View style={styles.inner}>
          <Trophy size={icon} color="#FFFFFF" fill="rgba(255,255,255,0.25)" strokeWidth={1.8} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  grad: {
    flex: 1,
    padding: 1.5,
  },
  inner: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
