/**
 * CompCard — Figma rank competition tile (node 1005:2558, 204×269).
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import {
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTranslation } from '../../src/i18n';

const ACCENT = '#8B5CF6';
const CARD_BORDER = '#2E1F50';
const CARD_HEIGHT = 269;
const FOOTER_MIN_HEIGHT = 135;

export interface CompCardProps {
  img: ImageSourcePropType;
  title: string;
  sub: string;
  actionText?: string;
  rewardHint?: string;
  titleIcon?: LucideIcon;
  ctaIcon?: LucideIcon;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const CompCard: React.FC<CompCardProps> = ({
  img,
  title,
  sub,
  actionText,
  titleIcon: TitleIcon,
  ctaIcon: CtaIcon,
  onPress,
  style,
}) => {
  const { t, isRTL } = useTranslation();
  const ctaLabel = actionText ?? t.rank.playNow;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, style, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Image
        source={img}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="top"
      />

      <LinearGradient
        colors={['transparent', 'rgba(3,0,8,0.35)', 'rgba(3,0,8,0.88)']}
        locations={[0.42, 0.68, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.footer}>
        <View style={s.textBlock}>
          <View style={[s.titleRow, isRTL && s.titleRowRtl]}>
            <Text style={s.title} numberOfLines={2}>
              {title}
            </Text>
            {TitleIcon ? (
              <TitleIcon size={22} color="#fff" strokeWidth={2} style={s.titleIcon} />
            ) : null}
          </View>
          <Text style={s.sub} numberOfLines={2}>
            {sub}
          </Text>
        </View>

        <LinearGradient
          colors={[ACCENT, '#3B266B']}
          style={[s.cta, isRTL && s.ctaRtl]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <Text style={s.ctaText} numberOfLines={1}>
            {ctaLabel}
          </Text>
          {CtaIcon ? <CtaIcon size={16} color="#fff" strokeWidth={2.5} /> : null}
        </LinearGradient>
      </View>
    </Pressable>
  );
};

export default CompCard;

const s = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    backgroundColor: '#12081F',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: FOOTER_MIN_HEIGHT,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 12,
    justifyContent: 'flex-end',
    gap: 14,
  },
  textBlock: {
    gap: 4,
    alignItems: 'center',
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
  },
  titleRowRtl: {
    flexDirection: 'row-reverse',
  },
  titleIcon: {
    flexShrink: 0,
  },
  title: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
  sub: {
    color: '#9D9D9D',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
    minHeight: 32,
    width: '100%',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 128,
    maxWidth: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 36,
    gap: 4,
  },
  ctaRtl: {
    flexDirection: 'row-reverse',
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
});
