import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

const WATERMARK = require('../../assets/images/brand/90plus-watermark.png');
const ASPECT_RATIO = 512 / 96;

type BrandWatermarkProps = {
  width: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

/** "90 PLUS" wordmark — same asset the live pitch tracker shows mid-pitch. */
export function BrandWatermark({ width, opacity = 0.6, style }: BrandWatermarkProps) {
  return (
    <Image
      source={WATERMARK}
      style={[styles.mark, { width, height: width / ASPECT_RATIO, opacity }, style as any]}
      contentFit="contain"
      pointerEvents="none"
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    alignSelf: 'center',
  },
});
