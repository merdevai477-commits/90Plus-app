/**
 * Sponsor hub CTA — every variant is `PILL.width` × `PILL.height` (219×36).
 * Glass body: LiquidGlass on supported iOS, BlurView elsewhere, plus a
 * coloured tint and a top specular so the pill reads as frosted glass.
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  ViewStyle,
} from 'react-native';

import { useTranslation } from '../../src/i18n';
import type { CompetitionStatus } from '../../services/competitions.service';
import { PWGradientText } from './GradientText';
import { GlassCtaShell } from './glassCta';
import {
  IconCtaCheck,
  IconCtaCross,
  IconCtaLoading,
  IconGiftFill,
  IconRoundPlus,
} from './icons';
import { PW, usePWFonts, usePWScale } from './theme';

/** Shared CTA size — every variant (add / pending / winner / rejected) uses this. */
const PILL = {
  width: 219,
  height: 36,
  /** Square icon well — matches pill height so the glyph never hangs off the edge. */
  giftCapWidth: 36,
  plus: 16,
  gift: 18,
  titleSize: 10,
  padH: 8,
} as const;

export type AddPrizeButtonVariant = 'add' | 'pending' | 'winner' | 'rejected';

export function deriveAddPrizeVariant(
  status: CompetitionStatus | null,
  opts?: { winnerAwardedAt?: string | null },
): AddPrizeButtonVariant {
  if (!status) return 'add';
  if (status === 'DRAFT') return 'pending';
  if (status === 'REJECTED') return 'rejected';
  if (status === 'PUBLISHED' || status === 'LOCKED') return 'winner';
  if (status === 'SETTLED' && !opts?.winnerAwardedAt) return 'winner';
  return 'add';
}

/**
 * Figma status fills are a dark wash, not solid yellow/red/green.
 * Solid fills made "Prize rejected" unreadable (dark red on bright red).
 */
const STATUS: Record<
  Exclude<AddPrizeButtonVariant, 'add'>,
  {
    tint: readonly [string, string];
    text: readonly [string, string];
    Icon: typeof IconCtaCheck;
  }
> = {
  pending: {
    tint: ['rgba(255,255,0,0.22)', 'rgba(180,180,0,0.10)'],
    text: ['#FFFF66', '#FFE14D'],
    Icon: IconCtaLoading,
  },
  winner: {
    tint: ['rgba(0,220,80,0.24)', 'rgba(0,120,40,0.12)'],
    text: ['#7CFF9A', '#3DFF6A'],
    Icon: IconCtaCheck,
  },
  rejected: {
    tint: ['rgba(255,70,70,0.28)', 'rgba(160,0,0,0.14)'],
    text: ['#FF8A8A', '#FF5C5C'],
    Icon: IconCtaCross,
  },
};

const ADD_TINT = ['rgba(140,40,255,0.42)', 'rgba(81,7,151,0.22)'] as const;

function usePillMetrics() {
  const { s, f } = usePWScale();
  const height = s(PILL.height);
  const width = s(PILL.width);
  const inner = Math.max(12, height - s(4));
  return {
    s,
    width,
    height,
    radius: height / 2,
    capWidth: s(PILL.giftCapWidth),
    gift: Math.min(s(PILL.gift), inner),
    plus: Math.min(s(PILL.plus), inner),
    titleSize: f(PILL.titleSize),
    padH: s(Math.min(PILL.padH, 8)),
  };
}

function AddPrizePrimaryPill({ label }: { label: string }) {
  const { semibold } = usePWFonts();
  const { width, height, radius, capWidth, gift, plus, titleSize, padH, s } = usePillMetrics();

  return (
    <GlassCtaShell tint={ADD_TINT} width={width} height={height} radius={radius}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          direction: 'ltr',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: capWidth,
            height,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconGiftFill width={gift} height={gift} />
        </View>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(2),
            paddingLeft: s(6),
            paddingRight: padH,
          }}
        >
          <Text
            style={{
              fontFamily: semibold,
              fontSize: titleSize,
              color: PW.text,
              flexShrink: 1,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {label}
          </Text>
          <IconRoundPlus width={plus} height={plus} />
        </View>
      </View>
    </GlassCtaShell>
  );
}

function StatusCtaPill({
  variant,
  label,
}: {
  variant: Exclude<AddPrizeButtonVariant, 'add'>;
  label: string;
}) {
  const { semibold } = usePWFonts();
  const { width, height, radius, capWidth, gift, titleSize, padH } = usePillMetrics();
  const { tint, text, Icon } = STATUS[variant];

  return (
    <GlassCtaShell tint={tint} width={width} height={height} radius={radius}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          direction: 'ltr',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: padH,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PWGradientText
            colors={[...text]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{
              fontFamily: semibold,
              fontSize: titleSize,
              textAlign: 'center',
              flexShrink: 1,
            }}
          >
            {label}
          </PWGradientText>
        </View>
        <View
          style={{
            width: capWidth,
            height,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon width={gift} height={gift} />
        </View>
      </View>
    </GlassCtaShell>
  );
}

export function AddPrizeButton({
  variant = 'add',
  onPress,
  disabled = false,
}: {
  variant?: AddPrizeButtonVariant;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { width } = usePillMetrics();
  const { t } = useTranslation();
  const pw = t.predictAndWin;

  const label = useMemo(() => {
    switch (variant) {
      case 'pending':
        return pw.addPrizeCta.pending;
      case 'winner':
        return pw.addPrizeCta.winner;
      case 'rejected':
        return pw.addPrizeCta.rejected;
      default:
        return pw.addPrize;
    }
  }, [variant, pw]);

  const shellStyle: StyleProp<ViewStyle> = {
    flexShrink: 0,
    opacity: disabled ? 0.65 : 1,
    width,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => ({
        ...shellStyle,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      {variant === 'add' ? (
        <AddPrizePrimaryPill label={label} />
      ) : (
        <StatusCtaPill variant={variant} label={label} />
      )}
    </Pressable>
  );
}
