/**
 * Figma VAR lockup icon — purple monitor with "VAR" inside + stand.
 * node 2573:15773 in 90plus (Set-piece statistics).
 */
import { View, Text, StyleSheet } from 'react-native';

const DESIGN_W = 21.84;
const DESIGN_SCREEN_H = 13.346;
const DESIGN_STAND_W = 10;
const DESIGN_STAND_H = 2;
const DESIGN_H = DESIGN_SCREEN_H + DESIGN_STAND_H;
const INK = '#4B1FA3';
const FILL = '#F9F6FE';

type Props = {
  /** Overall width in px (Figma ≈ 22). */
  width?: number;
};

export function VarMonitorIcon({ width = 22 }: Props) {
  const scale = width / DESIGN_W;
  const screenH = DESIGN_SCREEN_H * scale;
  const border = Math.max(1.5, 2 * scale);
  const standW = DESIGN_STAND_W * scale;
  const standH = Math.max(1.5, DESIGN_STAND_H * scale);
  const fontSize = Math.max(6, 7 * scale);
  const radius = Math.max(1, 1 * scale);

  return (
    <View
      style={[styles.root, { width, height: DESIGN_H * scale }]}
      accessibilityLabel="VAR"
      accessible
    >
      <View
        style={[
          styles.screen,
          {
            width,
            height: screenH,
            borderWidth: border,
            borderRadius: radius,
            borderColor: INK,
            backgroundColor: FILL,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            {
              color: INK,
              fontSize,
              lineHeight: fontSize + 1,
              includeFontPadding: false,
            },
          ]}
          allowFontScaling={false}
        >
          VAR
        </Text>
      </View>
      <View
        style={[
          styles.stand,
          {
            width: standW,
            height: standH,
            backgroundColor: INK,
            borderColor: INK,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'solid',
  },
  label: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  stand: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
