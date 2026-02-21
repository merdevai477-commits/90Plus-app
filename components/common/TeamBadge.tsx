import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TeamBadgeProps {
  name: string;
  color?: string;
  size?: number;
}

export default function TeamBadge({ 
  name, 
  color = '#1a1a2e',
  size = 50 
}: TeamBadgeProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();

  return (
    <View style={[
      styles.container, 
      { 
        width: size, 
        height: size,
        borderRadius: size / 2,
        backgroundColor: color 
      }
    ]}>
      <Text style={[styles.initials, { fontSize: size * 0.3 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  initials: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
