/**
 * CompCard — Rank competition tile.
 * - overlay: dark full-bleed art with scrim (existing 2×2 grid)
 * - stack: Figma 1957:131 light card — image on top, white footer, soft shadow
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
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

import { useResolvedAppScheme } from '@/hooks/useResolvedAppScheme';
import { useTranslation } from '../../src/i18n';
import { getCompCardMetrics, getCompCardMetricsForLayout } from './compCardMetrics';
import { getRankTheme, RANK_LIGHT_ELEVATION } from './rankTheme';

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
  /** Darker, taller fade for full-bleed photos, where the text sits on busy art. */
  photoScrim?: boolean;
  /** overlay = dark grid tile; stack = Figma light vertical card. */
  variant?: 'overlay' | 'stack';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const SCRIM = {
  art: { colors: ['transparent', 'rgba(3,0,8,0.25)', 'rgba(3,0,8,0.82)'], locations: [0.45, 0.72, 1] },
  photo: { colors: ['transparent', 'rgba(3,0,8,0.6)', 'rgba(3,0,8,0.94)'], locations: [0.3, 0.55, 0.8] },
} as const;

const CompCard: React.FC<CompCardProps> = ({
  img,
  title,
  sub,
  actionText,
  titleIcon: TitleIcon,
  ctaIcon: CtaIcon,
  photoScrim = false,
  variant = 'overlay',
  onPress,
  style,
}) => {
  const scrim = photoScrim ? SCRIM.photo : SCRIM.art;
  const { t, isRTL } = useTranslation();
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getRankTheme(isDark), [isDark]);
  const ctaLabel = actionText ?? t.rank.playNow;
  const [slotWidth, setSlotWidth] = useState(0);
  const m = useMemo(
    () => (slotWidth > 0 ? getCompCardMetricsForLayout(slotWidth) : getCompCardMetrics()),
    [slotWidth],
  );
  const overlayStyles = useMemo(() => createOverlayStyles(m), [m]);
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  if (variant === 'stack') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          stackStyles.card,
          RANK_LIGHT_ELEVATION.stack,
          {
            backgroundColor: theme.stackCardBg,
            borderColor: theme.stackCardBorder,
          },
          style,
          pressed && { opacity: 0.94 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <View style={stackStyles.imageWrap}>
          <Image source={img} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
        </View>
        <View style={[stackStyles.footer, { flexDirection: isRTL ? 'row' : 'row-reverse' }]}>
          <View style={[stackStyles.copy, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text
              style={[
                stackStyles.title,
                {
                  color: theme.stackTitle,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={[
                stackStyles.sub,
                {
                  color: theme.stackSub,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              numberOfLines={2}
            >
              {sub}
            </Text>
          </View>
          <View style={[stackStyles.cta, { flexDirection: isRTL ? 'row' : 'row-reverse' }]}>
            <Text style={[stackStyles.ctaText, { color: theme.stackCta }]} numberOfLines={1}>
              {ctaLabel}
            </Text>
            <Chevron size={16} color={theme.stackCta} strokeWidth={2.4} />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== slotWidth) {
          setSlotWidth(nextWidth);
        }
      }}
      onPress={onPress}
      style={({ pressed }) => [overlayStyles.card, style, pressed && { opacity: 0.92 }]}
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
        colors={scrim.colors}
        locations={scrim.locations}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={overlayStyles.content}>
        <View style={overlayStyles.textBlock}>
          <View style={[overlayStyles.titleRow, isRTL && overlayStyles.titleRowRtl]}>
            <Text style={overlayStyles.title} numberOfLines={2}>
              {title}
            </Text>
            {TitleIcon ? (
              <TitleIcon size={m.titleIconSize} color="#fff" strokeWidth={2} style={overlayStyles.titleIcon} />
            ) : null}
          </View>
          <Text style={overlayStyles.sub} numberOfLines={3}>
            {sub}
          </Text>
        </View>

        <View style={[overlayStyles.cta, isRTL && overlayStyles.ctaRtl]}>
          <Text style={overlayStyles.ctaText} numberOfLines={1}>
            {ctaLabel}
          </Text>
          {CtaIcon ? <CtaIcon size={m.ctaIconSize} color="#fff" strokeWidth={2.5} /> : null}
        </View>
      </View>
    </Pressable>
  );
};

export default CompCard;

const stackStyles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    height: 175,
    backgroundColor: '#EDE7F6',
  },
  footer: {
    minHeight: 79,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    width: '100%',
  },
  sub: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    width: '100%',
  },
  cta: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    paddingBottom: 2,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

function createOverlayStyles(m: ReturnType<typeof getCompCardMetrics>) {
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
