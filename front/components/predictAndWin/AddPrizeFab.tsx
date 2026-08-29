/**
 * Sponsor hub CTA — every variant is `PILL.width` × `PILL.height` (219×36).
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Pressable, Text, View, type StyleProp, ViewStyle } from 'react-native';

import { useTranslation } from '../../src/i18n';
import type { CompetitionStatus } from '../../services/competitions.service';
import { PWGradientText } from './GradientText';
import {
  IconCtaCheck,
  IconCtaCross,
  IconCtaLoading,
  IconGiftFill,
  IconRoundPlus,
} from './icons';
import { PW, PW_GRADIENTS, usePWFonts, usePWScale } from './theme';

const INSET_SHADOW = 'inset 0px -3px 4px rgba(0,0,0,0.25)';

/** SwiftUI `Color(red: 0.32, green: 0.03, blue: 0.59)` base + darker gift cap. */
const ADD_PILL_SOLID = '#510D96';
const ADD_GIFT_CAP = '#3A0A6E';

/** Shared CTA size — every variant (add / pending / winner / rejected) uses this. */
const PILL = {
  width: 219,
  height: 36,
  giftCapWidth: 78,
  compactWidth: 78,
  plus: 34,
  gift: 36,
  titleSize: 10,
  padH: 10,
  padV: 10,
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
    wash: readonly [string, string];
    text: readonly [string, string];
    Icon: typeof IconCtaCheck;
  }
> = {
  pending: {
    wash: ['#3D3D08', '#1F1F04'],
    text: ['#FFFF00', '#C7C700'],
    Icon: IconCtaLoading,
  },
  winner: {
    wash: ['#0A3D0A', '#051A05'],
    text: ['#00CC00', '#00AA00'],
    Icon: IconCtaCheck,
  },
  rejected: {
    wash: ['#4A0000', '#1A0000'],
    text: ['#FF6B6B', '#FF3B3B'],
    Icon: IconCtaCross,
  },
};

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
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        flexDirection: 'row',
        direction: 'ltr',
        boxShadow: INSET_SHADOW,
      }}
    >
      <LinearGradient
        colors={[ADD_GIFT_CAP, ADD_PILL_SOLID]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          width: capWidth,
          height,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconGiftFill width={gift} height={gift} />
      </LinearGradient>

      <LinearGradient
        colors={[...PW_GRADIENTS.fab]}
        locations={[...PW_GRADIENTS.fabLocations]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
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
      </LinearGradient>
    </View>
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
  const { wash, text, Icon } = STATUS[variant];

  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        flexDirection: 'row',
        direction: 'ltr',
        boxShadow: INSET_SHADOW,
      }}
    >
      <LinearGradient
        colors={[...wash]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          flex: 1,
          paddingHorizontal: padH,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PWGradientText
          colors={[...text]}
          style={{
            fontFamily: semibold,
            fontSize: titleSize,
            textAlign: 'center',
            flexShrink: 1,
          }}
        >
          {label}
        </PWGradientText>
      </LinearGradient>
      <LinearGradient
        colors={[...wash]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          width: capWidth,
          height,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon width={gift} height={gift} />
      </LinearGradient>
    </View>
  );
}

export function AddPrizeButton({
  variant = 'add',
  onPress,
  disabled = false,
}: {
  variant?: AddPrizeButtonVariant;
  compact?: boolean;
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
