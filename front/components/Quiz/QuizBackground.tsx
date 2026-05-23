/**
 * QuizBackground — Flat very-dark purple (no gradients, shapes, or animation).
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { QUIZ_SCREEN_BG } from './quiz.constants';

export function QuizBackground() {
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.bg]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  bg: {
    backgroundColor: QUIZ_SCREEN_BG,
  },
});
