/**
 * CompCard
 *
 * Horizontally-scrolled competition card on the Rank screen. Wraps a glass
 * surface (LiquidGlass on iOS, BlurView elsewhere) inside a Pressable so the
 * press feedback works alongside the native interactive layer.
 */

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView } from 'expo-blur';
import { Play } from 'lucide-react-native';
import React from 'react';
import {
  I18nManager,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTranslation } from '../../src/i18n';

const ACCENT = '#A855F7';

export interface CompCardProps {
  img: ImageSourcePropType;
  title: string;
  sub: string;
  actionText?: string;
  onPress?: () => void;
}

const CompCard: React.FC<CompCardProps> = ({
  img,
  title,
  sub,
  actionText,
  onPress,
}) => {
  const CardWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const wrapperProps = isLiquidGlassSupported
    ? { effect: 'clear' as const, interactive: true }
    : { intensity: 12, tint: 'dark' as const };

  const { t } = useTranslation();
  const cta: string = actionText ?? t.rank.playNow;
  const livePillDirection = I18nManager.isRTL ? 'row-reverse' : 'row';

  // Only apply manual press feedback on the non-LiquidGlass path so we
  // don't double up the visual response on iOS.
  const useManualFeedback = !(isLiquidGlassSupported && Platform.OS === 'ios');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        useManualFeedback && pressed ? { opacity: 0.85 } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <CardWrapper {...(wrapperProps as any)} style={s.compCard}>
        <View style={s.iconGlowAmbient} />
        <View style={s.compIconArea}>
          <Image source={img} style={s.compImg} resizeMode="contain" />
        </View>
        <Text style={s.compTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={s.compSub} numberOfLines={2}>
          {sub}
        </Text>
        <View style={[s.livePill, { flexDirection: livePillDirection }]}>
          <Play size={12} color={ACCENT} fill={ACCENT} />
          <Text style={s.liveTxt}>{cta}</Text>
        </View>
      </CardWrapper>
    </Pressable>
  );
};

export default CompCard;

const s = StyleSheet.create({
  compCard: {
    width: 180,
    borderRadius: 30,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 245,
  },
  compIconArea: {
    width: 120,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    zIndex: 2,
  },
  compImg: { width: 115, height: 115 },
  iconGlowAmbient: {
    position: 'absolute',
    top: -160,
    width: 70,
    height: 70,
    backgroundColor: ACCENT,
    borderRadius: 35,
    opacity: 0.3,
    zIndex: 1,
    transform: [{ scale: 2 }],
  },
  compTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  compSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 18,
    minHeight: 32,
  },
  livePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 1)',
  },
  liveTxt: { color: ACCENT, fontWeight: '800', fontSize: 12 },
});
