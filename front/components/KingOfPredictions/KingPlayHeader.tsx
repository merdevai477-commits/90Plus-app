/**
 * King play top chrome — back island on the left, title centered
 * (same layout pattern as Coach King / Share & Win).
 */

import { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { GlassRim, GlassSheen } from '../navigation/glass';
import { useAppFont } from '../../utils/fontSetup';
import type { KingPlayTheme } from './playTheme';

type Props = {
  title: string;
  onBack: () => void;
  backLabel: string;
  theme: KingPlayTheme;
};

const ISLAND = 42;
const DESIGN = 448;

export const KingPlayHeader = memo(function KingPlayHeader({
  title,
  onBack,
  backLabel,
  theme,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const s = (value: number) => (value * Math.min(width, 520)) / DESIGN;
  const fontBold = useAppFont(700);

  const size = s(ISLAND);
  const radius = size / 2;
  const fill = theme.isDark
    ? (['rgba(28,16,56,0.92)', 'rgba(18,10,40,0.96)'] as const)
    : (['rgba(255,255,255,0.96)', 'rgba(243,237,255,0.98)'] as const);
  const rimTint = theme.isDark ? 'rgba(168,85,247,0.45)' : 'rgba(106,43,217,0.38)';
  const iconColor = theme.isDark ? '#FFFFFF' : theme.primary;

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + s(8),
          paddingBottom: s(10),
          paddingHorizontal: Math.max(insets.left, insets.right, s(16)),
          backgroundColor: theme.screen,
        },
      ]}
    >
      <View style={[styles.row, { minHeight: size }]}>
        <View style={[styles.sideSlot, { width: size, height: size }]}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            style={({ pressed }) => [{ width: size, height: size }, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.backIsland,
                {
                  width: size,
                  height: size,
                  borderRadius: radius,
                  shadowOpacity: theme.isDark ? 0.45 : 0.22,
                },
              ]}
            >
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={theme.isDark ? 28 : 40}
                  tint={theme.isDark ? 'dark' : 'light'}
                  style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
                />
              ) : null}
              <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
                <LinearGradient
                  colors={[...fill]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <GlassSheen radius={radius} intensity={theme.isDark ? 0.9 : 0.55} />
              <GlassRim radius={radius} tint={rimTint} />
              <ChevronLeft size={s(22)} color={iconColor} strokeWidth={2.6} />
            </View>
          </Pressable>
        </View>

        <View style={[styles.titleCenter, { paddingHorizontal: size + s(12) }]} pointerEvents="none">
          <Text
            style={[styles.title, { fontFamily: fontBold, fontSize: s(20), color: theme.headerTitle }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
        </View>

        <View style={[styles.sideSlot, { width: size, height: size }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { width: '100%', zIndex: 40, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideSlot: { zIndex: 2 },
  backIsland: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  titleCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  title: { textAlign: 'center' },
  pressed: { transform: [{ scale: 0.92 }], opacity: 0.9 },
});
