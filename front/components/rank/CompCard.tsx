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
} from 'react-native';

import { useTranslation } from '../../src/i18n';

const ACCENT = '#8B5CF6';
const CARD_BORDER = '#2E1F50';

export interface CompCardProps {
  img: ImageSourcePropType;
  title: string;
  sub: string;
  actionText?: string;
  rewardHint?: string;
  titleIcon?: LucideIcon;
  ctaIcon?: LucideIcon;
  onPress?: () => void;
}

const CompCard: React.FC<CompCardProps> = ({
  img,
  title,
  sub,
  actionText,
  rewardHint,
  titleIcon: TitleIcon,
  ctaIcon: CtaIcon,
  onPress,
}) => {
  const { t, isRTL } = useTranslation();
  const ctaLabel = actionText ?? t.rank.playNow;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Image source={img} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(3,0,8,0.55)', 'rgba(3,0,8,0.92)']}
        locations={[0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.content}>
        <View style={s.textBlock}>
          <View style={[s.titleRow, isRTL && s.titleRowRtl]}>
            <Text style={s.title} numberOfLines={1}>
              {title}
            </Text>
            {TitleIcon ? <TitleIcon size={24} color="#fff" strokeWidth={2} /> : null}
          </View>
          <Text style={s.sub} numberOfLines={3}>
            {sub}
          </Text>
          {rewardHint ? (
            <Text style={s.rewardHint} numberOfLines={2}>
              {rewardHint}
            </Text>
          ) : null}
        </View>

        <LinearGradient
          colors={[ACCENT, '#3B266B']}
          style={s.cta}
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
    flex: 1,
    height: 269,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    backgroundColor: '#12081F',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: 134,
    paddingBottom: 16,
    paddingHorizontal: 12,
    gap: 14,
  },
  textBlock: {
    gap: 4,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  titleRowRtl: {
    flexDirection: 'row-reverse',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  sub: {
    color: '#9D9D9D',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
  },
  rewardHint: {
    color: '#C084FC',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
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
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
