/**
 * Sponsor hub CTA — Figma `Component 40` (`953:2463`) state matrix.
 *
 * `add` wide pill: 239×76, radius 53 — 78px gift cap, label, 34px plus.
 * Visual order (LTR): gift → text → plus.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Pressable, Text, View, type StyleProp, ViewStyle } from 'react-native';

import { useTranslation } from '../../src/i18n';
import type { CompetitionStatus } from '../../services/competitions.service';
import { IconGiftFill, IconRoundPlus } from './icons';
import { PW, PW_GRADIENTS, PW_RADII, usePWDirection, usePWFonts, usePWScale } from './theme';

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

const VARIANT_STYLE: Record<
  Exclude<AddPrizeButtonVariant, 'add'>,
  { bg: string; text: string }
> = {
  pending: { bg: '#FFFF00', text: '#5C5C00' },
  winner: { bg: '#008000', text: '#00CC00' },
  rejected: { bg: '#FF0000', text: '#D10000' },
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
  const { s, f, width: screenW } = usePWScale();
  const { semibold } = usePWFonts();
  const dir = usePWDirection();
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

  const useCompact =
    compact || (variant === 'add' && screenW < s(360));

  const shellStyle: StyleProp<ViewStyle> = {
    flexShrink: 0,
    opacity: disabled ? 0.65 : 1,
    ...(useCompact
      ? { width: s(PILL.compactWidth) }
      : variant === 'add'
        ? { width: s(PILL.width) }
        : { maxWidth: s(PILL.width), minWidth: s(120) }),
  };

  const statusInnerStyle: ViewStyle = {
    height: s(PILL.height),
    paddingVertical: s(PILL.padV),
    paddingHorizontal: s(PILL.padH),
    borderRadius: s(PW_RADII.fab),
    flexDirection: dir.row,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: INSET_SHADOW,
    ...(useCompact
      ? { width: s(PILL.compactWidth) }
      : { width: s(PILL.width) }),
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
      ) : variant === 'add' && useCompact ? (
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
        <View
          style={{
            ...statusInnerStyle,
            backgroundColor: VARIANT_STYLE[variant].bg,
          }}
        >
          <Text
            style={{
              fontFamily: semibold,
              fontSize: f(PILL.titleSize),
              color: VARIANT_STYLE[variant].text,
              textAlign: 'center',
              paddingHorizontal: s(4),
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
