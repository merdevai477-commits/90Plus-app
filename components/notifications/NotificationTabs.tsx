import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../reels/constants';

type TabKey = 'all' | 'unread' | 'mentions';

interface Props {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  unreadCount: number;
  labels: {
    all: string;
    unread: string;
    mentions: string;
  };
}

export function NotificationTabs({ activeTab, onTabChange, unreadCount, labels }: Props) {
  return (
    <View style={styles.tabsContainer}>
      <BlurView intensity={15} tint="dark" style={styles.tabsBlur}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => {
            onTabChange('all');
            Haptics.selectionAsync();
          }}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={activeTab === 'all' ? [COLORS.neonGreen, '#22c55e'] : ['transparent', 'transparent']}
            style={styles.tabGradient}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>{labels.all}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'unread' && styles.tabActive]}
          onPress={() => {
            onTabChange('unread');
            Haptics.selectionAsync();
          }}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={activeTab === 'unread' ? [COLORS.neonGreen, '#22c55e'] : ['transparent', 'transparent']}
            style={styles.tabGradient}
          >
            <Text style={[styles.tabText, activeTab === 'unread' && styles.tabTextActive]}>{labels.unread}</Text>
            {unreadCount > 0 && activeTab !== 'unread' && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'mentions' && styles.tabActive]}
          onPress={() => {
            onTabChange('mentions');
            Haptics.selectionAsync();
          }}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={activeTab === 'mentions' ? [COLORS.neonGreen, '#22c55e'] : ['transparent', 'transparent']}
            style={styles.tabGradient}
          >
            <Text style={[styles.tabText, activeTab === 'mentions' && styles.tabTextActive]}>{labels.mentions}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  tabsBlur: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabGradient: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
  },
  tabActive: {
    shadowColor: COLORS.neonGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  tabTextActive: {
    color: COLORS.deepBlack,
    fontWeight: 'bold',
  },
  tabBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
});

