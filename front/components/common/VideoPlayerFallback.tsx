import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Play } from 'lucide-react-native';

/**
 * Fallback component when expo-av is not available (Expo Go on SDK 52+)
 * Shows a clear message to use a development build.
 */
export function VideoPlayerFallback({ videoUrl, style }: { videoUrl: string; style?: any }) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Play size={36} color="#FFD700" fill="#FFD700" />
        </View>
        <Text style={styles.title}>مشغل الفيديو غير متاح</Text>
        <Text style={styles.message}>
          لتشغيل الفيديوهات، يجب استخدام{'\n'}
          <Text style={styles.highlight}>Development Build</Text>
          {'\n'}وليس Expo Go
        </Text>
        <View style={styles.cmdBox}>
          <Text style={styles.cmd}>npx expo run:android</Text>
          <Text style={styles.cmdSep}>أو</Text>
          <Text style={styles.cmd}>npx expo run:ios</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,215,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  title: {
    color: '#FFD700',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  highlight: {
    color: '#32CD32',
    fontWeight: '700',
  },
  cmdBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    gap: 4,
  },
  cmd: {
    color: '#32CD32',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  cmdSep: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginVertical: 2,
  },
});
