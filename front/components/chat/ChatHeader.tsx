import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurIntensity } from '../../constants/theme';
import { chatColors } from './chatTheme';
import { chatScreenStyles as styles } from './chatScreen.styles';

export type ChatHeaderProps = {
  onBack: () => void;
  onMenu: () => void;
  backLabel: string;
  menuLabel: string;
};

export function ChatHeader({ onBack, onMenu, backLabel, menuLabel }: ChatHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {isLiquidGlassSupported ? (
        <LiquidGlassView
          {...({
            style: StyleSheet.absoluteFill,
            effect: 'clear',
            interactive: true,
            tint: chatColors.headerBackdrop,
          } as object)}
        />
      ) : (
        <>
          <BlurView intensity={BlurIntensity.header} tint="dark" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.headerBackdrop]} />
        </>
      )}
      <LinearGradient
        colors={['rgba(168,85,247,0.06)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { height: 1 }]}
        pointerEvents="none"
      />
      <View style={styles.headerRow}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.iconButton,
            styles.iconButtonGhost,
            pressed && styles.iconButtonPressed,
          ]}
          hitSlop={8}
          accessibilityLabel={backLabel}
          accessibilityRole="button"
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.logoPillLarge}>
            <Text style={styles.logo90Large}>90</Text>
            <View style={styles.plusChipLarge}>
              <Text style={styles.logoPlusLarge}>PLUS</Text>
            </View>
            <Text style={styles.captainText}>Captain AI</Text>
          </View>
        </View>

        <Pressable
          onPress={onMenu}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          hitSlop={8}
          accessibilityLabel={menuLabel}
          accessibilityRole="button"
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}
