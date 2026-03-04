import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface PlayerAvatarProps {
  name: string;
  position?: string | null;
  size?: number;
  colors?: readonly [string, string, ...string[]];
}

export default function PlayerAvatar({ 
  name, 
  position = 'ST', 
  size = 60,
  colors = ['#1a1a2e', '#16213e'] as const
}: PlayerAvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={colors}
        style={[styles.gradient, { borderRadius: size / 2 }]}
      >
        <Text style={[styles.initials, { fontSize: size * 0.35 }]}>
          {initials}
        </Text>
        {position && (
          <View style={styles.positionBadge}>
            <Text style={styles.positionText}>{position.substring(0, 3).toUpperCase()}</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: 'bold',
  },
  positionBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  positionText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
});
