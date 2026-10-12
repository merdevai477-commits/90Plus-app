/**
 * Neon-purple liquid sloshing inside the voice orb. It always moves a little so
 * the orb feels alive even when the mic reads silence (or the emulator has no
 * mic), and swells and churns with the live voice level. While transcribing
 * it settles to a slow, calm slosh.
 */

import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient,
  Path,
  Skia,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/** Fraction of the orb the liquid fills edge to edge, leaving the glass rim visible. */
const INNER = 0.84;
const STEP = 3;

export type VoiceLiquidProps = {
  size: number;
  /** 0…1, smoothed mic level. */
  level: SharedValue<number>;
  /** 0…1, eases to 1 while the recording is being transcribed. */
  thinking: SharedValue<number>;
};

export function VoiceLiquid({ size, level, thinking }: VoiceLiquidProps) {
  const clock = useClock();
  const r = (size * INNER) / 2;
  const c = size / 2;
  const left = c - r;
  const k = (Math.PI * 2 * 1.15) / (2 * r);

  const energy = useDerivedValue(() => {
    const t = clock.value / 1000;
    const idle = 0.22 + 0.1 * Math.sin(t * 2.1) + 0.07 * Math.sin(t * 5.3 + 1);
    const calm = 1 - thinking.value * 0.7;
    return Math.min(1, (level.value * 0.95 + idle) * calm);
  });

  const surface = (x: number, t: number, e: number, phase: number, speed: number) => {
    'worklet';
    const base = c + r * (0.18 - e * 0.28);
    const amp = r * (0.05 + e * 0.2);
    return (
      base +
      amp * Math.sin(k * (x - left) + t * speed + phase) +
      amp * 0.38 * Math.sin(k * 2.3 * (x - left) - t * speed * 1.6 + phase * 2)
    );
  };

  const backWave = useDerivedValue(() => {
    const t = clock.value / 1000;
    const p = Skia.Path.Make();
    p.moveTo(left, size);
    for (let x = left; x <= left + 2 * r + STEP; x += STEP) {
      p.lineTo(x, surface(x, t, energy.value, 1.4, -2.6) - r * 0.07);
    }
    p.lineTo(left + 2 * r + STEP, size);
    p.close();
    return p;
  });

  const frontWave = useDerivedValue(() => {
    const t = clock.value / 1000;
    const p = Skia.Path.Make();
    p.moveTo(left, size);
    for (let x = left; x <= left + 2 * r + STEP; x += STEP) {
      p.lineTo(x, surface(x, t, energy.value, 0, 3.3));
    }
    p.lineTo(left + 2 * r + STEP, size);
    p.close();
    return p;
  });

  const crest = useDerivedValue(() => {
    const t = clock.value / 1000;
    const p = Skia.Path.Make();
    p.moveTo(left, surface(left, t, energy.value, 0, 3.3));
    for (let x = left + STEP; x <= left + 2 * r + STEP; x += STEP) {
      p.lineTo(x, surface(x, t, energy.value, 0, 3.3));
    }
    return p;
  });

  const clip = useMemo(() => {
    if (Platform.OS === 'web') return null;
    const p = Skia.Path.Make();
    p.addCircle(c, c, r);
    return p;
  }, [c, r]);

  if (!clip) return null;

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group clip={clip}>
        <Path path={backWave} color="rgba(109,40,217,0.55)" />
        <Path path={frontWave}>
          <LinearGradient
            start={vec(0, c - r * 0.3)}
            end={vec(0, c + r)}
            colors={['#C026FF', '#8B2CF5', '#3B0F7A']}
          />
        </Path>
        <Path path={crest} style="stroke" strokeWidth={2.2} color="#F0ABFC" strokeCap="round">
          <BlurMask blur={3} style="solid" />
        </Path>
      </Group>
    </Canvas>
  );
}
