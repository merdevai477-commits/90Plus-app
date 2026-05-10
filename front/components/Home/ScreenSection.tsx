import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { SECTION_GAP } from '../../constants/tokens';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Extra space after this block (default SECTION_GAP). */
  gapAfter?: number;
};

export function ScreenSection({ children, style, gapAfter = SECTION_GAP }: Props) {
  return <View style={[styles.wrap, { marginBottom: gapAfter }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {},
});
