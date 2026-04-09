import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';

interface Props {
  title: string;
  subtitle: string;
}

export function NotificationEmpty({ title, subtitle }: Props) {
  return (
    <View style={styles.emptyContainer}>
      <Bell size={48} color="rgba(255,255,255,0.3)" />
      <Text style={styles.emptyText}>{title}</Text>
      <Text style={styles.emptySubtext}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

