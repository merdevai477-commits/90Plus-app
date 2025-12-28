import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Tab {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ModernTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const ModernTabs: React.FC<ModernTabsProps> = ({ tabs, activeTab, onTabChange }) => {
  const scrollViewRef = useRef<ScrollView>(null);

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
              activeOpacity={0.7}
            >
              {isActive && (
                <LinearGradient
                  colors={['#22c55e', '#16a34a']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <Ionicons
                name={tab.icon}
                size={18}
                color={isActive ? '#fff' : '#888'}
              />
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
    marginVertical: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
    overflow: 'hidden', // For LinearGradient
  },
  activeTab: {
    borderColor: 'transparent',
    backgroundColor: '#22c55e', // Fallback
  },
  tabText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700',
  },
});
