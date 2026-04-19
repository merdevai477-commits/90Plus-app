import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle, Search, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../reels/constants';

interface Props {
  hasNotifications: boolean;
  unreadCount: number;
  labels: {
    markAllRead: string;
    clearAll: string;
  };
  onOpenSearch: () => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
}

export function NotificationHeader({
  hasNotifications,
  unreadCount,
  labels,
  onOpenSearch,
  onMarkAllAsRead,
  onClearAll,
}: Props) {
  return (
    <View style={styles.headerActions}>
      <TouchableOpacity
        onPress={() => {
          onOpenSearch();
          Haptics.selectionAsync();
        }}
        style={styles.searchIconButton}
      >
        <Search size={20} color={COLORS.neonGreen} />
      </TouchableOpacity>

      {hasNotifications && (
        <>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={onMarkAllAsRead} style={styles.markAllReadButton}>
              <CheckCircle size={16} color={COLORS.neonGreen} />
              <Text style={styles.markAllReadText}>{labels.markAllRead}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClearAll} style={styles.clearButton}>
            <Trash2 size={16} color={COLORS.neonGreen} />
            <Text style={styles.clearButtonText}>{labels.clearAll}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchIconButton: {
    padding: 8,
    marginRight: 8,
  },
  markAllReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(50, 205, 50, 0.2)',
  },
  markAllReadText: {
    color: COLORS.neonGreen,
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
  },
  clearButtonText: {
    color: '#FF4757',
    fontSize: 14,
    fontWeight: '600',
  },
});

