/**
 * Soap-film rim for rounded glass surfaces: a slowly rotating sweep of the
 * chat bubble's iridescent colours, drawn as a crisp edge plus a soft glow.
 */

import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  BlurMask,
  Canvas,
  Group,
  RoundedRect,
  SweepGradient,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

const FILM_COLORS = [
  '#3B6BFF',
  '#A855F7',
  '#FF2D7A',
  '#FDE7F3',
  '#25FF8A',
  '#38BDF8',
  '#6F24FB',
  '#3B6BFF',
];
/** Room around the surface for the glow to spill into. */
const GLOW_PAD = 10;
/** Radians per second. */
const SPIN_SPEED = 0.8;

export type IridescentRimProps = {
  radius: number;
  /** 0…1 — brightens the rim (e.g. while the input is focused). */
  focus?: SharedValue<number>;
};

export function IridescentRim({ radius, focus }: IridescentRimProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const clock = useClock();

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  const transform = useDerivedValue(() => [{ rotate: (clock.value / 1000) * SPIN_SPEED }]);
  const opacity = useDerivedValue(() => 0.7 + (focus ? focus.value : 0) * 0.3);

  if (Platform.OS === 'web') return null;

  const { w, h } = size;
  const center = vec(GLOW_PAD + w / 2, GLOW_PAD + h / 2);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {w > 0 ? (
        <Canvas
          style={{
            position: 'absolute',
            left: -GLOW_PAD,
            top: -GLOW_PAD,
            width: w + GLOW_PAD * 2,
            height: h + GLOW_PAD * 2,
          }}
        >
          <Group opacity={opacity}>
            <RoundedRect
              x={GLOW_PAD}
              y={GLOW_PAD}
              width={w}
              height={h}
              r={radius}
              style="stroke"
              strokeWidth={4}
              opacity={0.5}
            >
              <SweepGradient c={center} colors={FILM_COLORS} origin={center} transform={transform} />
              <BlurMask blur={7} style="normal" />
            </RoundedRect>
            <RoundedRect
              x={GLOW_PAD + 0.75}
              y={GLOW_PAD + 0.75}
              width={w - 1.5}
              height={h - 1.5}
              r={radius - 0.75}
              style="stroke"
              strokeWidth={1.5}
            >
              <SweepGradient c={center} colors={FILM_COLORS} origin={center} transform={transform} />
            </RoundedRect>
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}
