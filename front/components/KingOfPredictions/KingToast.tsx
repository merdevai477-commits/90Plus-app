import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppFont } from '../../utils/fontSetup';

export type KingToastState = {
  variant: 'success' | 'error';
  title: string;
  pick?: string;
  caption?: string;
};

const AUTO_HIDE_MS = 2200;

export function KingToast({ toast, onHide }: { toast: KingToastState | null; onHide: () => void }) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const progress = useRef(new Animated.Value(0)).current;
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;
  const runRef = useRef(0);

  useEffect(() => {
    if (!toast) return undefined;
    const run = runRef.current + 1;
    runRef.current = run;
    progress.setValue(0);
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }).start();
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        if (runRef.current === run) onHideRef.current();
      });
    }, AUTO_HIDE_MS);
    return () => {
      runRef.current += 1;
      clearTimeout(timer);
    };
  }, [progress, toast]);

  const success = toast?.variant !== 'error';
  const iconColors = success ? (['#A78BFA', '#6D28D9'] as const) : (['#F87171', '#B91C1C'] as const);
  const ring = success ? 'rgba(167,139,250,0.35)' : 'rgba(248,113,113,0.35)';

  if (!toast) return null;

  // Rendered as an in-tree overlay rather than a Modal: Android drops a Modal
  // opened while another one (the prediction sheet) is still dismissing.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onHide}>
        <Animated.View
          style={[
            styles.cardWrap,
            {
              opacity: progress,
              transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
            },
          ]}
        >
          <LinearGradient colors={['#1B1033', '#0B0614']} style={styles.card}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0)']}
              style={styles.sheen}
            />
            <View style={[styles.ring, { borderColor: ring }]}>
              <LinearGradient colors={iconColors} style={styles.icon}>
                <Ionicons name={success ? 'checkmark' : 'close'} size={38} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={[styles.title, { fontFamily: fontBold }]}>{toast?.title}</Text>
            {toast?.pick ? (
              <View style={styles.pickChip}>
                <Text style={[styles.pickText, { fontFamily: fontSemi }]} numberOfLines={1} adjustsFontSizeToFit>
                  {toast.pick}
                </Text>
              </View>
            ) : null}
            {toast?.caption ? (
              <Text style={[styles.caption, { fontFamily: fontMedium }]} numberOfLines={2}>
                {toast.caption}
              </Text>
            ) : null}
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrap: {
    width: '78%',
    maxWidth: 340,
    borderRadius: 30,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  card: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
    paddingTop: 30,
    paddingBottom: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    overflow: 'hidden',
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 90 },
  ring: {
    padding: 6,
    borderRadius: 50,
    borderWidth: 1,
  },
  icon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 21, textAlign: 'center', marginTop: 18 },
  pickChip: {
    marginTop: 14,
    paddingHorizontal: 18,
    height: 40,
    minWidth: 120,
    maxWidth: '100%',
    borderRadius: 20,
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickText: { color: '#E9DDFF', fontSize: 18 },
  caption: { color: '#A39DB5', fontSize: 13, textAlign: 'center', marginTop: 12 },
});
