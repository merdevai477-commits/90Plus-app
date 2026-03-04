import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Play } from 'lucide-react-native';

/**
 * Fallback component when expo-av is not available (Expo Go on SDK 52)
 * Shows a placeholder with message to use development build
 */
export function VideoPlayerFallback({ videoUrl, style }: { videoUrl: string; style?: any }) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <Play size={48} color="#FFD700" />
        <Text style={styles.title}>Video Player Not Available</Text>
        <Text style={styles.message}>
          expo-av requires a development build.{'\n'}
          Use: npx expo run:android
        </Text>
        <Text style={styles.url} numberOfLines={1}>
          {videoUrl}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  url: {
    color: '#888',
    fontSize: 12,
    maxWidth: 300,
  },
});
