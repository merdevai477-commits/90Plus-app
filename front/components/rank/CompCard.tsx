/**
 * CompCard — Figma rank competition tile (204×269, node 1005:2558).
 * Layout tokens from SwiftUI export: paddingTop 134, gap 14 / 4 / 2.
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

export const COMP_CARD_WIDTH = 204;
export const COMP_CARD_HEIGHT = 269;

const CTA_PURPLE = '#8C5CF5';
const CARD_BORDER = '#2E1F50';
const SUBTITLE_GRAY = '#9E9E9E';

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
        colors={['transparent', 'rgba(3,0,8,0.25)', 'rgba(3,0,8,0.82)']}
        locations={[0.45, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.content}>
        <View style={s.textBlock}>
          <View style={[s.titleRow, isRTL && s.titleRowRtl]}>
            <Text style={s.title} numberOfLines={2}>
              {title}
            </Text>
            {TitleIcon ? (
              <TitleIcon size={24} color="#fff" strokeWidth={2} style={s.titleIcon} />
            ) : null}
          </View>
          <Text style={s.sub} numberOfLines={3}>
            {sub}
          </Text>
        </View>

        <View style={[s.cta, isRTL && s.ctaRtl]}>
          <Text style={s.ctaText} numberOfLines={1}>
            {ctaLabel}
          </Text>
          {CtaIcon ? <CtaIcon size={16} color="#fff" strokeWidth={2.5} /> : null}
        </View>
      </View>
    </Pressable>
  );
};

export default CompCard;

const s = StyleSheet.create({
  card: {
    width: COMP_CARD_WIDTH,
    height: COMP_CARD_HEIGHT,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    backgroundColor: '#12081F',
  },
  content: {
    flex: 1,
    paddingTop: 134,
    paddingBottom: 16,
    paddingHorizontal: 12,
    gap: 14,
    justifyContent: 'flex-end',
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
    gap: 2,
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
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
  },
  sub: {
    color: SUBTITLE_GRAY,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
    width: '100%',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: 128,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 36,
    gap: 4,
    backgroundColor: CTA_PURPLE,
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
