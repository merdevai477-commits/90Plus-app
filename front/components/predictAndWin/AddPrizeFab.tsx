/**
 * Sponsor hub CTA — Figma `Component 40` (`953:2465`) state matrix.
 *
 * Wide pill: 239×76, radius 53. Add: gift cap + label + plus.
 * Status: dark tinted wash (not solid yellow/red) + gradient label + status icon.
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
import { PW, PW_GRADIENTS, PW_RADII, usePWFonts, usePWScale } from './theme';

const INSET_SHADOW = 'inset 0px -3px 4px rgba(0,0,0,0.25)';

/** SwiftUI `Color(red: 0.32, green: 0.03, blue: 0.59)` base + darker gift cap. */
const ADD_PILL_SOLID = '#510D96';
const ADD_GIFT_CAP = '#3A0A6E';

/** Figma geometry on the 448 artboard. */
const PILL = {
  width: 239,
  height: 76,
  giftCapWidth: 78,
  compactWidth: 78,
  plus: 34,
  gift: 36,
  titleSize: 20,
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

function AddPrizePrimaryPill({ label }: { label: string }) {
  const { s, f } = usePWScale();
  const { semibold } = usePWFonts();
  const radius = s(PW_RADII.fab);

  return (
    <View
      style={{
        width: s(PILL.width),
        height: s(PILL.height),
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
          width: s(PILL.giftCapWidth),
          height: s(PILL.height),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconGiftFill width={s(PILL.gift)} height={s(PILL.gift)} />
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
          paddingVertical: s(PILL.padV),
          paddingLeft: s(8),
          paddingRight: s(PILL.padH),
        }}
      >
        <Text
          style={{
            fontFamily: semibold,
            fontSize: f(PILL.titleSize),
            color: PW.text,
            flexShrink: 1,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
        <IconRoundPlus width={s(PILL.plus)} height={s(PILL.plus)} />
      </LinearGradient>
    </View>
  );
}

function StatusCtaPill({
  variant,
  label,
  compact,
}: {
  variant: Exclude<AddPrizeButtonVariant, 'add'>;
  label: string;
  compact: boolean;
}) {
  const { s, f } = usePWScale();
  const { semibold } = usePWFonts();
  const { wash, text, Icon } = STATUS[variant];
  const radius = s(PW_RADII.fab);
  const icon = <Icon width={s(PILL.gift)} height={s(PILL.gift)} />;

  if (compact) {
    return (
      <LinearGradient
        colors={[...wash]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          width: s(PILL.compactWidth),
          height: s(PILL.height),
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: INSET_SHADOW,
        }}
      >
        {icon}
      </LinearGradient>
    );
  }

  return (
    <View
      style={{
        width: s(PILL.width),
        height: s(PILL.height),
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
          paddingVertical: s(PILL.padV),
          paddingHorizontal: s(PILL.padH),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PWGradientText
          colors={[...text]}
          style={{
            fontFamily: semibold,
            fontSize: f(PILL.titleSize),
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
          width: s(PILL.giftCapWidth),
          height: s(PILL.height),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </LinearGradient>
    </View>
  );
}

export function AddPrizeButton({
  variant = 'add',
  compact = false,
  onPress,
  disabled = false,
}: {
  variant?: AddPrizeButtonVariant;
  /** 78×76 gift-only pill when the row is too tight for the wide label. */
  compact?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { s, width: screenW } = usePWScale();
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

  const useCompact = compact || (variant === 'add' && screenW < s(360));

  const shellStyle: StyleProp<ViewStyle> = {
    flexShrink: 0,
    opacity: disabled ? 0.65 : 1,
    width: s(useCompact ? PILL.compactWidth : PILL.width),
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
      {variant === 'add' && !useCompact ? (
        <AddPrizePrimaryPill label={label} />
      ) : variant === 'add' ? (
        <LinearGradient
          colors={[ADD_GIFT_CAP, ADD_PILL_SOLID]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            width: s(PILL.compactWidth),
            height: s(PILL.height),
            borderRadius: s(PW_RADII.fab),
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: INSET_SHADOW,
          }}
        >
          <IconGiftFill width={s(PILL.gift)} height={s(PILL.gift)} />
        </LinearGradient>
      ) : (
        <StatusCtaPill variant={variant} label={label} compact={useCompact} />
      )}
    </Pressable>
  );
}
