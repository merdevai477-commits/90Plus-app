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
import { getRankTheme, RANK_DARK_ELEVATION, RANK_LIGHT_ELEVATION } from './rankTheme';

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
  const { t, language } = useTranslation();
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getRankTheme(isDark), [isDark]);
  const ctaLabel = actionText ?? t.rank.playNow;
  const [slotWidth, setSlotWidth] = useState(0);
  const m = useMemo(
    () => (slotWidth > 0 ? getCompCardMetricsForLayout(slotWidth) : getCompCardMetrics()),
    [slotWidth],
  );
  const overlayStyles = useMemo(() => createOverlayStyles(m), [m]);
  /** App keeps I18nManager LTR; mirror stack chrome from language like the Rank screen. */
  const isAr = language === 'ar';
  /** Figma 1957:566 — AR: title block on the right, CTA on the left with ← before label. */
  const Chevron = isAr ? ChevronLeft : ChevronRight;
  const textAlign = isAr ? ('right' as const) : ('left' as const);
  const alignEnd = isAr ? ('flex-end' as const) : ('flex-start' as const);

  if (variant === 'stack') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          stackStyles.card,
          isDark ? RANK_DARK_ELEVATION.stack : RANK_LIGHT_ELEVATION.stack,
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
          <Image
            source={img}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
            transition={0}
          />
        </View>
        {/*
          Figma footer: justify-between + items-end.
          LTR row → copy left / CTA right; RTL row-reverse → copy right / CTA left.
        */}
        <View
          style={[
            stackStyles.footer,
            { flexDirection: isAr ? 'row-reverse' : 'row' },
          ]}
        >
          <View style={[stackStyles.copy, { alignItems: alignEnd }]}>
            <Text
              style={[
                stackStyles.title,
                { color: theme.stackTitle, textAlign, writingDirection: isAr ? 'rtl' : 'ltr' },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={[
                stackStyles.sub,
                { color: theme.stackSub, textAlign, writingDirection: isAr ? 'rtl' : 'ltr' },
              ]}
              numberOfLines={1}
            >
              {sub}
            </Text>
          </View>
          {/* Physical order matches Figma AR: ← label ; EN flips to label → */}
          <View style={stackStyles.cta}>
            {isAr ? <Chevron size={18} color={theme.stackCta} strokeWidth={2.4} /> : null}
            <Text style={[stackStyles.ctaText, { color: theme.stackCta }]} numberOfLines={1}>
              {ctaLabel}
            </Text>
            {!isAr ? <Chevron size={18} color={theme.stackCta} strokeWidth={2.4} /> : null}
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
          <View style={[overlayStyles.titleRow, isAr && overlayStyles.titleRowRtl]}>
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

        <View style={[overlayStyles.cta, isAr && overlayStyles.ctaRtl]}>
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

/** Figma stack card 1957:564 — 390×254 = image 175 + footer 79 (1957:566). */
const STACK_IMAGE_H = 175;
const STACK_FOOTER_H = 79;
const STACK_RADIUS = 16;

const stackStyles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: STACK_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    height: STACK_IMAGE_H,
    backgroundColor: '#EDE7F6',
    borderTopLeftRadius: STACK_RADIUS,
    borderTopRightRadius: STACK_RADIUS,
    overflow: 'hidden',
  },
  footer: {
    height: STACK_FOOTER_H,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  copy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
    justifyContent: 'center',
    // Figma copy block ~265×48 inside 390 footer.
    maxWidth: '72%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
    width: '100%',
  },
  sub: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15,
    width: '100%',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexShrink: 0,
    height: 18,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
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
