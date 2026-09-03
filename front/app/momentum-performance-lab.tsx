/**
 * MomentumPerformanceLab — __DEV__ only.
 * Route: /momentum-performance-lab
 *
 * Intentionally does NOT import @shopify/react-native-skia at module scope.
 * Loading Skia JS without a rebuilt native binary crashes the whole app
 * (RNSkiaModule missing). Gate + deferred require keep Matches usable.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Stack } from 'expo-router';
import { isSkiaNativeAvailable } from '../utils/skiaNativeAvailable';
import { TEXT_MUTED, TEXT_PRIMARY } from '../constants/tokens';

export default function MomentumPerformanceLabScreen() {
  const skiaOk = useMemo(() => isSkiaNativeAvailable(), []);

  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Not Available' }} />
        <Text style={styles.note}>Momentum Performance Lab is development-only.</Text>
      </SafeAreaView>
    );
  }

  if (!skiaOk) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Momentum Lab',
            headerStyle: { backgroundColor: '#111' },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.pad}>
          <Text style={styles.title}>Skia native module missing</Text>
          <Text style={styles.note}>
            `@shopify/react-native-skia` is installed in JS, but `RNSkiaModule` is not linked in
            this binary. Production Match Momentum (SVG) is unaffected.
          </Text>
          <Text style={styles.note}>
            Rebuild the Expo dev client to run the Skia prototype:
          </Text>
          <Text style={styles.code}>npx expo run:android</Text>
          <Text style={styles.code}>npx expo run:ios</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Deferred: only evaluates Skia imports when native module exists.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const LabBody = require('../components/match-details/MomentumPerformanceLabBody')
    .default as React.ComponentType;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Momentum Lab',
          headerStyle: { backgroundColor: '#111' },
          headerTintColor: '#fff',
        }}
      />
      <LabBody />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  pad: {
    padding: 16,
    gap: 10,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
  note: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  code: {
    color: TEXT_PRIMARY,
    fontFamily: 'monospace',
    fontSize: 13,
    marginTop: 4,
  },
});
