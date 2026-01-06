/**
 * Match Tabs Component
 * All, Live 🔴, Upcoming, Finished, Favorites ⭐
 * Minimal, clean design
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../reels/constants';

export type MatchTabType = 'all' | 'live' | 'upcoming' | 'finished' | 'favorites' | 'transfers';

interface MatchTabsProps {
  activeTab: MatchTabType;
  onTabChange: (tab: MatchTabType) => void;
}

const tabs: Array<{ id: MatchTabType; label: string; icon?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live', icon: '🔴' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'finished', label: 'Finished' },
  { id: 'favorites', label: 'Favorites', icon: '⭐' },
  { id: 'transfers', label: 'الانتقالات', icon: '🔄' },
];

const MatchTabs: React.FC<MatchTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.icon && <Text>{tab.icon} </Text>}
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(50, 205, 50, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(50, 205, 50, 0.3)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.neonGreen,
    fontWeight: '700',
  },
});

export default MatchTabs;

