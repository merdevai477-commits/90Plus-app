/**
 * CompCard — Figma rank competition tile (node 1005:2558).
 * Size control: front/components/rank/compCardMetrics.ts → COMP_CARD_SCALE
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
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
import { getCompCardMetrics, getCompCardMetricsForLayout } from './compCardMetrics';

export {
  COMP_CARD_HEIGHT,
  COMP_CARD_SCALE,
  COMP_CARD_WIDTH,
  getCompCardMetrics,
  getCompCardMetricsForLayout,
} from './compCardMetrics';

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
  const [slotWidth, setSlotWidth] = useState(0);

  const m = useMemo(
    () => (slotWidth > 0 ? getCompCardMetricsForLayout(slotWidth) : getCompCardMetrics()),
    [slotWidth],
  );
  const s = useMemo(() => createStyles(m), [m]);

  return (
    <Pressable
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== slotWidth) {
          setSlotWidth(nextWidth);
        }
      }}
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
              <TitleIcon size={m.titleIconSize} color="#fff" strokeWidth={2} style={s.titleIcon} />
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
          {CtaIcon ? <CtaIcon size={m.ctaIconSize} color="#fff" strokeWidth={2.5} /> : null}
        </View>
      </View>
    </Pressable>
  );
};

export default CompCard;

function createStyles(m: ReturnType<typeof getCompCardMetrics>) {
  return StyleSheet.create({
    card: {
      width: '100%',
      height: m.height,
      borderRadius: m.borderRadius,
      borderWidth: 0.5,
      borderColor: CARD_BORDER,
      overflow: 'hidden',
      backgroundColor: '#12081F',
    },
    content: {
      flex: 1,
      paddingTop: m.paddingTop,
      paddingBottom: m.paddingBottom,
      paddingHorizontal: m.paddingHorizontal,
      gap: m.contentGap,
      justifyContent: 'flex-end',
    },
    textBlock: {
      gap: m.textGap,
      alignItems: 'center',
      width: '100%',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: m.titleGap,
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
      fontSize: m.titleFontSize,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: m.titleLineHeight,
    },
    sub: {
      color: SUBTITLE_GRAY,
      fontSize: m.subFontSize,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: m.subLineHeight,
      width: '100%',
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      width: m.ctaWidth,
      paddingVertical: m.ctaPaddingV,
      paddingHorizontal: m.ctaPaddingH,
      borderRadius: m.ctaRadius,
      gap: m.ctaGap,
      backgroundColor: CTA_PURPLE,
    },
    ctaRtl: {
      flexDirection: 'row-reverse',
    },
    ctaText: {
      color: '#fff',
      fontSize: m.ctaFontSize,
      fontWeight: '700',
      flexShrink: 1,
    },
  });
}
