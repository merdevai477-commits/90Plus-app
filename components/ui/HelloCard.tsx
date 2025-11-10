import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type HelloCardProps = {
  title?: string;
  subtitle?: string;
};

export default function HelloCard({ title = 'مرحباً 👋', subtitle = 'هذا مكون مثال (TypeScript)' }: HelloCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    width: '86%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#cbd5e1',
  },
});


