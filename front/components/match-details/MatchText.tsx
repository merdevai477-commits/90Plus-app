import React, { forwardRef } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

/**
 * Match details layouts are fixed-size (pitch, score header, cards); unbounded
 * system font scaling pushes text out of them. Caller-supplied caps still win.
 */
export const MATCH_DETAILS_MAX_FONT_SCALE = 1.1;

export const Text = forwardRef<RNText, TextProps>(function MatchText(props, ref) {
  return <RNText ref={ref} maxFontSizeMultiplier={MATCH_DETAILS_MAX_FONT_SCALE} {...props} />;
});
