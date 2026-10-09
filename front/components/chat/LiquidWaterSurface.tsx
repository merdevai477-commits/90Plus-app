/**
 * Water-glass surface: frosts what is behind it, then draws slowly drifting
 * caustic light over the top so it reads like looking through moving water.
 * Touches send a ripple ring out from the finger. iOS 26+ dev builds use the
 * native Liquid Glass material instead.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { GlassRim, GlassSheen } from '../navigation/glass';

const WATER_SHADER = Skia.RuntimeEffect.Make(`
uniform float2 res;
uniform float time;
uniform float3 glow;
uniform float strength;
uniform float scale;
uniform float2 rippleAt;
uniform float ripple;

half4 main(float2 xy) {
  float2 uv = xy / (res.y * scale);
  float t = time * 0.32 + 23.0;
  float2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  float2 i = p;
  float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tn = t * (1.0 - (3.5 / float(n + 1)));
    i = p + float2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
    c += 1.0 / length(float2(p.x / (sin(i.x + tn) / 0.005), p.y / (cos(i.y + tn) / 0.005)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  float caustic = clamp(pow(abs(c), 8.0), 0.0, 1.0);

  float surface = 1.0 - 0.55 * smoothstep(0.0, res.y, xy.y);
  float live = step(0.001, ripple) * step(ripple, 0.999);
  float radius = ripple * max(res.x, res.y) * 1.1;
  float ring = (1.0 - smoothstep(0.0, 16.0, abs(distance(xy, rippleAt) - radius))) * (1.0 - ripple) * live;

  float a = clamp(caustic * strength * surface + ring * 0.4, 0.0, 1.0);
  return half4(half3(glow) * a, a);
}
`);

export type LiquidWaterSurfaceProps = {
  radius: number;
  /** Colour laid over the frosted backdrop. */
  tint: string;
  /** RGB 0…1 of the caustic light. */
  glow?: [number, number, number];
  strength?: number;
  /** Bigger = larger, calmer caustic cells. */
  scale?: number;
  /** Android only: the view to frost (see expo-blur `BlurTargetView`). */
  blurTarget?: React.RefObject<View | null>;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function LiquidWaterSurface({
  radius,
  tint,
  glow = [0.86, 0.8, 1],
  strength = 0.32,
  scale = 2.2,
  blurTarget,
  style,
  children,
}: LiquidWaterSurfaceProps) {
  const rootRef = useRef<View>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const clock = useClock();
  const rippleX = useSharedValue(0);
  const rippleY = useSharedValue(0);
  const ripple = useSharedValue(0);

  const uniforms = useDerivedValue(
    () => ({
      res: [size.w, size.h],
      time: clock.value / 1000,
      glow,
      strength,
      scale,
      rippleAt: [rippleX.value, rippleY.value],
      ripple: ripple.value,
    }),
    [size.w, size.h, glow, strength, scale],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  const onTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      const { pageX, pageY } = e.nativeEvent;
      rootRef.current?.measureInWindow((x, y) => {
        rippleX.value = pageX - x;
        rippleY.value = pageY - y;
        ripple.value = withSequence(
          withTiming(0.002, { duration: 0 }),
          withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        );
      });
    },
    [ripple, rippleX, rippleY],
  );

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        {...({
          style: [{ borderRadius: radius, overflow: 'hidden' }, style],
          tint,
          effect: 'regular',
          interactive: true,
        } as object)}
      >
        {children}
      </LiquidGlassView>
    );
  }

  return (
    <View
      ref={rootRef}
      onLayout={onLayout}
      onTouchStart={onTouchStart}
      style={[{ borderRadius: radius }, styles.shadow, style]}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 28 : 36}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
        {WATER_SHADER && size.w > 0 ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <Fill>
              <Shader source={WATER_SHADER} uniforms={uniforms} />
            </Fill>
          </Canvas>
        ) : null}
      </View>
      <GlassSheen radius={radius} intensity={0.9} />
      <GlassRim radius={radius} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#7C4DFF',
        shadowOpacity: 0.4,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      default: {},
    }),
  },
});
