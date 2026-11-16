/**
 * Floating AI chat CTA — Figma 1664:10524 (purple gradient pill + magic icon).
 */

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useAppFont } from '@/utils/fontSetup';

const FAB_W = 55;
const FAB_H = 53;
const GRADIENT = ['#6A2BD9', '#4B1FA3'] as const;

function AiMagicIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.5 2.938V4.5M19.5 4.5V6.063M19.5 4.5H18.25M19.5 4.5H20.75M13.427 8.084C12.801 5.843 12.323 4 11 4C9.677 4 9.2 5.843 8.573 8.084C8.319 8.994 8.191 9.45 7.82 9.821C7.45 10.191 6.994 10.319 6.084 10.573C3.843 11.2 2 11.677 2 13C2 14.323 3.843 14.8 6.084 15.427L6.08683 15.4278C6.99495 15.6813 7.45038 15.8084 7.82 16.179C8.191 16.55 8.319 17.005 8.573 17.916C9.2 20.157 9.678 22 11 22C12.322 22 12.8 20.157 13.427 17.916L13.4292 17.9081C13.6827 17.0033 13.8101 16.5489 14.18 16.179C14.55 15.809 15.006 15.681 15.916 15.427C18.157 14.8 20 14.323 20 13C20 11.677 18.157 11.2 15.916 10.573C15.006 10.319 14.55 10.191 14.18 9.821C13.8095 9.4505 13.6823 8.99622 13.428 8.08768L13.427 8.084ZM22 4.5L21.548 4.35C20.85 4.117 20.501 4 20.25 3.75C20 3.5 19.883 3.15 19.65 2.452L19.5 2L19.35 2.452C19.117 3.15 19 3.499 18.75 3.75C18.5 4 18.15 4.117 17.452 4.35L17 4.5L17.452 4.65C18.15 4.883 18.499 5 18.75 5.25C19 5.5 19.117 5.85 19.35 6.548L19.5 7L19.65 6.548C19.883 5.85 20 5.501 20.25 5.25C20.5 5 20.85 4.883 21.548 4.65L22 4.5Z"
        stroke="#FCFCFC"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type AiChatFabProps = {
  onPress: () => void;
  onPressIn?: () => void;
  testID?: string;
};

export const AiChatFab = memo(function AiChatFab({
  onPress,
  onPressIn,
  testID = 'bottom-nav-ai-fab',
}: AiChatFabProps) {
  const fontSemi = useAppFont(600);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="AI"
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      hitSlop={8}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
    >
      {/* Soft lavender disc behind the pill (Figma Ellipse 2). */}
      <View pointerEvents="none" style={styles.glowDisc} />
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0.05, y: 0.9 }}
        end={{ x: 0.95, y: 0.1 }}
        style={styles.pill}
      >
        <AiMagicIcon size={24} />
        <Text style={[styles.label, { fontFamily: fontSemi }]} maxFontSizeMultiplier={1}>
          AI
        </Text>
      </LinearGradient>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hit: {
    width: FAB_W,
    height: FAB_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
  glowDisc: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: FAB_W / 2,
    backgroundColor: '#E9D5FF',
    opacity: 0.55,
    transform: [{ scale: 1.08 }],
  },
  pill: {
    width: FAB_W,
    height: FAB_H,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#6A2BD9',
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  label: {
    color: '#FCFCFC',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
