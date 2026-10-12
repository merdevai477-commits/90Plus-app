/**
 * Soap-film edge for rounded glass surfaces, matching the chat welcome bubble:
 * colour bleeds inward from the edge, a crisp rotating rim, and a bright top
 * highlight, all over whatever dark fill the surface has.
 */

import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient,
  RoundedRect,
  SweepGradient,
  rect,
  rrect,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/** Sampled around the rim of `assets/images/chat/iridescent-bubble.png`. */
const FILM_COLORS = [
  '#A3DDF9',
  '#5B98DB',
  '#7A388B',
  '#216ACE',
  '#A74B8E',
  '#4E38AA',
  '#DD7EBB',
  '#7BABC3',
  '#307BB4',
  '#6C2C84',
  '#E07990',
  '#36A2FB',
  '#95CEF5',
  '#A3DDF9',
];
/** Room around the surface for the glow to spill into. */
const GLOW_PAD = 10;
/** Radians per second. */
const SPIN_SPEED = 0.6;
export type IridescentRimProps = {
  radius: number;
  /** 0…1 — brightens the rim (e.g. while the input is focused). */
  focus?: SharedValue<number>;
  /** How far the film colour bleeds inward from the edge. */
  filmDepth?: number;
};

export function IridescentRim({ radius, focus, filmDepth = 16 }: IridescentRimProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const clock = useClock();

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  const transform = useDerivedValue(() => [{ rotate: (clock.value / 1000) * SPIN_SPEED }]);
  const opacity = useDerivedValue(() => 0.75 + (focus ? focus.value : 0) * 0.25);

  if (Platform.OS === 'web') return null;

  const { w, h } = size;
  const center = vec(GLOW_PAD + w / 2, GLOW_PAD + h / 2);
  const shape = rrect(rect(GLOW_PAD, GLOW_PAD, w, h), radius, radius);
  const film = (
    <SweepGradient c={center} colors={FILM_COLORS} origin={center} transform={transform} />
  );

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
              strokeWidth={3}
              opacity={0.35}
            >
              {film}
              <BlurMask blur={6} style="normal" />
            </RoundedRect>

            <Group clip={shape}>
              <RoundedRect
                x={GLOW_PAD}
                y={GLOW_PAD}
                width={w}
                height={h}
                r={radius}
                style="stroke"
                strokeWidth={filmDepth}
                opacity={0.6}
              >
                {film}
                <BlurMask blur={filmDepth / 2} style="normal" />
              </RoundedRect>
            </Group>

            <RoundedRect
              x={GLOW_PAD + 0.6}
              y={GLOW_PAD + 0.6}
              width={w - 1.2}
              height={h - 1.2}
              r={radius - 0.6}
              style="stroke"
              strokeWidth={1.2}
            >
              {film}
            </RoundedRect>

            <RoundedRect
              x={GLOW_PAD + 0.6}
              y={GLOW_PAD + 0.6}
              width={w - 1.2}
              height={h - 1.2}
              r={radius - 0.6}
              style="stroke"
              strokeWidth={1}
            >
              <LinearGradient
                start={vec(0, GLOW_PAD)}
                end={vec(0, GLOW_PAD + h * 0.55)}
                colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
              />
            </RoundedRect>
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}
