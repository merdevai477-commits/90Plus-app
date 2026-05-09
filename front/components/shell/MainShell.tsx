import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import BottomNav from '../../app/(tabs)/BottomNav';
import {
  BG_BASE,
  TEXT_PRIMARY,
  TEXT_MUTED,
  SCREEN_PADDING_H,
  SECTION_GAP,
  GRADIENT_BG_COLORS,
  GRADIENT_BG_LOCATIONS,
} from '../../constants/tokens';

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  onBackPress?: () => void;
  headerRight?: React.ReactNode;
};

export function MainShell({ title, subtitle, children, onBackPress, headerRight }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16) + 56 + 32;
  const topPad = insets.top + 12;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[...GRADIENT_BG_COLORS]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[...GRADIENT_BG_LOCATIONS]}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingHorizontal: SCREEN_PADDING_H,
          paddingBottom: bottomPad + SECTION_GAP,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headOuter}>
          <View style={styles.head}>
            {onBackPress ? (
              <TouchableOpacity
                onPress={onBackPress}
                hitSlop={12}
                activeOpacity={0.75}
                style={styles.backRow}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <ChevronLeft color={TEXT_MUTED} size={22} strokeWidth={2.2} />
                <Text style={styles.backTxt}>Back</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {headerRight && <View style={styles.headRight}>{headerRight}</View>}
        </View>
        {children}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_BASE },
  scroll: { flex: 1 },
  headOuter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SECTION_GAP - 4,
  },
  head: {
    alignItems: 'flex-start',
    flex: 1,
  },
  headRight: {
    marginLeft: 16,
    justifyContent: 'center',
    paddingTop: 4,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 12,
    marginLeft: -4,
    paddingVertical: 4,
    paddingRight: 12,
  },
  backTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.45,
    textAlign: 'left',
    lineHeight: 28,
    maxWidth: '100%',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
    textAlign: 'left',
    maxWidth: '100%',
    opacity: 0.9,
  },
});
