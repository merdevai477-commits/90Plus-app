import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { BlurView } from 'expo-blur';
import { Play } from 'lucide-react-native';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ACCENT = '#A855F7';

interface CompCardProps {
  img: any;
  title: string;
  sub: string;
  actionText?: string;
  onPress?: () => void;
}

export default function CompCard({ img, title, sub, actionText, onPress }: CompCardProps) {
  const CardWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const wrapperProps = isLiquidGlassSupported
    ? { effect: 'clear' as const, interactive: true }
    : { intensity: 12, tint: 'dark' as const };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <CardWrapper {...(wrapperProps as any)} style={s.compCard}>
        <View style={s.iconGlowAmbient} />
        <View style={s.compIconArea}>
          <Image source={img} style={s.compImg} resizeMode="contain" />
        </View>
        <Text style={s.compTitle}>{title}</Text>
        <Text style={s.compSub}>{sub}</Text>
        <View style={s.livePill}>
          <Play size={12} color={ACCENT} fill={ACCENT} />
          <Text style={s.liveTxt}>{actionText || 'Play Now'}</Text>
        </View>
      </CardWrapper>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  compCard: {
    width: 180, borderRadius: 30, padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1.2, borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center', overflow: 'hidden', minHeight: 245,
  },
  compIconArea: { width: 120, height: 110, justifyContent: 'center', alignItems: 'center', marginBottom: 10, zIndex: 2 },
  compImg: { width: 115, height: 115 },
  iconGlowAmbient: {
    position: 'absolute', top: -160, width: 70, height: 70,
    backgroundColor: ACCENT, borderRadius: 35, opacity: 0.3, zIndex: 1, transform: [{ scale: 2 }],
  },
  compTitle: { color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  compSub: { color: '#999', fontSize: 11, textAlign: 'center', lineHeight: 16, marginBottom: 18, height: 32 },
  livePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 1)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, gap: 6,
    borderWidth: 1, borderColor: 'rgba(0, 0, 0, 1)',
  },
  liveTxt: { color: ACCENT, fontWeight: '800', fontSize: 12 },
});
