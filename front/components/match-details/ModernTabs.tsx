import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface Tab {
  key: string;
  label: string;
  icon?: any; // Keeping icon prop optional but not using it for this design
}

interface ModernTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const ModernTabs: React.FC<ModernTabsProps> = ({ tabs, activeTab, onTabChange }) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to active tab logic could be added here if needed

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
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
    marginVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 30, // Pill shape
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // Dark subtle background for inactive
    borderWidth: 0,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#8b5cf6', // Indigo-purple active background
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700',
  },
});
