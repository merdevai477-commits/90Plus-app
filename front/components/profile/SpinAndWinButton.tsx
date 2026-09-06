import React, { memo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface SpinAndWinButtonProps {
  label: string;
  onPress: () => void;
}

const FONT_SEMIBOLD = 'Inter_600SemiBold';

/** Figma 1076:2271 + SwiftUI export: purple CTA between stats and connect. */
const FILL_TOP = '#8B5CF6';
const FILL_BOTTOM = '#513690';
const STROKE = '#4703E3';
const GLOW = '#6B2EF7';

const SpinAndWinButton = memo(function SpinAndWinButton({
  label,
  onPress,
}: SpinAndWinButtonProps) {
  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <LinearGradient
        colors={[FILL_TOP, FILL_BOTTOM]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.button}
      >
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
});

export default SpinAndWinButton;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 22,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: GLOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.76,
    shadowRadius: 11.4,
    ...Platform.select({
      android: { elevation: 10 },
      default: {},
    }),
  },
  button: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STROKE,
    overflow: 'hidden',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: FONT_SEMIBOLD,
    fontWeight: '600',
    textAlign: 'center',
  },
});
