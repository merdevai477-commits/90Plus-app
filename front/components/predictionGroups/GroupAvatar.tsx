/**
 * Group avatar — liquid-glass shield tile (display only; edit in GroupEditSheet).
 */

import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield } from 'lucide-react-native';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';
import { PG } from './theme';

const glow = Platform.select({
  ios: {
    shadowColor: PG.primaryLight,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  android: { elevation: 10 },
  default: {},
});

export function GroupAvatar({ imageUri, size = 72 }: { imageUri: string | null; size?: number }) {
  const outerRadius = size * 0.28;
  const innerRadius = size * 0.24;

  return (
    <View style={[styles.wrap, { width: size + 10, height: size + 10 }, glow]}>
      <LinearGradient
        colors={['rgba(167,139,250,0.55)', 'rgba(124,58,237,0.2)', 'rgba(91,33,182,0.4)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.ring, { width: size + 10, height: size + 10, borderRadius: outerRadius + 2 }]}
      >
        <View style={[styles.glassShell, { width: size, height: size, borderRadius: innerRadius }]}>
          <View style={[styles.glassClip, { borderRadius: innerRadius }]}>
            {isLiquidGlassSupported ? (
              <LiquidGlassView
                effect="clear"
                interactive={false}
                tintColor="rgba(139,92,246,0.14)"
                colorScheme="dark"
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <>
                <BlurView
                  intensity={Platform.OS === 'android' ? 40 : 28}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={[
                    'rgba(167,139,250,0.22)',
                    'rgba(91,33,182,0.08)',
                    'rgba(13,11,20,0.85)',
                  ]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              </>
            )}

            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.specular, { borderTopLeftRadius: innerRadius, borderTopRightRadius: innerRadius }]}
              pointerEvents="none"
            />

            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={styles.placeholder}>
                <Shield size={Math.round(size * 0.47)} color={PG.primaryLight} strokeWidth={1.75} />
              </View>
            )}

            <View style={[styles.innerRim, { borderRadius: innerRadius }]} pointerEvents="none" />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  ring: { padding: 3, alignItems: 'center', justifyContent: 'center' },
  glassShell: {
    overflow: 'visible',
  },
  glassClip: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(13,11,20,0.55)',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    zIndex: 2,
  },
  photo: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  innerRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 3,
  },
});
