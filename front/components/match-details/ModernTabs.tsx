import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, I18nManager } from 'react-native';

interface Tab {
  key: string;
  label: string;
  icon?: any;
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
              style={styles.tab}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[styles.tabText, isActive && styles.activeTabText]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {isActive ? <View style={styles.underline} /> : <View style={styles.underlineSpacer} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0c051a',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#53198a',
    paddingTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 22,
    alignItems: 'flex-end',
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
  },
  tab: {
    paddingTop: 6,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '400',
    paddingBottom: 10,
  },
  activeTabText: {
    color: '#810af2',
    fontWeight: '700',
    textShadowColor: '#5f2795',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  underline: {
    width: '88%',
    height: 2,
    borderRadius: 2,
    backgroundColor: '#810af2',
    shadowColor: '#810af2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 3,
  },
  underlineSpacer: {
    height: 2,
  },
});
